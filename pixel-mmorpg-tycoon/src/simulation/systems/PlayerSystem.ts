import { addReport, guessCheat } from '@/data/community';
import { serviceBuilding, temples, TEMPLE_HEAL } from '@/data/buildings';
import type { EntityId } from '@/core/ids';
import { getObjectDef } from '@/data/objects';
import type { PlayerState } from '@/models/sim';
import type { ItemStack } from '@/models/rpg';
import { removeItem } from '@/systems/rpg/inventory';
import { rollLoot } from '@/systems/rpg/loot';
import { unlockedSkills } from '@/systems/rpg/progression';
import { dist, isAlive, type Actor } from '../actors/Actor';
import type { ActorManager } from '../actors/ActorManager';
import { combatStats, engage, respawn } from '../actors/combat';
import type { EconomyService } from '../economy/EconomyService';
import type { ClanService } from '../clans/ClanService';
import type { Activity, PlayerBrain } from '../players/PlayerBrain';
import type { PlayerManager } from '../players/PlayerManager';
import { GAME_MINUTES_PER_TICK } from '../time';
import type { SimContext, SimulationSystem } from '../types';

interface Mind { act: Activity | null; nextPlan: number; stuck: number; skillReady: Map<EntityId, number>; lastPotion: number; lastRegionCheck: number; portal?: { from: EntityId; to: EntityId } | null; pathFail?: { x: number; y: number; until: number } }

/** Max AI re-plans per tick (spreads the cost when hundreds of players are online). */
const PLANS_PER_TICK = 6;

/** Runs every online player: plans with the brain, then executes the chosen activity. */
export class PlayerSystem implements SimulationSystem {
  readonly id = 'players';
  private minds = new Map<string, Mind>();
  private unsub: () => void;

  constructor(private mgr: ActorManager, private pm: PlayerManager, private brain: PlayerBrain, private econ: EconomyService, private world: () => import('../WorldRuntime').WorldRuntime) {
    this.unsub = mgr.events.on('died', ({ victim, killer }) => this.onDeath(victim, killer));
  }

  mind(id: string): Mind {
    let m = this.minds.get(id);
    if (!m) { m = { act: null, nextPlan: 0, stuck: 0, skillReady: new Map(), lastPotion: 0, lastRegionCheck: 0 }; this.minds.set(id, m); }
    return m;
  }

  /** Group dungeons (players inside are out of the world for a while). */
  dungeons: { inside(): Set<string> } | null = null;
  /** Chat hook for pastimes ("caught a fish!", AFK…). */
  leisureEvent: ((p: PlayerState, what: string) => void) | null = null;
  /** Auction house (drop-only loot is listed there instead of sold to merchants). */
  auction: { isDropOnly(itemId: string): boolean } | null = null;
  /** Clans & raids (set by the session). */
  clans: ClanService | null = null;

  /** Send a player to a dungeon entrance (they stay until released). */
  joinDungeon(playerId: string, runId: string, x: number, y: number): void {
    const m = this.mind(playerId);
    m.act = { kind: 'dungeon', runId, x, y };
    m.nextPlan = Number.MAX_SAFE_INTEGER;
    const a = this.mgr.actors.get(playerId);
    if (a) { a.path = null; a.targetId = null; }
  }

  /** Send a player to a meetup (they stay until released). */
  joinMeetup(playerId: string, meetupId: string, x: number, y: number, cx: number, cy: number): void {
    const m = this.mind(playerId);
    m.act = { kind: 'meetup', meetupId, x, y, cx, cy };
    m.nextPlan = Number.MAX_SAFE_INTEGER;
    const a = this.mgr.actors.get(playerId);
    if (a) { a.path = null; a.targetId = null; }
  }

  /** Free for a meetup: not fighting, raiding, following or in PvP. */
  isFree(playerId: string): boolean {
    const a = this.mgr.actors.get(playerId);
    const k = this.minds.get(playerId)?.act?.kind;
    return !!a && !a.targetId && !['raid', 'follow', 'pvp', 'meetup', 'npc', 'trade', 'dungeon'].includes(k ?? '');
  }

  /** Make a player re-think right away (e.g. a raid formed or ended). */
  replan(playerId: string): void {
    const m = this.minds.get(playerId);
    if (m) { m.nextPlan = 0; m.act = null; }
  }

  activityOf(id: string): Activity | null {
    return this.minds.get(id)?.act ?? null;
  }

  // -------------------------------------------------------------- deaths
  /** XP multiplier for killing an event monster (set by the event system). */
  eventKill: (spawnAreaId: string | undefined, killer: Actor | null) => number = () => 1;

  /** Raid bosses: called with everyone who took part and what each of them looted. */
  bossKilled: (boss: Actor, raiders: PlayerState[], drops: Map<string, ItemStack[]>) => void = () => undefined;

