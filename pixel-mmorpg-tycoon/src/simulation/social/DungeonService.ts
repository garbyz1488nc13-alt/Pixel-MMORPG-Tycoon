import { createId, type EntityId } from '@/core/ids';
import { EventBus } from '@/core/EventBus';
import { doorTile } from '@/data/furniture';
import type { MapObject } from '@/models/entities';
import type { PlayerState } from '@/models/sim';
import { xpToNext } from '@/systems/rpg/progression';
import { isAlive } from '../actors/Actor';
import type { ActorManager } from '../actors/ActorManager';
import type { PlayerManager } from '../players/PlayerManager';
import type { SimContext, SimulationSystem } from '../types';
import type { WorldRuntime } from '../WorldRuntime';
import type { ChatService } from './ChatService';

export const DUNGEON_KINDS = new Set(['dungeon_entrance', 'cave_entrance']);
const TANKS = new Set(['warrior', 'paladin']);
const HEALERS = new Set(['paladin']);
/** Game minutes a run lasts once inside. */
export const DUNGEON_MINUTES = 30;
const GATHER_TICKS = 700;
/** Rooms in every dungeon (the last one is the boss room). */
export const ROOMS = 7;

export interface DungeonRun {
  id: EntityId;
  entranceId: EntityId;
  members: EntityId[];
  phase: 'gathering' | 'inside';
  /** Tick the gathering gives up / the run ends. */
  until: number;
  level: number;
  /** Tick the party went inside. */
  startedAt?: number;
  /** Decided at the door: does the party clear it, and in which room do they wipe. */
  outcome?: { cleared: boolean; wipeRoom: number };
}

/** A dungeon's own map: stone walls, rooms linked by corridors, the boss in the last room. */
export interface DungeonLayout {
  w: number;
  h: number;
  /** 1 = floor, 0 = wall. */
  floor: Uint8Array;
  rooms: { x: number; y: number; w: number; h: number }[];
  /** Walk order through the rooms (tile centres). */
  path: { x: number; y: number }[];
  cave: boolean;
}

function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Build the layout of a dungeon (always the same for the same entrance). */
export function dungeonLayout(id: string, cave: boolean): DungeonLayout {
  let s = seedOf(id) || 1;
  const rnd = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296);
  const w = 40, h = 24;
  const floor = new Uint8Array(w * h);
  const rooms: DungeonLayout['rooms'] = [];
  // Rooms snake left→right through a 4×2 grid of cells.
  const order = [[0, 1], [1, 1], [1, 0], [2, 0], [2, 1], [3, 1], [3, 0]];
  for (const [cx, cy] of order) {
    const rw = 5 + Math.floor(rnd() * 3), rh = 4 + Math.floor(rnd() * 3);
    const x = cx * 10 + 1 + Math.floor(rnd() * (9 - rw)), y = cy * 12 + 1 + Math.floor(rnd() * (11 - rh));
    rooms.push({ x, y, w: rw, h: rh });
  }
  const dig = (x: number, y: number) => { if (x > 0 && y > 0 && x < w - 1 && y < h - 1) floor[y * w + x] = 1; };
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) dig(x, y);
  const path: DungeonLayout['path'] = [];
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    const c = { x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) };
    if (i > 0) {
      const p = path[path.length - 1];
      // L-shaped corridor (caves wiggle).
      let x = p.x, y = p.y;
      while (x !== c.x) { x += Math.sign(c.x - x); dig(x, y); if (cave && rnd() < 0.3) dig(x, y + 1); }
      while (y !== c.y) { y += Math.sign(c.y - y); dig(x, y); if (cave && rnd() < 0.3) dig(x + 1, y); }
    }
    path.push(c);
  }
  // Caves: ragged edges.
  if (cave) for (let i = 0; i < 120; i++) { const x = 1 + Math.floor(rnd() * (w - 2)), y = 1 + Math.floor(rnd() * (h - 2)); if (floor[y * w + x - 1] || floor[y * w + x + 1]) dig(x, y); }
  return { w, h, floor, rooms, path, cave };
}

export type DungeonEvents = {
  formed: { run: DungeonRun; name: string };
  finished: { run: DungeonRun; name: string; cleared: boolean; loot: number };
};

/**
 * Group dungeons ("instances"): players of a similar level team up in parties of 3–5,
 * walk to a dungeon or cave entrance, disappear inside for a while and come out with
 * XP, gold and maybe gear — or after a wipe. A tank and a healer make it much safer.
 */
