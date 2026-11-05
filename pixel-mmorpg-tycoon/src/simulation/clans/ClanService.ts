import { createId, type EntityId } from '@/core/ids';
import { EventBus } from '@/core/EventBus';
import { getLang } from '@/i18n';
import { CLAN_COLORS, CLAN_STYLES, clanName, clanTag, DRAMA_LIMIT, MAX_CLAN_SIZE, styleFor } from '@/data/clanData';
import { getBehavior } from '@/data/playerTypes';
import type { CreatureTemplate, SpawnArea } from '@/models/entities';
import type { ItemStack } from '@/models/rpg';
import type { Clan, LairStats, PlayerState, RaidRecord, RaidState } from '@/models/sim';
import { isAlive, type Actor } from '../actors/Actor';
import type { ActorManager } from '../actors/ActorManager';
import type { PlayerManager } from '../players/PlayerManager';
import type { SimContext, SimulationSystem } from '../types';
import type { WorldRuntime } from '../WorldRuntime';

export type ClanEvents = {
  founded: { clan: Clan; founder: PlayerState };
  disbanded: { clan: Clan; reason: 'empty' | 'drama' };
  split: { clan: Clan; rebels: Clan };
  raidFormed: { raid: RaidState; clan: Clan | null; boss: CreatureTemplate };
  raidPulled: { raid: RaidState; clan: Clan | null; boss: CreatureTemplate; present: number; early: boolean };
  raidEnded: { record: RaidRecord };
  ninja: { clan: Clan | null; player: PlayerState; itemId: EntityId };
  /** Everyone who took part in a boss kill (for season points). */
  raidMembers: { members: EntityId[]; level: number };
};

/** Gathering gives up after this many game minutes. */
export const RAID_GATHER_MINUTES = 90;
/** A fight that drags on longer than this is called off as a wipe. */
export const RAID_FIGHT_MINUTES = 240;
const MAX_ATTEMPTS = 3;

/**
 * Player communities: clans form around sociable players, recruit, bond (less churn),
 * argue (drama) and organise raids on boss lairs — gather at a rally point, pull,
 * then win (fame, loot, maybe loot drama) or wipe and try again.
 */
export class ClanService implements SimulationSystem {
  readonly id = 'clans';
  readonly interval = 10;
  readonly events = new EventBus<ClanEvents>();
  /** Ask the player AI to re-plan right away (set by the session). */
  replan: (playerId: EntityId) => void = () => undefined;
  private byId = new Map<EntityId, Clan>();
  private unsubs: (() => void)[] = [];

  constructor(private world: WorldRuntime, private actors: ActorManager, private pm: PlayerManager) {
    this.reindex();
    this.unsubs.push(actors.events.on('bossReset', ({ actor }) => this.onBossReset(actor)));
    this.unsubs.push(actors.events.on('died', ({ victim }) => {
      if (victim.kind !== 'player') return;
      const raid = this.raidOf(victim.defId);
      if (raid?.phase === 'fighting' && !raid.fallen.includes(victim.defId)) raid.fallen.push(victim.defId);
    }));
    this.unsubs.push(pm.events.on('left', ({ player, quit }) => { if (quit) this.leave(player); }));
  }

  private get sim() {
    return this.world.sim;
  }

  private get now() {
    return this.world.clock.totalMinutes;
  }

  private rand() {
    return this.actors.rand();
  }

  private reindex(): void {
    this.byId = new Map(this.sim.clans.map((c) => [c.id, c]));
  }

  // --------------------------------------------------------------- queries
  clans(): Clan[] {
    return this.sim.clans;
  }

  get(id: EntityId | null | undefined): Clan | undefined {
    return id ? this.byId.get(id) : undefined;
  }

  clanOf(p: PlayerState): Clan | undefined {
    return this.get(p.clanId);
  }

  raidOf(playerId: EntityId): RaidState | undefined {
    return this.sim.raids.find((r) => r.members.includes(playerId));
  }

  raid(id: EntityId): RaidState | undefined {
    return this.sim.raids.find((r) => r.id === id);
  }

  lairStats(areaId: EntityId): LairStats {
    return (this.sim.lairStats[areaId] ??= { kills: 0, wipes: 0, lastKillAt: null, firstKill: null });
  }

  lairs(): SpawnArea[] {
    return this.world.entities.list('spawnAreas').filter((a) => !!a.lair);
  }

  bossOf(areaId: EntityId): Actor | undefined {
    for (const a of this.actors.actors.values()) if (a.kind === 'creature' && a.spawnAreaId === areaId) return a;
    return undefined;
  }

