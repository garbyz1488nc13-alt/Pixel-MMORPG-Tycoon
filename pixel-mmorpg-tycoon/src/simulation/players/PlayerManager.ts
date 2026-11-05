import { createId, type EntityId } from '@/core/ids';
import { EventBus } from '@/core/EventBus';
import { BEHAVIORS, CLASS_SHARES, FACTORS, getBehavior, playerName } from '@/data/playerTypes';
import { itemKeyIndex } from '@/data/rpgDefaults';
import { getTier } from '@/data/studio';
import { doorTile } from '@/data/furniture';
import type { ClassDef, EquipSlot, ItemDef, QuestDef } from '@/models/rpg';
import type { FactorKey, PlayerBehavior, PlayerState } from '@/models/sim';
import { addItem, countItem, removeItem } from '@/systems/rpg/inventory';
import { characterStats, xpToNext, type CharacterStats } from '@/systems/rpg/progression';
import { objectiveDelta, type QuestEvent } from '@/systems/rpg/quests';
import type { ActorManager } from '../actors/ActorManager';
import { newActor, type Actor } from '../actors/Actor';
import type { EconomyService, Trader } from '../economy/EconomyService';
import type { WorldRuntime } from '../WorldRuntime';

export const BAG_SLOTS = 24;
const RANGED = new Set(['mage', 'archer']);
const STARTER_GEAR: Record<string, string[]> = {
  warrior: ['wooden_sword', 'leather_tunic'], mage: ['oak_staff'], archer: ['hunting_bow'], rogue: ['rogue_dagger'], paladin: ['wooden_sword', 'leather_cap'],
};

export type PlayerEvents = {
  joined: { player: PlayerState; returning: boolean };
  left: { player: PlayerState; quit: boolean; reason: FactorKey | null };
  levelUp: { player: PlayerState; level: number };
  questDone: { player: PlayerState; quest: QuestDef; paid: number };
  turnedAway: { count: number };
  /** Empty start: the servers opened. */
  launched: { count: number };
};

/** Gold a new player starts with (enough for a couple of basic armour pieces). */
export const STARTING_PLAYER_GOLD = 80;

/** World difficulty: how quickly unhappy players quit, and how forgiving their mood is. */
export const CHURN_BY_DIFFICULTY: Record<string, number> = { relaxed: 0.6, normal: 1, hard: 1.4, brutal: 1.9 };
export const MOOD_BY_DIFFICULTY: Record<string, number> = { relaxed: 0.75, normal: 1, hard: 1.2, brutal: 1.4 };

/** Churn multiplier for clan members. */
export const CLAN_LOYALTY = 0.6;

const pick = <T,>(items: [T, number][], r: number): T => {
  let acc = 0;
  for (const [v, w] of items) { acc += w; if (r <= acc) return v; }
  return items[items.length - 1][0];
};

/**
 * Owns the player population: arrivals, sessions, churn, levels, inventory, quests
 * and satisfaction. PlayerState lives in world.sim (saved); online players also get an Actor.
 */
export class PlayerManager {
  readonly events = new EventBus<PlayerEvents>();
  private byId = new Map<EntityId, PlayerState>();

  constructor(private world: WorldRuntime, private actors: ActorManager, private econ: EconomyService) {
    this.reindex();
    actors.playerStats = (a) => this.combatStats(a);
    world.events.on('rpg:changed', () => this.rpgRev++);
    actors.playerName = (a) => this.byId.get(a.defId)?.name ?? '?';
    for (const p of this.world.sim.players) if (p.online) this.spawnActor(p, p.x, p.y);
  }

  private reindex(): void {
    this.byId = new Map(this.world.sim.players.map((p) => [p.id, p]));
  }

  get(id: EntityId): PlayerState | undefined {
    return this.byId.get(id);
  }

  online(): PlayerState[] {
    return this.world.sim.players.filter((p) => p.online);
  }

  capacity(): number {
    const s = this.world.studio;
    return this.world.config.gameMode === 'standard' ? getTier(s.serverTier).maxOnline : s.sandboxMaxOnline;
  }

  private get rand() {
    return () => this.actors.rand();
  }

  // ------------------------------------------------------------ stats
  classDef(p: PlayerState): ClassDef {
    const classes = this.world.rpg.progression.classes;
    return classes.find((c) => c.key === p.classKey) ?? classes[0];
  }