  /** Everyone who fought a boss shares the kill: XP, gold, personal loot rolls and quest credit. */
  private rewardBoss(victim: Actor, killer: Actor | null, eventMult: number): void {
    const tpl = this.mgr.template(victim);
    if (!tpl) return;
    const ids = new Set<string>();
    for (const [id, tick] of victim.damagers ?? []) if (this.mgr.tick - tick <= 900) ids.add(id);
    if (killer) ids.add(killer.id);
    victim.damagers = null;
    const raiders: PlayerState[] = [];
    const drops = new Map<string, ItemStack[]>();
    for (const id of ids) {
      const actor = this.mgr.actors.get(id);
      const p = actor?.kind === 'player' ? this.pm.get(actor.defId) : undefined;
      if (!p) continue;
      raiders.push(p);
      if (actor === killer) p.stats.kills++;
      this.pm.gainXp(p, tpl.xpReward * (actor === killer ? 1 : 0.8) * eventMult);
      this.pm.questEvent(p, { type: 'kill', templateId: tpl.id, boss: true });
      this.pm.feel(p, 'combat', 2);
      if (tpl.goldReward) { p.gold += tpl.goldReward; p.stats.goldEarned += tpl.goldReward; }
      const got: ItemStack[] = [];
      for (const d of rollLoot(tpl.loot, () => this.mgr.rand())) {
        const n = this.pm.giveItem(p, d.itemId, d.qty);
        if (!n) continue;
        got.push({ itemId: d.itemId, qty: n });
        this.pm.questEvent(p, { type: 'collect', itemId: d.itemId, qty: n });
        const it = this.world().entities.get('items', d.itemId);
        if (it && it.rarity !== 'common') this.pm.feel(p, 'loot');
      }
      drops.set(p.id, got);
      this.pm.autoEquip(p);
    }
    this.bossKilled(victim, raiders, drops);
  }

  private onDeath(victim: Actor, killer: Actor | null): void {
    const eventMult = victim.kind === 'creature' ? this.eventKill(victim.spawnAreaId, killer) : 1;
    if (victim.kind === 'creature' && this.mgr.template(victim)?.boss) return this.rewardBoss(victim, killer, eventMult);
    // Everyone who helped (hit it in the last ~6 s) gets quest credit and a share of XP.
    if (victim.kind === 'creature' && victim.damagers) {
      const tpl = this.mgr.template(victim);
      for (const [id, tick] of victim.damagers) {
        if (id === killer?.id || this.mgr.tick - tick > 60) continue;
        const helper = this.mgr.actors.get(id);
        const hp = helper?.kind === 'player' ? this.pm.get(helper.defId) : undefined;
        if (!hp || !tpl) continue;
        this.pm.gainXp(hp, tpl.xpReward * 0.5 * eventMult);
        this.pm.questEvent(hp, { type: 'kill', templateId: tpl.id, boss: tpl.boss });
        this.pm.feel(hp, 'combat', 0.5);
      }
      victim.damagers = null;
    }
    if (killer?.kind === 'player') {
      const p = this.pm.get(killer.defId);
      if (!p) return;
      if (victim.kind === 'creature') {
        const tpl = this.mgr.template(victim);
        if (!tpl) return;
        p.stats.kills++;
        this.pm.feel(p, 'combat');
        this.pm.gainXp(p, tpl.xpReward * eventMult);
        this.pm.questEvent(p, { type: 'kill', templateId: tpl.id, boss: tpl.boss });
        for (const d of rollLoot(tpl.loot, () => this.mgr.rand())) {
          const got = this.pm.giveItem(p, d.itemId, d.qty);
          if (got) {
            this.pm.questEvent(p, { type: 'collect', itemId: d.itemId, qty: got });
            const it = this.world().entities.get('items', d.itemId);
            if (it && it.rarity !== 'common') this.pm.feel(p, 'loot');
          }
        }
        this.pm.autoEquip(p);
      } else if (victim.kind === 'player') {
        p.stats.pvpKills++;
        this.pm.feel(p, 'combat', 3);
        // Battleground kills are worth XP.
        if (this.brain.pvpRule(Math.floor(victim.x), Math.floor(victim.y)) === 'open') {
          const vp = this.pm.get(victim.defId);
          this.pm.gainXp(p, 15 * (vp?.level ?? 1));
        }
      }
    }
    if (victim.kind === 'player') {
      const p = this.pm.get(victim.defId);
      if (!p) return;
      p.stats.deaths++;
      p.gold = Math.floor(p.gold * 0.9); // banked gold is safe
      this.pm.feel(p, 'death');
      if (killer?.kind === 'player') {
        this.pm.feel(p, 'pvpKilled');
        const k = this.pm.get(killer.defId);
        // Victims of cheaters (or ganks inside safe zones) report the killer.
        if (k?.cheat) { this.pm.feel(p, 'cheaters'); addReport(k, guessCheat(k.cheat, () => this.mgr.rand())); }
        // Killed in a safe zone: "griefer!"
        else if (this.brain.isSafe(Math.floor(victim.x), Math.floor(victim.y)) && k) addReport(k, 'griefer');
      }
      else if (killer?.kind === 'creature' && (this.mgr.template(killer)?.level ?? 0) > p.level + 2) this.pm.feel(p, 'tooHard');
      this.pm.hunting.delete(p.id);
      const m = this.minds.get(victim.id);
      if (m) m.act = null;
    }
  }