export class DungeonService implements SimulationSystem {
  readonly id = 'dungeons';
  readonly interval = 10;
  readonly events = new EventBus<DungeonEvents>();
  readonly runs: DungeonRun[] = [];
  /** Hand the run to a player's AI (set by the session). */
  assign: (playerId: EntityId, run: DungeonRun, x: number, y: number) => void = () => undefined;
  release: (playerId: EntityId) => void = () => undefined;
  isFree: (playerId: EntityId) => boolean = () => true;
  private nextForm = 100;

  constructor(private world: WorldRuntime, private actors: ActorManager, private pm: PlayerManager, private chat?: ChatService) {}

  private rand() {
    return this.actors.rand();
  }

  entrances(): MapObject[] {
    return this.world.entities.list('objects').filter((o) => DUNGEON_KINDS.has(o.kind));
  }

  /** Level of a dungeon: set in the inspector, else the region's recommended level, else 5. */
  levelOf(o: MapObject): number {
    if (o.dungeon?.level) return o.dungeon.level;
    for (const r of this.world.entities.list('regions')) if (o.x >= r.x && o.y >= r.y && o.x < r.x + r.w && o.y < r.y + r.h) return Math.max(1, Math.round((r.minLevel + r.maxLevel) / 2));
    return 5;
  }

  nameOf(o: MapObject): string {
    return o.dungeon?.name || o.name || (o.kind === 'cave_entrance' ? 'Cave' : 'Dungeon');
  }

  stats(id: EntityId) {
    const all = (this.world.sim.dungeonStats ??= {});
    return (all[id] ??= { runs: 0, clears: 0, wipes: 0 });
  }

  runOf(playerId: EntityId): DungeonRun | undefined {
    return this.runs.find((r) => r.members.includes(playerId));
  }

  /** Players currently inside a dungeon (hidden on the map). */
  inside(): Set<EntityId> {
    const out = new Set<EntityId>();
    for (const r of this.runs) if (r.phase === 'inside') for (const id of r.members) out.add(id);
    return out;
  }

  /** Try to form a party for some dungeon now. */
  form(): DungeonRun | null {
    if (!this.world.feature('dungeons')) return null;
    const doors = this.entrances();
    if (!doors.length) return null;
    const busy = new Set(this.runs.map((r) => r.entranceId));
    const free = this.pm.online().filter((p) => p.level >= 3 && !p.cheat && this.isFree(p.id) && !this.runOf(p.id));
    for (const door of [...doors].sort(() => this.rand() - 0.5)) {
      if (busy.has(door.id)) continue;
      const lv = this.levelOf(door);
      const pool = free.filter((p) => p.level >= lv - 2 && p.level <= lv + 4).sort(() => this.rand() - 0.5);
      if (pool.length < 3) continue;
      // LFG: try to bring a tank and a healer.
      const party: PlayerState[] = [];
      const tank = pool.find((p) => TANKS.has(p.classKey));
      if (tank) party.push(tank);
      const healer = pool.find((p) => HEALERS.has(p.classKey) && p !== tank);
      if (healer) party.push(healer);
      for (const p of pool) if (party.length < 5 && !party.includes(p)) party.push(p);
      const run: DungeonRun = { id: createId('run'), entranceId: door.id, members: party.map((p) => p.id), phase: 'gathering', until: this.actors.tick + GATHER_TICKS, level: lv };
      this.runs.push(run);
      const d = doorTile(door);
      party.forEach((p) => { const s = this.actors.randomWalkableNear(d.x, d.y + 1, 2) ?? { x: d.x, y: d.y + 1 }; this.assign(p.id, run, s.x, s.y); });
      if (this.chat && party[0]) this.chat.say(party[0].id, this.chat.line('dungeonLfg'));
      this.events.emit('formed', { run, name: this.nameOf(door) });
      return run;
    }
    return null;
  }