  equipped(p: PlayerState): ItemDef[] {
    return Object.values(p.equipment).map((id) => (id ? this.world.entities.get('items', id) : undefined)).filter((x): x is ItemDef => !!x);
  }

  private statsCache = new WeakMap<PlayerState, { key: string; stats: CharacterStats }>();
  private rpgRev = 0;

  /** Derived stats, cached until level, class, equipment, items or progression change. */
  stats(p: PlayerState): CharacterStats {
    const e = p.equipment as Record<string, string | undefined>;
    let key = `${this.rpgRev}|${this.world.entities.colVersion.items}|${p.classKey}|${p.level}`;
    for (const k in e) key += '|' + (e[k] ?? '');
    const hit = this.statsCache.get(p);
    if (hit && hit.key === key) return hit.stats;
    const stats = characterStats(this.classDef(p), p.level, this.world.rpg.progression, this.equipped(p));
    this.statsCache.set(p, { key, stats });
    return stats;
  }

  private combatStats(a: Actor) {
    const p = this.byId.get(a.defId);
    if (!p) return null;
    const s = this.stats(p);
    const dmgHack = (p.cheat === 'damage' ? 3 : p.cheat === 'griefer' ? 2 : 1) * ((p.buffUntil ?? 0) > this.actors.tick ? 1 + (p.buffPower ?? 0) / 100 : 1);
    const speedHack = p.cheat === 'speed' ? 2.5 : 1;
    return { damage: s.attack * dmgHack, defense: s.defense, attackRange: RANGED.has(p.classKey) ? 3.2 : 1.3, speed: (1.6 + Math.min(1, s.agi / 60)) * speedHack };
  }

  /** Items rating for equipment comparison. */
  itemScore(it: ItemDef): number {
    const st = it.stats;
    return (st.attack ?? 0) * 2 + (st.defense ?? 0) * 2 + (st.str ?? 0) + (st.agi ?? 0) + (st.int ?? 0) + (st.vit ?? 0) + (st.hp ?? 0) / 10 + (st.mana ?? 0) / 15;
  }

  /** Equip anything in the bag that beats what's worn. Returns true if something changed. */
  autoEquip(p: PlayerState): boolean {
    let changed = false;
    for (const s of [...p.inventory]) {
      const it = this.world.entities.get('items', s.itemId);
      if (!it || it.slot === 'none' || it.levelReq > p.level) continue;
      const curId = p.equipment[it.slot];
      const cur = curId ? this.world.entities.get('items', curId) : undefined;
      if (cur && this.itemScore(cur) >= this.itemScore(it)) continue;
      p.inventory = removeItem(p.inventory, it.id, 1).inv;
      if (cur) p.inventory = addItem(p.inventory, cur.id, 1, (id) => this.world.entities.get('items', id), BAG_SLOTS).inv;
      p.equipment[it.slot as EquipSlot] = it.id;
      changed = true;
    }
    return changed;
  }

  trader(p: PlayerState): Trader {
    return { id: p.id, name: p.name, getInventory: () => p.inventory, getGold: () => p.gold, set: (inv, gold) => { if (gold > p.gold) p.stats.goldEarned += gold - p.gold; p.inventory = inv; p.gold = gold; } };
  }

  giveItem(p: PlayerState, itemId: EntityId, qty: number): number {
    const res = addItem(p.inventory, itemId, qty, (id) => this.world.entities.get('items', id), BAG_SLOTS);
    p.inventory = res.inv;
    return qty - res.leftover;
  }

  // ------------------------------------------------------- satisfaction
  feel(p: PlayerState, key: FactorKey, times = 1): void {
    // Harder worlds: bad experiences hurt more, good ones help less.
    const diff = MOOD_BY_DIFFICULTY[this.world.config.difficulty] ?? 1;
    const d = FACTORS[key].delta * times * (FACTORS[key].positive ? 2 - diff : diff);
    p.factors[key] = (p.factors[key] ?? 0) + d;
    p.satisfaction = Math.max(0, Math.min(100, p.satisfaction + d));
  }

  /** The factor that hurt this player most (for logs & reviews). */
  worstFactor(p: PlayerState): FactorKey | null {
    let worst: FactorKey | null = null;
    let v = 0;
    for (const [k, x] of Object.entries(p.factors) as [FactorKey, number][]) if (x < v) { v = x; worst = k; }
    return worst;
  }