  private onlineMembers(c: Clan): PlayerState[] {
    return c.members.map((id) => this.pm.get(id)).filter((p): p is PlayerState => !!p && p.online);
  }

  // --------------------------------------------------------------- membership
  found(founder: PlayerState): Clan {
    const used = new Set(this.sim.clans.map((c) => c.name));
    let name = clanName(() => this.rand(), getLang());
    for (let i = 0; i < 10 && used.has(name); i++) name = clanName(() => this.rand(), getLang());
    if (used.has(name)) name = `${name} ${this.sim.clans.length + 1}`;
    const usedColors = new Set(this.sim.clans.map((c) => c.color));
    const color = CLAN_COLORS.find((c) => !usedColors.has(c)) ?? CLAN_COLORS[Math.floor(this.rand() * CLAN_COLORS.length)];
    const clan: Clan = {
      id: createId('clan'), name, tag: clanTag(name), color,
      // Usually the founder's own style, sometimes something else entirely.
      style: this.rand() < 0.4 ? (['hardcore', 'casual', 'pvp', 'traders'] as const)[Math.floor(this.rand() * 4)] : styleFor(founder.behavior), leaderId: founder.id,
      members: [], foundedAt: this.now, fame: 0, drama: 0, raidWins: 0, raidWipes: 0, bossKills: {},
    };
    this.sim.clans.push(clan);
    this.byId.set(clan.id, clan);
    this.join(founder, clan);
    this.events.emit('founded', { clan, founder });
    return clan;
  }

  join(p: PlayerState, clan: Clan): void {
    if (p.clanId === clan.id) return;
    if (p.clanId) this.leave(p);
    p.clanId = clan.id;
    clan.members.push(p.id);
    this.pm.feel(p, 'clan', 2);
  }

  leave(p: PlayerState): void {
    const clan = this.clanOf(p);
    p.clanId = undefined;
    const raid = this.raidOf(p.id);
    if (raid) raid.members = raid.members.filter((id) => id !== p.id);
    if (!clan) return;
    clan.members = clan.members.filter((id) => id !== p.id);
    if (clan.leaderId === p.id) this.promote(clan);
    if (!clan.members.length) this.disband(clan, 'empty');
  }

  private promote(clan: Clan): void {
    const next = clan.members.map((id) => this.pm.get(id)).filter((x): x is PlayerState => !!x).sort((a, b) => b.level - a.level)[0];
    if (next) clan.leaderId = next.id;
  }

  disband(clan: Clan, reason: 'empty' | 'drama'): void {
    for (const id of clan.members) { const p = this.pm.get(id); if (p) { p.clanId = undefined; if (reason === 'drama') this.pm.feel(p, 'drama', 2); } }
    clan.members = [];
    for (const r of this.sim.raids.filter((r) => r.clanId === clan.id)) this.endRaid(r, 'abandoned');
    this.sim.clans = this.sim.clans.filter((c) => c.id !== clan.id);
    this.byId.delete(clan.id);
    this.events.emit('disbanded', { clan, reason });
  }

  // --------------------------------------------------------------- hourly
  hourly(): void {
    this.cleanup();
    const online = this.pm.online();
    // Bonding: members enjoy playing with their clan mates.
    for (const c of this.sim.clans) {
      const on = this.onlineMembers(c);
      if (on.length >= 2) for (const p of on) this.pm.feel(p, 'clan', Math.min(3, on.length / 2));
      c.drama = Math.max(0, c.drama - 2);
    }
    for (const c of [...this.sim.clans]) if (c.drama >= DRAMA_LIMIT) this.blowUp(c);
    this.formClans(online);
    this.recruit(online);
    this.planRaids(online);
  }

  /** Drop members who quit or were banned; fix leaders. */
  private cleanup(): void {
    for (const c of [...this.sim.clans]) {
      c.members = c.members.filter((id) => this.pm.get(id)?.clanId === c.id);
      if (!c.members.length) { this.disband(c, 'empty'); continue; }
      if (!c.members.includes(c.leaderId)) this.promote(c);
    }
  }

  /** Too much drama: big clans split, small ones fall apart. */
  private blowUp(c: Clan): void {
    const members = c.members.map((id) => this.pm.get(id)).filter((p): p is PlayerState => !!p);
    for (const p of members) this.pm.feel(p, 'drama');
    if (members.length < 6) return this.disband(c, 'drama');
    const rebels = members.filter((p) => p.id !== c.leaderId && this.rand() < 0.4);
    if (rebels.length < 2) { c.drama = 50; return; }
    const leader = rebels.sort((a, b) => b.level - a.level)[0];
    this.leave(leader);
    const fresh = this.found(leader);
    for (const r of rebels) if (r !== leader) this.join(r, fresh);
    c.drama = 30;
    fresh.drama = 10;
    this.events.emit('split', { clan: c, rebels: fresh });
  }