  update(ctx: SimContext): void {
    const tick = ctx.tick;
    if (tick >= this.nextForm) { this.nextForm = tick + 300 + Math.floor(this.rand() * 300); if (this.runs.length < 4) this.form(); }
    for (const run of [...this.runs]) {
      const door = this.world.entities.get('objects', run.entranceId);
      run.members = run.members.filter((id) => this.pm.get(id)?.online);
      if (!door || run.members.length < 2) { this.end(run, false, true); continue; }
      if (run.phase === 'gathering') {
        const d = doorTile(door);
        const here = run.members.filter((id) => { const a = this.actors.actors.get(id); return a && isAlive(a) && Math.hypot(a.x - d.x, a.y - d.y) < 6; }).length;
        if (here >= Math.min(run.members.length, 3) && (here === run.members.length || tick >= run.until - GATHER_TICKS / 2)) {
          run.phase = 'inside';
          run.until = tick + DUNGEON_MINUTES * 4;
          run.startedAt = tick;
          run.outcome = this.decide(run);
          this.stats(door.id).runs++;
        } else if (tick >= run.until) this.end(run, false, true);
      } else {
        // A wipe ends the run early, in the room where it happened.
        const o = run.outcome ?? (run.outcome = this.decide(run));
        const wiped = !o.cleared && this.progress(run) * ROOMS >= o.wipeRoom + 0.6;
        if (wiped || tick >= run.until) this.end(run, o.cleared && !wiped, false);
      }
    }
  }

  /** Chance to clear: level, party size, tank and healer. */
  private decide(run: DungeonRun): { cleared: boolean; wipeRoom: number } {
    const ps = run.members.map((id) => this.pm.get(id)).filter((p): p is PlayerState => !!p);
    const avg = ps.reduce((n, p) => n + p.level, 0) / Math.max(1, ps.length);
    const tank = ps.some((p) => TANKS.has(p.classKey)), healer = ps.some((p) => HEALERS.has(p.classKey));
    const chance = Math.max(0.1, Math.min(0.95, 0.45 + (avg - run.level) * 0.08 + (tank ? 0.12 : 0) + (healer ? 0.15 : 0) + (ps.length - 3) * 0.05));
    const cleared = this.rand() < chance;
    // Most wipes happen at the boss.
    return { cleared, wipeRoom: cleared ? -1 : this.rand() < 0.6 ? ROOMS - 1 : 1 + Math.floor(this.rand() * (ROOMS - 2)) };
  }

  /** 0..1: how far the party is through the dungeon. */
  progress(run: DungeonRun): number {
    if (run.phase !== 'inside' || run.startedAt === undefined) return 0;
    return Math.min(1, (this.actors.tick - run.startedAt) / (DUNGEON_MINUTES * 4));
  }

  private layouts = new Map<EntityId, DungeonLayout>();
  layout(o: MapObject): DungeonLayout {
    let l = this.layouts.get(o.id);
    if (!l) { l = dungeonLayout(o.id, o.kind === 'cave_entrance'); this.layouts.set(o.id, l); }
    return l;
  }

  private end(run: DungeonRun, cleared: boolean, abandoned: boolean): void {
    this.runs.splice(this.runs.indexOf(run), 1);
    const door = this.world.entities.get('objects', run.entranceId);
    const ps = run.members.map((id) => this.pm.get(id)).filter((p): p is PlayerState => !!p);
    let loot = 0;
    if (!abandoned && door) {
      const st = this.stats(door.id);
      for (const p of ps) {
        if (cleared) {
          this.pm.gainXp(p, Math.round(xpToNext(Math.max(1, p.level), this.world.rpg.progression) * 0.35));
          p.gold += run.level * 12; p.stats.goldEarned += run.level * 12;
          this.pm.feel(p, 'raid', 0.7);
          // Personal gear drop: something useful around the dungeon level.
          if (this.rand() < 0.4) {
            const gear = this.world.entities.list('items').filter((it) => it.slot !== 'none' && it.levelReq <= run.level + 2 && it.levelReq >= run.level - 6 && it.rarity !== 'common');
            const it = gear[Math.floor(this.rand() * gear.length)];
            if (it && this.pm.giveItem(p, it.id, 1)) { loot++; this.pm.feel(p, 'loot'); this.pm.autoEquip(p); }
          }
        } else this.pm.feel(p, 'death');
        this.pm.questEvent(p, { type: 'explore', regionId: run.entranceId });
      }
      if (cleared) st.clears++; else st.wipes++;
      for (let i = 0; i < ps.length; i++) if (this.rand() < 0.2) this.pm.befriend(ps[i], ps[(i + 1) % ps.length]);
      // Everyone walks out of the entrance.
      const d = doorTile(door);
      for (const p of ps) { const a = this.actors.actors.get(p.id); const s = this.actors.randomWalkableNear(d.x, d.y + 1, 1.5); if (a && s) this.actors.teleport(a, s.x, s.y); }
      if (this.chat && ps[0]) this.chat.say(ps[0].id, this.chat.line(cleared ? 'dungeonWin' : 'wipe'));
      this.events.emit('finished', { run, name: this.nameOf(door), cleared, loot });
    }
    for (const p of ps) this.release(p.id);
  }
}