  bestFactor(p: PlayerState): FactorKey | null {
    let best: FactorKey | null = null;
    let v = 0;
    for (const [k, x] of Object.entries(p.factors) as [FactorKey, number][]) if (x > v) { v = x; best = k; }
    return best;
  }

  // --------------------------------------------------------- progress
  /** Global XP multiplier (e.g. Double XP events). */
  xpMultiplier: () => number = () => 1;

  gainXp(p: PlayerState, amount: number): void {
    const prog = this.world.rpg.progression;
    p.xp += Math.max(0, Math.round(amount * this.xpMultiplier()));
    while (p.level < prog.maxLevel && p.xp >= xpToNext(p.level, prog)) {
      p.xp -= xpToNext(p.level, prog);
      p.level++;
      this.feel(p, 'levelup');
      const a = this.actors.actors.get(p.id);
      const s = this.stats(p);
      p.hp = s.maxHp;
      p.mana = s.maxMana;
      if (a) { a.maxHp = s.maxHp; a.hp = s.maxHp; }
      this.autoEquip(p);
      this.events.emit('levelUp', { player: p, level: p.level });
    }
    if (p.level >= prog.maxLevel) p.xp = 0;
  }

  /** Feed a quest event into the player's active quests. */
  questEvent(p: PlayerState, e: QuestEvent): void {
    for (const pq of p.quests) {
      if (pq.status !== 'active') continue;
      const q = this.world.entities.get('quests', pq.questId);
      if (!q) continue;
      q.objectives.forEach((o, i) => { pq.counts[i] = Math.min(o.count, (pq.counts[i] ?? 0) + objectiveDelta(o, e)); });
      if (q.objectives.every((o, i) => (pq.counts[i] ?? 0) >= o.count)) pq.status = 'complete';
    }
  }

  availableQuests(p: PlayerState): QuestDef[] {
    const active = new Set(p.quests.map((q) => q.questId));
    const done = new Set(p.completedQuests);
    return this.world.entities.list('quests').filter((q) =>
      q.giverId && q.objectives.length && !active.has(q.id) && (!done.has(q.id) || q.repeatable) &&
      p.level >= q.requiredLevel && (!q.prerequisiteId || done.has(q.prerequisiteId)) &&
      this.actors.actors.get(q.giverId)?.state !== 'dead');
  }

  acceptQuest(p: PlayerState, q: QuestDef): void {
    if (p.quests.some((x) => x.questId === q.id)) return;
    p.quests.push({ questId: q.id, counts: q.objectives.map(() => 0), status: 'active' });
  }

  turnIn(p: PlayerState, questId: EntityId): void {
    const idx = p.quests.findIndex((x) => x.questId === questId && x.status === 'complete');
    const q = this.world.entities.get('quests', questId);
    if (idx < 0 || !q) return;
    p.quests.splice(idx, 1);
    if (!p.completedQuests.includes(q.id)) p.completedQuests.push(q.id);
    // Deliver objectives consume the items.
    for (const o of q.objectives) if (o.type === 'deliver' && o.targetId) p.inventory = removeItem(p.inventory, o.targetId, o.count).inv;
    const paid = this.econ.payFromTreasury(q.rewards.currency);
    p.gold += paid;
    if (paid < q.rewards.currency) this.feel(p, 'unpaid');
    for (const s of q.rewards.items) this.giveItem(p, s.itemId, s.qty);
    this.gainXp(p, q.rewards.xp);
    p.stats.questsDone++;
    this.feel(p, 'quest');
    this.autoEquip(p);
    this.events.emit('questDone', { player: p, quest: q, paid });
  }

  /** Players currently hunting in a spawn area (set by the player system). */
  hunting = new Map<EntityId, EntityId>();
  huntersIn(areaId: EntityId): number {
    let n = 0;
    for (const a of this.hunting.values()) if (a === areaId) n++;
    return n;
  }

  countItem(p: PlayerState, itemId: EntityId): number {
    return countItem(p.inventory, itemId);
  }