  // -------------------------------------------------------------- tick
  update(ctx: SimContext): void {
    const mgr = this.mgr;
    mgr.tick = ctx.tick;
    let plans = PLANS_PER_TICK;
    for (const a of [...mgr.actors.values()]) {
      if (a.kind !== 'player') continue;
      const p = this.pm.get(a.defId);
      if (!p) { mgr.removeActor(a); continue; }
      const m = this.mind(a.id);

      if (this.dungeons?.inside().has(p.id)) { p.playMinutes += GAME_MINUTES_PER_TICK; continue; } // inside an instance
      if (a.state === 'dead') {
        if (mgr.gameMinutes >= a.respawnAt) {
          // Come back to life at the nearest temple (if any), otherwise at a spawn point.
          // Tenants come back to life at home.
          const home = this.pm.homeDoor(p);
          const sp = (home && this.mgr.randomWalkableNear(home.x, home.y + 1, 1.5)) ?? this.templeNear(a) ?? this.pm.spawnPoint();
          respawn(mgr, a, sp.x, sp.y);
          a.hp = Math.ceil(a.maxHp / 2);
          m.act = null;
        }
        continue;
      }
      if (a.attackCd > 0) a.attackCd--;
      if (a.hitFlash > 0) a.hitFlash--;
      p.playMinutes += GAME_MINUTES_PER_TICK;
      p.sessionLeft -= GAME_MINUTES_PER_TICK;

      const attacker = a.lastAttackerId ? mgr.actors.get(a.lastAttackerId) : undefined;
      const inCombat = !!(attacker && isAlive(attacker) && dist(a, attacker) < 8) || !!a.targetId;
      const stats = this.pm.stats(p);
      a.maxHp = stats.maxHp;
      if (a.hp > a.maxHp) a.hp = a.maxHp;

      // Regeneration (faster while resting).
      if (!inCombat && ctx.tick % 10 === 0) {
        const fast = m.act?.kind === 'rest' && !a.moving ? 4 : 1;
        a.hp = Math.min(a.maxHp, a.hp + Math.ceil(a.maxHp * 0.02 * fast));
        p.mana = Math.min(stats.maxMana, p.mana + Math.ceil(stats.maxMana * 0.04 * fast));
      }
      // Drink a potion / eat when low.
      if (a.hp < a.maxHp * 0.3 && ctx.tick - m.lastPotion > 30) this.heal(p, a, m, ctx.tick);
      // Mana potions when out of mana in a fight.
      if (inCombat && p.mana < stats.maxMana * 0.2 && ctx.tick - m.lastPotion > 30) this.drinkMana(p, m, ctx.tick, stats.maxMana);

      // Session over: log out once out of combat.
      // ("Just one more pull!" — raiders stay until the raid is over, within reason.)
      if (p.sessionLeft <= 0 && !inCombat && (p.sessionLeft < -180 || !this.clans?.raidOf(p.id))) {
        this.pm.hunting.delete(p.id);
        this.pm.logout(p);
        this.minds.delete(a.id);
        continue;
      }

      // Fight back when attacked.
      if (attacker && isAlive(attacker) && dist(a, attacker) < 8 && a.hp > a.maxHp * 0.15) {
        a.targetId = attacker.id;
      }
      const target = a.targetId ? mgr.actors.get(a.targetId) : undefined;
      if (target && isAlive(target)) {
        const cs = combatStats(mgr, a);
        if (cs) engage(mgr, a, target, cs, () => this.useSkill(p, m, ctx.tick));
        if (dist(a, target) > 14) a.targetId = null;
        continue;
      }
      a.targetId = null;
      if (attacker && !isAlive(attacker)) a.lastAttackerId = null;

      if (ctx.tick - m.lastRegionCheck > 20) { m.lastRegionCheck = ctx.tick; this.checkRegions(p, a); this.helpAllies(p, a, m, ctx.tick); this.templeHealing(p, a, ctx.tick); }

      if ((!m.act || ctx.tick >= m.nextPlan) && plans > 0) {
        plans--;
        m.act = this.brain.plan(p, a, m.act);
        m.nextPlan = ctx.tick + 120 + Math.floor(mgr.rand() * 80);
        m.stuck = 0;
        a.path = null;
        if (m.act.kind === 'hunt') { this.pm.hunting.set(p.id, m.act.areaId); this.formGroup(p, a, ctx.tick); }
        else this.pm.hunting.delete(p.id);
      }
      if (m.act) this.execute(p, a, m, ctx.tick, stats.maxMana);
    }
  }

  /** Group chat hook (leader asks, friends answer). */
  groupEvent: ((leader: PlayerState, members: PlayerState[]) => void) | null = null;