  private formClans(online: PlayerState[]): void {
    const free = online.filter((p) => !p.clanId && p.level >= 4 && !p.cheat);
    const wanted = Math.max(1, Math.floor(online.length / 12));
    if (free.length < 6 || this.sim.clans.length >= wanted || this.rand() > 0.45) return;
    const score = (p: PlayerState) => { const w = getBehavior(p.behavior).weights; return w.social + w.fight * 0.5 + p.level / 20 + this.rand() * 0.5; };
    const founder = free.sort((a, b) => score(b) - score(a))[0];
    const clan = this.found(founder);
    // A couple of friends join right away.
    for (const p of free.filter((x) => x !== founder && styleFor(x.behavior) === clan.style).slice(0, 2)) this.join(p, clan);
  }

  private recruit(online: PlayerState[]): void {
    if (!this.sim.clans.length) return;
    for (const p of online) {
      if (p.clanId || p.level < 3 || p.cheat === 'griefer') continue;
      const w = getBehavior(p.behavior).weights;
      if (this.rand() > 0.06 * (1 + w.social)) continue;
      const style = styleFor(p.behavior);
      const open = this.sim.clans.filter((c) => c.members.length < MAX_CLAN_SIZE);
      if (!open.length) return;
      // Famous clans and clans of the same play style attract more recruits.
      const weight = (c: Clan) => (1 + c.fame / 200) * (c.style === style ? 3 : 1) * (1 + c.members.length / 10) * (c.drama > 50 ? 0.4 : 1);
      const total = open.reduce((s, c) => s + weight(c), 0);
      let r = this.rand() * total;
      const clan = open.find((c) => (r -= weight(c)) <= 0) ?? open[0];
      this.join(p, clan);
    }
  }

  // --------------------------------------------------------------- raids
  /** Boss alive, not already being raided. */
  private raidableLairs(): { area: SpawnArea; tpl: CreatureTemplate; boss: Actor }[] {
    const busy = new Set(this.sim.raids.map((r) => r.lairId));
    const out: { area: SpawnArea; tpl: CreatureTemplate; boss: Actor }[] = [];
    for (const area of this.lairs()) {
      if (busy.has(area.id)) continue;
      const tpl = this.world.entities.get('creatureTemplates', area.templateId);
      const boss = this.bossOf(area.id);
      if (tpl && boss && isAlive(boss)) out.push({ area, tpl, boss });
    }
    return out;
  }

  private planRaids(online: PlayerState[]): void {
    let lairs = this.raidableLairs();
    if (!lairs.length) return;
    const busy = (p: PlayerState) => !!this.raidOf(p.id);
    // Clans first: pick the hardest boss they can field a group for.
    for (const c of [...this.sim.clans].sort((a, b) => b.fame - a.fame)) {
      if (this.sim.raids.some((r) => r.clanId === c.id)) continue;
      if (this.rand() > CLAN_STYLES[c.style].raidChance) continue;
      const on = this.onlineMembers(c).filter((p) => !busy(p));
      const pick = this.chooseLair(on, lairs);
      if (!pick) continue;
      this.startRaid(c, pick.members, pick.lair);
      lairs = lairs.filter((l) => l !== pick.lair);
      if (!lairs.length) return;
    }
    // Pick-up groups of clanless players ("LFG raid, need heals").
    if (this.rand() < 0.3) {
      const free = online.filter((p) => !p.clanId && !busy(p) && getBehavior(p.behavior).weights.fight > 0.4);
      const pick = this.chooseLair(free, lairs, true);
      if (pick) this.startRaid(null, pick.members, pick.lair);
    }
  }

  private chooseLair(pool: PlayerState[], lairs: { area: SpawnArea; tpl: CreatureTemplate }[], pug = false) {
    let best: { lair: (typeof lairs)[number]; members: PlayerState[] } | null = null;
    for (const lair of lairs) {
      const need = lair.area.lair!.minRaid;
      const able = pool.filter((p) => p.level >= lair.tpl.level - 4).sort((a, b) => b.level - a.level);
      if (able.length < need) continue;
      const size = pug ? need + Math.floor(this.rand() * 2) : Math.min(20, Math.max(need, Math.round(need * 1.4)));
      const members = able.slice(0, size);
      if (!best || lair.tpl.level > best.lair.tpl.level) best = { lair, members };
    }
    return best;
  }