  // -------------------------------------------------------- population
  spawnPoint(): { x: number; y: number } {
    // Map spawn points and spawn points inside buildings (players walk out of the door).
    const spawns = this.world.entities.list('objects').filter((o) => o.kind === 'player_spawn' || o.interior?.furniture.some((f) => f.kind === 'spawn'))
      .map((o) => (o.kind === 'player_spawn' ? { x: o.x, y: o.y } : doorTile(o)));
    const s = spawns[Math.floor(this.rand() * spawns.length)];
    if (s) {
      const near = this.actors.randomWalkableNear(s.x, s.y, 1);
      if (near) return near;
    }
    const town = this.world.entities.list('regions').find((r) => ['village', 'town', 'city', 'safezone'].includes(r.type));
    const g = this.world.grid;
    const cx = town ? town.x + town.w / 2 : g.width / 2;
    const cy = town ? town.y + town.h / 2 : g.height / 2;
    for (let r = 2; r < Math.max(g.width, g.height); r += 4) {
      const p = this.actors.randomWalkableNear(cx, cy, r);
      if (p) return p;
    }
    return { x: Math.floor(cx), y: Math.floor(cy) };
  }

  private spawnActor(p: PlayerState, x: number, y: number): Actor {
    const s = this.stats(p);
    const a = newActor(p.id, 'player', p.id, Math.floor(x), Math.floor(y), s.maxHp);
    a.hp = Math.max(1, Math.min(s.maxHp, p.hp || s.maxHp));
    a.homeX = Math.floor(x);
    a.homeY = Math.floor(y);
    this.actors.addActor(a);
    return a;
  }

  createPlayer(): PlayerState {
    const behavior = pick<PlayerBehavior>(BEHAVIORS.map((b) => [b.key, b.share]), this.rand());
    const classKey = pick(CLASS_SHARES, this.rand());
    const now = this.world.clock.totalMinutes;
    const p: PlayerState = {
      id: createId('pl'), name: playerName(this.rand), classKey, behavior, level: 1, trainedLevel: 1, xp: 0, gold: STARTING_PLAYER_GOLD, hp: 0, mana: 0,
      inventory: [], equipment: {}, quests: [], completedQuests: [], satisfaction: 60, factors: {}, visitedRegions: [],
      online: false, returnAt: 0, sessionLeft: 0, playMinutes: 0, joinedAt: now, x: 0, y: 0,
      stats: { kills: 0, deaths: 0, questsDone: 0, goldEarned: 0, pvpKills: 0 },
      reports: 0,
    };
    const keys = itemKeyIndex(this.world.entities.list('items'));
    for (const k of STARTER_GEAR[classKey] ?? []) { const id = keys.get(k); if (id) this.giveItem(p, id, 1); }
    const potion = keys.get('health_potion');
    if (potion) this.giveItem(p, potion, 2);
    this.autoEquip(p);
    const s = this.stats(p);
    p.hp = s.maxHp;
    p.mana = s.maxMana;
    return p;
  }

  private startSession(p: PlayerState): void {
    const [lo, hi] = getBehavior(p.behavior).session;
    p.sessionLeft = (lo + this.rand() * (hi - lo)) * 60;
    p.online = true;
    const sp = this.spawnPoint();
    p.x = sp.x;
    p.y = sp.y;
    this.spawnActor(p, sp.x, sp.y);
  }

  /** Are there trainers in the world? (Then new skills must be learned from one.) */
  hasTrainers(): boolean {
    return this.world.entities.list('npcs').some((n) => n.type === 'trainer');
  }

  /** Level whose skills the player can use: trained skills only when the world has trainers. */
  skillLevel(p: PlayerState): number {
    if (!this.hasTrainers()) return p.level;
    return Math.min(p.level, p.trainedLevel ?? p.level); // older saves: everything already learned
  }

  /** Somewhere for players to appear: a spawn point on the map or inside a building. */
  hasSpawn(): boolean {
    return this.world.entities.list('objects').some((o) => o.kind === 'player_spawn' || o.interior?.furniture.some((f) => f.kind === 'spawn'));
  }

  /** Empty start: servers stay closed until the designer builds a spawn point. */
  get serversOpen(): boolean {
    return this.world.config.launched !== false;
  }

  /** A brand new player joins (if the server has room). */
  join(): PlayerState | null {
    if (!this.serversOpen || this.online().length >= this.capacity()) return null;
    const p = this.createPlayer();
    this.world.sim.players.push(p);
    this.byId.set(p.id, p);
    this.world.sim.totalJoined++;
    this.startSession(p);
    this.events.emit('joined', { player: p, returning: false });
    return p;
  }