  /** Who follows whom (runtime only). */
  private followerMap = new Map<string, string[]>();
  private followerTick = -1;

  private followers(leaderId: string): string[] {
    if (this.followerTick !== this.mgr.tick) {
      this.followerTick = this.mgr.tick;
      this.followerMap.clear();
      for (const [id, m] of this.minds) if (m.act?.kind === 'follow') {
        const list = this.followerMap.get(m.act.leaderId);
        if (list) list.push(id); else this.followerMap.set(m.act.leaderId, [id]);
      }
    }
    return this.followerMap.get(leaderId) ?? [];
  }

  /** A player heading out to hunt invites nearby players of a similar level. */
  private formGroup(p: PlayerState, a: Actor, tick: number): void {
    if (this.mgr.rand() > 0.15 || this.clans?.raidOf(p.id)) return;
    const members: PlayerState[] = [];
    for (const o of this.mgr.spatial.query(a.x, a.y, 9)) {
      if (members.length >= 2 || o.kind !== 'player' || o.id === a.id || !isAlive(o) || o.targetId) continue;
      const q = this.pm.get(o.defId);
      const om = this.minds.get(o.id);
      const busy = om?.act && !['hunt', 'idle', 'social', 'leisure'].includes(om.act.kind);
      if (!q || busy || Math.abs(q.level - p.level) > 3 || this.clans?.raidOf(q.id) || this.followers(o.id).length || this.pm.availableQuests(q).length) continue;
      const friendly = (q.clanId && q.clanId === p.clanId) || p.friends?.includes(q.id) ? 0.8 : 0.35;
      if (this.mgr.rand() > friendly) continue;
      const mind = this.mind(o.id);
      mind.act = { kind: 'follow', leaderId: a.id, ticks: 0 };
      this.followerTick = -1;
      mind.nextPlan = tick + 400;
      o.path = null;
      members.push(q);
    }
    if (members.length) {
      this.groupEvent?.(p, members);
      for (const q of members) if (this.mgr.rand() < 0.3) this.pm.befriend(p, q);
    }
  }

  /** Heal hurt group mates (healers) and rescue allies that are about to die. */
  private helpAllies(p: PlayerState, a: Actor, m: Mind, tick: number): void {
    const groupIds = new Set<string>();
    if (m.act?.kind === 'follow') { groupIds.add(m.act.leaderId); for (const f of this.followers(m.act.leaderId)) groupIds.add(f); }
    for (const f of this.followers(a.id)) groupIds.add(f);
    const cls = this.pm.classDef(p);
    const healSkill = unlockedSkills(cls, this.pm.skillLevel(p)).find((s) => s.kind === 'heal' && s.manaCost <= p.mana && (m.skillReady.get(s.id) ?? 0) <= tick);
    for (const o of this.mgr.spatial.query(a.x, a.y, 7)) {
      if (o.kind !== 'player' || o.id === a.id || !isAlive(o) || o.hp > o.maxHp * 0.45) continue;
      const q = this.pm.get(o.defId);
      const ally = groupIds.has(o.id) || (q?.clanId && q.clanId === p.clanId);
      if (!ally) continue;
      if (healSkill) {
        p.mana -= healSkill.manaCost;
        const amount = Math.min(o.maxHp - o.hp, Math.round((o.maxHp * healSkill.power) / 100));
        o.hp += amount;
        m.skillReady.set(healSkill.id, tick + healSkill.cooldown * 10);
        a.castUntil = tick + 10;
        this.mgr.events.emit('heal', { target: o, healer: a, amount });
        return;
      }
      // Rescue: jump on whatever is hitting them.
      const enemy = o.lastAttackerId ? this.mgr.actors.get(o.lastAttackerId) : undefined;
      if (enemy && isAlive(enemy) && enemy.kind === 'creature' && !a.targetId && a.hp > a.maxHp * 0.4) { a.targetId = enemy.id; return; }
    }
  }

  private drinkMana(p: PlayerState, m: Mind, tick: number, maxMana: number): void {
    const items = this.world().entities;
    const pot = p.inventory.map((s) => items.get('items', s.itemId)).find((it) => it && (it.stats.restoreMana ?? 0) > 0);
    if (!pot) return;
    p.inventory = removeItem(p.inventory, pot.id, 1).inv;
    p.mana = Math.min(maxMana, p.mana + (pot.stats.restoreMana ?? 0));
    m.lastPotion = tick;
  }

  private templeHealers: { x: number; y: number }[] = [];
  private templeHealersAt = -1e9;