  private rallyPoint(area: SpawnArea): { x: number; y: number } {
    const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
    // Just outside the boss's reach (see CreatureSystem.boss leash).
    const d = Math.max(area.w, area.h) / 2 + 10;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [0.7, 0.7], [-0.7, 0.7]]) {
      const p = this.actors.randomWalkableNear(cx + dx * d, cy + dy * d, 1.5);
      if (p) return p;
    }
    return { x: Math.floor(cx), y: Math.floor(cy + d) };
  }

  startRaid(clan: Clan | null, members: PlayerState[], lair: { area: SpawnArea; tpl: CreatureTemplate }): RaidState {
    const rally = this.rallyPoint(lair.area);
    const raid: RaidState = {
      id: createId('raid'), clanId: clan?.id ?? null, lairId: lair.area.id, members: members.map((m) => m.id), phase: 'gathering',
      startedAt: this.now, gatherUntil: this.now + RAID_GATHER_MINUTES, fightStartedAt: null, attempt: 1, rallyX: rally.x, rallyY: rally.y, fallen: [],
    };
    this.sim.raids.push(raid);
    for (const m of members) this.replan(m.id);
    this.events.emit('raidFormed', { raid, clan: clan ?? null, boss: lair.tpl });
    return raid;
  }

  /** Raid members standing at the rally point. */
  present(raid: RaidState): number {
    let n = 0;
    for (const id of raid.members) {
      const a = this.actors.actors.get(id);
      if (a && isAlive(a) && Math.hypot(a.x - raid.rallyX, a.y - raid.rallyY) < 5) n++;
    }
    return n;
  }

  update(ctx: SimContext): void {
    void ctx;
    for (const raid of [...this.sim.raids]) {
      raid.members = raid.members.filter((id) => this.pm.get(id)?.online);
      const area = this.world.entities.get('spawnAreas', raid.lairId);
      const tpl = area && this.world.entities.get('creatureTemplates', area.templateId);
      if (!area?.lair || !tpl) { this.endRaid(raid, 'abandoned'); continue; }
      const need = area.lair.minRaid;
      if (raid.phase === 'gathering') {
        const here = this.present(raid);
        const boss = this.bossOf(area.id);
        if (!boss || !isAlive(boss)) { if (this.now > raid.gatherUntil) this.endRaid(raid, 'abandoned'); continue; }
        const enough = here >= Math.min(raid.members.length, Math.max(need, raid.members.length - 1));
        const settle = this.now > raid.gatherUntil && here >= Math.ceil(need * 0.75);
        // Somebody walked too close and pulled early — everyone charges in.
        const early = !!boss.damagers && raid.members.some((id) => boss.damagers!.has(id));
        if ((enough && here >= need) || settle || early) {
          raid.phase = 'fighting';
          raid.fightStartedAt = this.now;
          for (const id of raid.members) this.replan(id);
          this.events.emit('raidPulled', { raid, clan: this.get(raid.clanId) ?? null, boss: tpl, present: here, early: early && !(enough && here >= need) });
        } else if (this.now > raid.gatherUntil || raid.members.length < Math.ceil(need * 0.75)) this.endRaid(raid, 'abandoned');
      } else if (raid.members.every((id) => raid.fallen.includes(id))) {
        this.wipe(raid);
      } else if (raid.fightStartedAt !== null && this.now - raid.fightStartedAt > RAID_FIGHT_MINUTES) {
        this.wipe(raid);
      }
    }
  }

  private onBossReset(boss: Actor): void {
    const raid = this.sim.raids.find((r) => r.lairId === boss.spawnAreaId && r.phase === 'fighting');
    if (raid) this.wipe(raid);
    else if (boss.spawnAreaId && this.world.entities.get('spawnAreas', boss.spawnAreaId)?.lair) this.lairStats(boss.spawnAreaId).wipes++;
  }

  private wipe(raid: RaidState): void {
    const clan = this.get(raid.clanId);
    this.lairStats(raid.lairId).wipes++;
    if (clan) { clan.raidWipes++; clan.drama = Math.min(100, clan.drama + 12); }
    const area = this.world.entities.get('spawnAreas', raid.lairId);
    const need = area?.lair?.minRaid ?? 1;
    this.record(raid, 'wipe');
    if (raid.attempt < MAX_ATTEMPTS && raid.members.length >= Math.ceil(need * 0.75)) {
      // "One more try, everyone run back!"
      raid.attempt++;
      raid.phase = 'gathering';
      raid.fightStartedAt = null;
      raid.fallen = [];
      raid.gatherUntil = this.now + RAID_GATHER_MINUTES;
      for (const id of raid.members) this.replan(id);
    } else {
      this.sim.raids = this.sim.raids.filter((r) => r !== raid);
      for (const id of raid.members) this.replan(id);
    }
  }

  /** Called by the player system when a boss dies, with everyone who took part. */
  onBossKilled(boss: Actor, raiders: PlayerState[], drops: Map<EntityId, ItemStack[]>): void {
    const areaId = boss.spawnAreaId;
    if (!areaId) return;
    const area = this.world.entities.get('spawnAreas', areaId);
    const tpl = this.actors.template(boss);
    if (!area?.lair || !tpl) return;
    const stats = this.lairStats(areaId);
    const raid = this.sim.raids.find((r) => r.lairId === areaId);
    const clan = this.get(raid?.clanId) ?? this.majorityClan(raiders);
    const worldFirst = !stats.firstKill;
    stats.kills++;
    stats.lastKillAt = this.now;
    if (worldFirst) stats.firstKill = { clanName: clan?.name ?? '', at: this.now };
    for (const p of raiders) this.pm.feel(p, 'raid', worldFirst ? 1.5 : 1);
    this.events.emit('raidMembers', { members: raiders.map((p) => p.id), level: tpl.level });
    this.sim.popularity = Math.min(100, this.sim.popularity + (worldFirst ? 3 : 0.5));
    if (clan) {
      clan.fame += tpl.level * 10 * (worldFirst ? 3 : 1);
      clan.raidWins++;
      clan.bossKills[tpl.id] = (clan.bossKills[tpl.id] ?? 0) + 1;
      clan.drama = Math.max(0, clan.drama - 10);
    }
    // Loot drama: someone grabs an epic the others wanted.
    for (const p of raiders) {
      const epic = (drops.get(p.id) ?? []).find((d) => { const it = this.world.entities.get('items', d.itemId); return it && (it.rarity === 'epic' || it.rarity === 'legendary'); });
      if (epic && raiders.length >= 3 && this.rand() < 0.35) {
        if (clan) clan.drama = Math.min(100, clan.drama + 15);
        for (const o of raiders) if (o !== p) this.pm.feel(o, 'drama', 0.5);
        this.events.emit('ninja', { clan: clan ?? null, player: p, itemId: epic.itemId });
        break;
      }
    }
    if (raid) {
      this.record(raid, 'win', raiders.length, worldFirst);
      this.sim.raids = this.sim.raids.filter((r) => r !== raid);
      for (const id of raid.members) this.replan(id);
    } else {
      this.pushRecord({ id: createId('rr'), clanId: clan?.id ?? null, clanName: clan?.name ?? '', bossName: tpl.name, lairId: areaId, result: 'win', at: this.now, members: raiders.length, minutes: 0, worldFirst });
    }
  }

  private majorityClan(players: PlayerState[]): Clan | undefined {
    const count = new Map<EntityId, number>();
    for (const p of players) if (p.clanId) count.set(p.clanId, (count.get(p.clanId) ?? 0) + 1);
    const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
    return top && top[1] * 2 >= players.length ? this.get(top[0]) : undefined;
  }

  private endRaid(raid: RaidState, result: 'abandoned'): void {
    this.record(raid, result);
    const clan = this.get(raid.clanId);
    if (clan) clan.drama = Math.min(100, clan.drama + 6);
    this.sim.raids = this.sim.raids.filter((r) => r !== raid);
    for (const id of raid.members) this.replan(id);
  }

  private record(raid: RaidState, result: RaidRecord['result'], members = raid.members.length, worldFirst = false): void {
    const area = this.world.entities.get('spawnAreas', raid.lairId);
    const tpl = area && this.world.entities.get('creatureTemplates', area.templateId);
    this.pushRecord({
      id: createId('rr'), clanId: raid.clanId, clanName: this.get(raid.clanId)?.name ?? '', bossName: tpl?.name ?? '?', lairId: raid.lairId,
      result, at: this.now, members, minutes: Math.round(this.now - (raid.fightStartedAt ?? raid.startedAt)), worldFirst,
    });
  }

  private pushRecord(rec: RaidRecord): void {
    this.sim.raidHistory.push(rec);
    if (this.sim.raidHistory.length > 60) this.sim.raidHistory.splice(0, this.sim.raidHistory.length - 60);
    this.events.emit('raidEnded', { record: rec });
  }

  dispose(): void {
    this.unsubs.forEach((u) => u());
  }
}