  /** Remove a player for good (ban). */
  removePlayer(p: PlayerState): void {
    const a = this.actors.actors.get(p.id);
    if (a) this.actors.removeActor(a);
    this.hunting.delete(p.id);
    p.online = false;
    this.world.sim.players = this.world.sim.players.filter((x) => x.id !== p.id);
    this.byId.delete(p.id);
    this.world.sim.totalLeft++;
  }

  /** End a session: the player either returns later or quits for good. */
  logout(p: PlayerState): void {
    const a = this.actors.actors.get(p.id);
    if (a) { p.x = Math.floor(a.x); p.y = Math.floor(a.y); p.hp = Math.max(1, a.hp); this.actors.removeActor(a); }
    p.online = false;
    const s = p.satisfaction;
    // Clan members are loyal: friends keep them around even when the game annoys them.
    const quitChance = Math.min(0.95, (s < 25 ? 0.75 : s < 40 ? 0.35 : s < 55 ? 0.08 : 0.02) * (p.clanId ? CLAN_LOYALTY : 1) * CHURN_BY_DIFFICULTY[this.world.config.difficulty]);
    const quit = this.rand() < quitChance;
    const reason = quit ? this.worstFactor(p) : null;
    if (quit) {
      this.world.sim.players = this.world.sim.players.filter((x) => x.id !== p.id);
      this.byId.delete(p.id);
      this.world.sim.totalLeft++;
    } else {
      p.returnAt = this.world.clock.totalMinutes + (4 + this.rand() * 20) * 60;
    }
    this.events.emit('left', { player: p, quit, reason });
  }

  /** Once per game hour: returning players, newcomers, popularity drift. */
  hourly(): void {
    const sim = this.world.sim;
    if (!this.serversOpen) {
      if (!this.hasSpawn()) return;
      // Launch day: the queue of waiting players logs in at once.
      this.world.config.launched = true;
      const n = this.seedInitial(this.world.config.initialPlayerCount);
      this.events.emit('launched', { count: n });
      return;
    }
    const now = this.world.clock.totalMinutes;
    const cap = this.capacity();
    let turnedAway = 0;
    for (const p of sim.players) {
      if (p.online || p.returnAt > now) continue;
      if (this.online().length >= cap) { this.feel(p, 'queue'); turnedAway++; p.returnAt = now + 120; continue; }
      this.startSession(p);
      this.events.emit('joined', { player: p, returning: true });
    }
    // Newcomers: driven by popularity (and subscription price in standard mode).
    let rate = sim.popularity / 8;
    if (this.world.config.gameMode === 'standard') rate *= Math.max(0.2, Math.min(1.5, 2 - this.world.studio.subscriptionPrice / 3));
    sim.arrivalCarry += rate;
    while (sim.arrivalCarry >= 1) {
      sim.arrivalCarry -= 1;
      if (!this.join()) turnedAway++;
    }
    if (turnedAway) { sim.popularity = Math.max(1, sim.popularity - turnedAway * 0.15); this.events.emit('turnedAway', { count: turnedAway }); }
    // Popularity follows how happy people are.
    const on = this.online();
    const avg = on.length ? on.reduce((n, p) => n + p.satisfaction, 0) / on.length : 50;
    sim.popularity = Math.max(1, Math.min(100, sim.popularity + (avg - 50) * 0.04));
    // Mood drifts back towards neutral over time.
    for (const p of on) p.satisfaction += (55 - p.satisfaction) * 0.03;
  }

  /** Seed the first players of a new world. */
  seedInitial(count: number): number {
    let n = 0;
    for (let i = 0; i < count; i++) if (this.join()) n++;
    return n;
  }

  /** Copy live actor state back into PlayerState (before saving). */
  flush(): void {
    for (const p of this.online()) {
      const a = this.actors.actors.get(p.id);
      if (!a) continue;
      p.x = Math.floor(a.x);
      p.y = Math.floor(a.y);
      p.hp = a.state === 'dead' ? Math.ceil(a.maxHp / 2) : a.hp;
    }
  }

  dispose(): void {
    this.events.clear();
  }
}