  /** Healers who live by a temple heal hurt players walking past. */
  private templeHealing(p: PlayerState, a: Actor, tick: number): void {
    if (tick - this.templeHealersAt > 200) {
      this.templeHealersAt = tick;
      const w = this.world();
      this.templeHealers = w.entities.list('npcs').filter((n) => n.type === 'healer' && serviceBuilding(w, n))
        .map((n) => this.mgr.actors.get(n.id)).filter((x): x is Actor => !!x && isAlive(x)).map((x) => ({ x: x.x, y: x.y }));
    }
    if (a.hp >= a.maxHp || a.targetId) return;
    for (const h of this.templeHealers) {
      if (Math.hypot(h.x - a.x, h.y - a.y) > 5) continue;
      const amount = Math.min(a.maxHp - a.hp, Math.ceil(a.maxHp * TEMPLE_HEAL));
      a.hp += amount;
      this.mgr.events.emit('heal', { target: a, healer: a, amount });
      this.pm.feel(p, 'social', 0.2);
      return;
    }
  }

  private templeNear(a: Actor): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null, bd = Infinity;
    for (const t of temples(this.world())) {
      const d = Math.hypot(t.x - a.x, t.y - a.y);
      if (d < bd) { const s = this.mgr.randomWalkableNear(t.x, t.y + 1, 1.5); if (s) { bd = d; best = s; } }
    }
    return best;
  }

  /** Chat hook when a trainer teaches new skills. */
  trained: ((p: PlayerState) => void) | null = null;

  private heal(p: PlayerState, a: Actor, m: Mind, tick: number): void {
    const items = this.world().entities;
    const healers = p.inventory.map((s) => items.get('items', s.itemId)).filter((it) => it && (it.stats.heal ?? 0) > 0 && (it.category === 'potion' || it.category === 'food'));
    const best = healers.sort((x, y) => (y!.stats.heal ?? 0) - (x!.stats.heal ?? 0))[0];
    if (best) {
      p.inventory = removeItem(p.inventory, best.id, 1).inv;
      a.hp = Math.min(a.maxHp, a.hp + (best.stats.heal ?? 0));
      m.lastPotion = tick;
      return;
    }
    const cls = this.pm.classDef(p);
    const skill = unlockedSkills(cls, this.pm.skillLevel(p)).find((s) => s.kind === 'heal' && s.manaCost <= p.mana && (m.skillReady.get(s.id) ?? 0) <= tick);
    if (skill) {
      p.mana -= skill.manaCost;
      a.hp = Math.min(a.maxHp, a.hp + Math.round((a.maxHp * skill.power) / 100));
      m.skillReady.set(skill.id, tick + skill.cooldown * 10);
      m.lastPotion = tick;
    }
  }

  /** Called on each attack: spend mana on the strongest ready attack skill. Returns damage multiplier. */
  private useSkill(p: PlayerState, m: Mind, tick: number): number {
    const cls = this.pm.classDef(p);
    const known = unlockedSkills(cls, this.pm.skillLevel(p));
    // Buffs (War Cry…) first: +power% damage for a while.
    const buff = known.find((s) => s.kind === 'buff' && s.manaCost <= p.mana && (m.skillReady.get(s.id) ?? 0) <= tick && (p.buffUntil ?? 0) <= tick);
    if (buff) {
      p.mana -= buff.manaCost;
      p.buffUntil = tick + 150;
      p.buffPower = buff.power;
      m.skillReady.set(buff.id, tick + buff.cooldown * 10);
      const actor = this.mgr.actors.get(p.id);
      if (actor) { actor.castUntil = tick + 10; this.mgr.events.emit('heal', { target: actor, healer: actor, amount: 0 }); }
    }
    const skill = known
      .filter((s) => s.kind === 'attack' && s.manaCost <= p.mana && (m.skillReady.get(s.id) ?? 0) <= tick)
      .sort((a, b) => b.power - a.power)[0];
    if (!skill) return 1;
    const actor = this.mgr.actors.get(p.id);
    if (actor) actor.castUntil = tick + 8;
    p.mana -= skill.manaCost;
    m.skillReady.set(skill.id, tick + skill.cooldown * 10);
    return skill.power;
  }

  private checkRegions(p: PlayerState, a: Actor): void {
    const x = Math.floor(a.x), y = Math.floor(a.y);
    for (const r of this.world().entities.list('regions')) {
      if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) continue;
      if (!p.visitedRegions.includes(r.id)) {
        p.visitedRegions.push(r.id);
        this.pm.feel(p, 'explore');
      }
      this.pm.questEvent(p, { type: 'explore', regionId: r.id });
    }
  }

  /** Linked portal pairs (both directions). */
  private portals(): { from: { id: EntityId; x: number; y: number }; to: { id: EntityId; x: number; y: number } }[] {
    const s = this.world().entities;
    const out: { from: { id: EntityId; x: number; y: number }; to: { id: EntityId; x: number; y: number } }[] = [];
    for (const o of s.list('objects')) {
      if (o.kind !== 'portal' || !o.linkId) continue;
      const d = s.get('objects', o.linkId);
      if (d) out.push({ from: { id: o.id, x: o.x, y: o.y }, to: { id: d.id, x: d.x, y: d.y } });
    }
    return out;
  }

  /** A portal shortcut worth taking (or any portal when the goal can't be reached on foot). */
  private portalRoute(a: Actor, x: number, y: number, anyway: boolean): { from: EntityId; to: EntityId } | null {
    const direct = Math.hypot(a.x - x, a.y - y);
    let best: { from: EntityId; to: EntityId } | null = null;
    let bestCost = anyway ? Infinity : direct * 0.7;
    for (const p of this.portals()) {
      const cost = Math.hypot(a.x - p.from.x, a.y - p.from.y) + Math.hypot(p.to.x - x, p.to.y - y) + 2;
      if (cost < bestCost) { bestCost = cost; best = { from: p.from.id, to: p.to.id }; }
    }
    return best;
  }

  /** Walk to the portal, then step through to the linked one. */
  private usePortal(a: Actor, m: Mind, speed: number): void {
    const s = this.world().entities;
    const src = s.get('objects', m.portal!.from), dst = s.get('objects', m.portal!.to);
    if (!src || !dst) { m.portal = null; return; }
    if (Math.hypot(a.x - (src.x + 0.5), a.y - (src.y + 0.5)) <= 0.9) {
      const out = this.mgr.randomWalkableNear(dst.x + 0.5, dst.y + 1.5, 1.5) ?? { x: dst.x, y: dst.y };
      this.mgr.events.emit('portal', { actor: a, fromX: src.x, fromY: src.y, toX: dst.x, toY: dst.y });
      this.mgr.teleport(a, out.x, out.y);
      a.path = null;
      m.portal = null;
      return;
    }
    if (!a.path || a.goalX !== src.x || a.goalY !== src.y) {
      if (!this.mgr.goTo(a, src.x, src.y, 6000)) { m.portal = null; return; }
    }
    a.state = 'walk';
    this.mgr.step(a, speed);
  }

  /** Walk towards a point (through portals when that is shorter); true when within `reach`. */
  private moveTo(a: Actor, x: number, y: number, speed: number, reach = 1.5): boolean {
    if (Math.hypot(a.x - (x + 0.5), a.y - (y + 0.5)) <= reach) { a.moving = false; a.path = null; return true; }
    const m = this.mind(a.id);
    if (m.portal) { this.usePortal(a, m, speed); return false; }
    if (!a.path || a.goalX !== x || a.goalY !== y) {
      // Don't hammer the pathfinder with a goal that just failed (e.g. another island).
      if (m.pathFail && m.pathFail.x === x && m.pathFail.y === y && this.mgr.tick < m.pathFail.until) return false;
      const shortcut = Math.hypot(a.x - x, a.y - y) > 20 ? this.portalRoute(a, x, y, false) : null;
      if (shortcut) { m.portal = shortcut; return false; }
      if (!this.mgr.goTo(a, x, y, 6000)) {
        m.pathFail = { x, y, until: this.mgr.tick + 20 };
        const any = this.portalRoute(a, x, y, true);
        if (any) m.portal = any;
        return false;
      }
    }
    a.state = 'walk';
    this.mgr.step(a, speed);
    return false;
  }

  private done(m: Mind, tick: number): void {
    m.nextPlan = tick;
  }

  private execute(p: PlayerState, a: Actor, m: Mind, tick: number, maxMana: number): void {
    const act = m.act!;
    const speed = combatStats(this.mgr, a)?.speed ?? 1.6;
    const world = this.world();
    void maxMana;
    switch (act.kind) {
      case 'hunt': {
        const area = world.entities.get('spawnAreas', act.areaId);
        if (!area) return this.done(m, tick);
        if (tick % 5 === 0) {
          const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
          const r = Math.max(area.w, area.h) / 2 + 4;
          let best: Actor | undefined;
          let bd = Infinity;
          for (const o of this.mgr.spatial.query(cx, cy, r)) {
            if (o.kind !== 'creature' || !isAlive(o) || (act.templateId && o.defId !== act.templateId)) continue;
            const d = dist(a, o);
            if (d < bd) { bd = d; best = o; }
          }
          if (best) { a.targetId = best.id; m.stuck = 0; return; }
        }
        // Nothing to fight right now: walk into the area and wait.
        m.stuck++;
        const unreachable = act.spot && m.pathFail && m.pathFail.x === act.spot.x && m.pathFail.y === act.spot.y && this.mgr.tick < m.pathFail.until;
        if (!act.spot || unreachable || (!a.path && !m.portal && this.mgr.rand() < 0.05)) act.spot = this.mgr.randomTileInArea(area) ?? undefined;
        if (act.spot && !this.moveTo(a, act.spot.x, act.spot.y, speed, 1.5)) { if (!a.path && !m.portal) a.state = 'idle'; }
        else a.state = 'idle';
        if (m.stuck > 160) { this.pm.feel(p, 'crowded'); this.done(m, tick); }
        return;
      }
      case 'gather': {
        if (!act.objectId || !world.entities.get('objects', act.objectId)) {
          let best: { id: string; d: number } | null = null;
          for (const o of world.entities.list('objects')) {
            if (!act.kinds.includes(o.kind)) continue;
            const d = Math.hypot(o.x - a.x, o.y - a.y) + this.mgr.rand() * 6;
            if (!best || d < best.d) best = { id: o.id, d };
          }
          if (!best) { this.pm.feel(p, 'boredom'); return this.done(m, tick); }
          act.objectId = best.id;
        }
        const obj = world.entities.get('objects', act.objectId)!;
        const def = getObjectDef(obj.kind);
        const tx = obj.x + Math.floor((def?.w ?? 1) / 2), ty = obj.y + (def?.h ?? 1);
        if (!this.moveTo(a, tx, ty, speed, 1.6)) {
          if (!a.path && ++m.stuck > 40) { act.objectId = undefined; m.stuck = 0; }
          return;
        }
        a.state = 'idle';
        if (++act.timer >= 30) {
          act.timer = 0;
          if (this.pm.giveItem(p, act.itemId, 1) === 0) return this.done(m, tick);
          this.pm.questEvent(p, { type: 'gather', itemId: act.itemId, qty: 1 });
          this.pm.feel(p, 'trade', 0.3);
          if (++act.done >= 5) { act.objectId = undefined; if (this.mgr.rand() < 0.5) this.done(m, tick); }
        }
        return;
      }
      case 'npc': {
        const npc = this.mgr.actors.get(act.npcId);
        if (!npc || !isAlive(npc)) return this.done(m, tick);
        if (!this.moveTo(a, Math.floor(npc.x), Math.floor(npc.y), speed, 1.6)) { if (!a.path && ++m.stuck > 30) this.done(m, tick); return; }
        a.state = 'idle';
        if (act.purpose === 'accept') {
          for (const q of this.pm.availableQuests(p).filter((q) => q.giverId === act.npcId).slice(0, 3)) this.pm.acceptQuest(p, q);
        } else if (act.purpose === 'turnin' && act.questId) this.pm.turnIn(p, act.questId);
        else if (act.purpose === 'talk') this.pm.questEvent(p, { type: 'talk', npcId: act.npcId });
        else if (act.purpose === 'bank') { const keep = 40; if (p.gold > keep) { p.bank = (p.bank ?? 0) + p.gold - keep; p.gold = keep; } }
        else if (act.purpose === 'train') {
          p.trainedLevel = p.level;
          this.pm.feel(p, 'levelup', 0.3);
          // A trainer at the tavern also gives a lesson: bonus XP.
          const npc = world.entities.get('npcs', act.npcId);
          if (npc && serviceBuilding(world, npc)) this.pm.gainXp(p, p.level * 30);
          this.trained?.(p);
        }
        else if (act.purpose === 'deliver' && act.questId) {
          const q = world.entities.get('quests', act.questId);
          for (const o of q?.objectives ?? []) if (o.type === 'deliver' && o.targetId && o.receiverId === act.npcId)
            this.pm.questEvent(p, { type: 'deliver', npcId: act.npcId, itemId: o.targetId, qty: this.pm.countItem(p, o.targetId) });
        }
        this.pm.feel(p, 'social');
        return this.done(m, tick);
      }
      case 'trade': {
        const merchant = this.mgr.actors.get(act.merchantId);
        if (!merchant || !isAlive(merchant)) return this.done(m, tick);
        if (!this.moveTo(a, Math.floor(merchant.x), Math.floor(merchant.y), speed, 1.6)) { if (!a.path && ++m.stuck > 30) this.done(m, tick); return; }
        a.state = 'idle';
        const trader = this.pm.trader(p);
        let traded = false;
        for (const s of this.econ.sellable({ inventory: p.inventory })) {
          const it = world.entities.get('items', s.itemId);
          if (it && ((it.stats.heal ?? 0) > 0)) continue; // keep healing items
          if (it && it.slot !== 'none' && it.levelReq > p.level) continue; // keep future gear
          if (this.auction?.isDropOnly(s.itemId)) continue; // rare loot goes to the auction house
          if (this.econ.sellToMerchant(trader, act.merchantId, s.itemId, s.qty) > 0) traded = true;
        }
        if (act.buyItemId) {
          const it = world.entities.get('items', act.buyItemId);
          const want = it && it.category === 'potion' ? 3 : 1;
          if (this.econ.buyFromMerchant(trader, act.merchantId, act.buyItemId, want) > 0) { traded = true; this.pm.questEvent(p, { type: 'collect', itemId: act.buyItemId, qty: want }); }
          else this.pm.feel(p, p.gold < 20 ? 'poor' : 'expensive');
          this.pm.autoEquip(p);
        }
        if (traded) this.pm.feel(p, 'trade');
        return this.done(m, tick);
      }
      case 'explore': {
        if (this.moveTo(a, act.x, act.y, speed, 2) || (!a.path && ++m.stuck > 40)) this.done(m, tick);
        return;
      }
      case 'rest': {
        if (!this.moveTo(a, act.x, act.y, speed, 2)) { if (!a.path && ++m.stuck > 40) this.done(m, tick); return; }
        a.state = 'idle';
        // At home: put gold into the personal storage, safe from death.
        const home = this.pm.homeDoor(p);
        if (home && Math.hypot(a.x - home.x, a.y - home.y) < 3 && p.gold > 60) { p.bank = (p.bank ?? 0) + p.gold - 60; p.gold = 60; }
        if (a.hp >= a.maxHp * 0.9) this.done(m, tick);
        return;
      }
      case 'social': {
        if (!this.moveTo(a, act.x, act.y, speed * 0.8, 3)) { if (!a.path && ++m.stuck > 40) this.done(m, tick); return; }
        a.state = 'idle';
        if (++act.ticks % 60 === 0) this.pm.feel(p, 'social');
        if (act.ticks > 180) this.done(m, tick);
        return;
      }
      case 'pvp': {
        const t = this.mgr.actors.get(act.targetId);
        if (!t || !isAlive(t) || ++act.ticks > 250 || !this.brain.mayAttack(p, Math.floor(t.x), Math.floor(t.y))) return this.done(m, tick);
        a.targetId = t.id;
        return;
      }
      case 'raid': {
        const raid = this.clans?.raid(act.raidId);
        if (!raid || !raid.members.includes(p.id)) return this.done(m, tick);
        if (raid.phase === 'gathering') {
          if (this.moveTo(a, raid.rallyX, raid.rallyY, speed, 2.5)) { a.state = 'idle'; m.stuck = 0; }
          else if (!a.path && ++m.stuck > 60) { m.stuck = 0; a.path = null; }
          return;
        }
        const boss = this.clans!.bossOf(raid.lairId);
        // The fallen wait at the rally point until the next attempt ("the doors are closed").
        const out = raid.fallen.includes(p.id);
        if (boss && isAlive(boss) && !out) {
          // Path to the rally point first if far away, then charge in.
          const farFromRally = Math.hypot(a.x - raid.rallyX, a.y - raid.rallyY) > 4;
          if (farFromRally && dist(a, boss) > 10) { if (!this.moveTo(a, raid.rallyX, raid.rallyY, speed, 2.5) && !a.path && ++m.stuck > 60) m.stuck = 0; return; }
          a.targetId = boss.id;
          return;
        }
        if (out && !this.moveTo(a, raid.rallyX, raid.rallyY, speed, 2.5)) return;
        a.state = 'idle';
        return;
      }
      case 'leisure': {
        if (!this.moveTo(a, act.x, act.y, act.action === 'sightsee' ? speed * 0.7 : speed, act.action === 'fish' ? 0.9 : 1.4)) { if (!a.path && ++m.stuck > 40) this.done(m, tick); return; }
        a.state = 'idle';
        act.ticks++;
        if (act.action === 'fish' && act.ticks % 80 === 0 && this.mgr.rand() < 0.45) {
          const fish = world.entities.list('items').find((i) => i.key === 'fish');
          if (fish && this.pm.giveItem(p, fish.id, 1)) { this.pm.feel(p, 'loot', 0.4); this.leisureEvent?.(p, 'caught'); }
        }
        if (act.ticks % 90 === 0) this.pm.feel(p, act.action === 'sightsee' ? 'explore' : 'social', 0.3);
        if (act.ticks === 1) this.leisureEvent?.(p, act.action);
        if (act.ticks > act.duration) this.done(m, tick);
        return;
      }
      case 'dungeon': {
        if (!this.moveTo(a, act.x, act.y, speed, 1.2)) { if (!a.path && ++m.stuck > 60) { m.stuck = 0; a.path = null; } return; }
        a.state = 'idle';
        return;
      }
      case 'meetup': {
        if (!this.moveTo(a, act.x, act.y, speed, 0.9)) { if (!a.path && ++m.stuck > 60) { m.stuck = 0; a.path = null; } return; }
        a.state = 'idle';
        a.facing = act.cx >= a.x ? 1 : -1;
        return;
      }
      case 'follow': {
        const leader = this.mgr.actors.get(act.leaderId);
        if (!leader || !isAlive(leader) || ++act.ticks > 400) return this.done(m, tick);
        // Help the leader fight.
        if (leader.targetId && this.mgr.actors.get(leader.targetId)?.kind === 'creature') { a.targetId = leader.targetId; return; }
        if (dist(a, leader) > 2.5) {
          if (!a.path || Math.hypot(a.goalX - leader.x, a.goalY - leader.y) > 3) this.mgr.goTo(a, Math.floor(leader.x), Math.floor(leader.y), 2000);
          if (a.path) { a.state = 'walk'; this.mgr.step(a, speed * 1.05); } else this.mgr.stepToward(a, leader.x, leader.y, speed, 1.5);
        } else { a.state = 'idle'; a.moving = false; a.path = null; }
        return;
      }
      case 'idle': {
        a.state = 'idle';
        if (++act.ticks > 60) { this.pm.feel(p, 'boredom', 0.3); this.done(m, tick); }
        return;
      }
    }
  }

  dispose(): void {
    this.unsub();
  }
}
