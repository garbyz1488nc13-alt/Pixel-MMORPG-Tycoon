import { createId } from '@/core/ids';
import { t as tr } from '@/i18n';
import { SeededRandom } from '@/core/random';
import type { CreatureType } from '@/data/creatureTypes';
import type { NpcType } from '@/data/npcTypes';
import { getObjectDef } from '@/data/objects';
import { getTerrain, TerrainId } from '@/data/terrain';
import type { CreatureTemplate, MapObject, NpcDef, Region, SpawnArea } from '@/models/entities';
import type { EntityChange } from '@/simulation/EntityStore';
import type { WorldRuntime } from '@/simulation/WorldRuntime';
import { EntityEditor } from '@/systems/editor/EntityEditor';
import { CompositeCommand, EntityCommand, TileEditCommand, type EditorCommand, type History } from '@/systems/editor/History';
import type { TileRect } from '@/systems/editor/shapes';

/**
 * Builds content inside a region (villages, towns, cities, forests, dungeons, caves).
 * Plans everything first against a private occupancy map, then applies it as a single undo step.
 */
class Planner {
  readonly objects: MapObject[] = [];
  readonly npcs: NpcDef[] = [];
  readonly templates: CreatureTemplate[] = [];
  readonly areas: SpawnArea[] = [];
  readonly tileEdits = new Map<number, number>();
  private solid = new Set<number>();
  private flat = new Set<number>();

  constructor(readonly world: WorldRuntime, readonly rng: SeededRandom) {}

  terrainAt(x: number, y: number): number {
    const i = y * this.world.grid.width + x;
    return this.tileEdits.get(i) ?? this.world.grid.tiles[i];
  }

  paint(x: number, y: number, t: TerrainId): void {
    if (!this.world.grid.inBounds(x, y)) return;
    const i = y * this.world.grid.width + x;
    if (this.world.grid.tiles[i] !== t || this.tileEdits.has(i)) this.tileEdits.set(i, t);
  }

  private walkableTerrain(x: number, y: number): boolean {
    return getTerrain(this.terrainAt(x, y)).walkable;
  }

  canPlace(kind: string, x: number, y: number): boolean {
    const d = getObjectDef(kind);
    if (!d) return false;
    const g = this.world.grid;
    const idx = this.world.objectIndex;
    for (let ty = y; ty < y + d.h; ty++)
      for (let tx = x; tx < x + d.w; tx++) {
        if (!g.inBounds(tx, ty)) return false;
        const i = ty * g.width + tx;
        if (!d.flat && !d.walkableOverride && !this.walkableTerrain(tx, ty)) return false;
        if (this.flat.has(i) || this.solid.has(i) || idx.flatAt(tx, ty) || idx.solidAt(tx, ty)) return false;
      }
    return true;
  }

  place(kind: string, x: number, y: number): boolean {
    if (!this.canPlace(kind, x, y)) return false;
    const d = getObjectDef(kind)!;
    const set = d.flat ? this.flat : this.solid;
    for (let ty = y; ty < y + d.h; ty++) for (let tx = x; tx < x + d.w; tx++) set.add(ty * this.world.grid.width + tx);
    this.objects.push({ id: createId('obj'), kind, x, y });
    return true;
  }

  freeWalkable(x: number, y: number): boolean {
    const g = this.world.grid;
    if (!g.inBounds(x, y) || !this.walkableTerrain(x, y)) return false;
    const i = y * g.width + x;
    if (this.solid.has(i)) return false;
    const o = this.world.objectIndex.solidAt(x, y);
    return !(o && getObjectDef(o.kind)?.blocks);
  }

  addNpc(type: NpcType, r: TileRect, near?: { x: number; y: number }): NpcDef | null {
    for (let k = 0; k < 40; k++) {
      const x = near ? near.x + this.rng.int(-2, 2) : r.x + this.rng.int(0, r.w - 1);
      const y = near ? near.y + this.rng.int(-1, 2) : r.y + this.rng.int(0, r.h - 1);
      if (!this.freeWalkable(x, y)) continue;
      const n = EntityEditor.makeNpc(type, x, y, () => this.rng.next());
      // Keep names unique within the world where possible.
      const taken = new Set([...this.world.entities.list('npcs'), ...this.npcs].map((o) => o.name));
      for (let t = 0; t < 30 && taken.has(n.name); t++) n.name = EntityEditor.makeNpc(type, x, y, () => this.rng.next()).name;
      n.wanderRadius = Math.max(3, Math.min(8, Math.floor(Math.min(r.w, r.h) / 3)));
      this.npcs.push(n);
      return n;
    }
    return null;
  }

  /** Reuse an existing template of this type, or create one. */
  template(type: CreatureType): CreatureTemplate {
    const existing = [...this.world.entities.list('creatureTemplates'), ...this.templates].find((t) => t.type === type);
    if (existing) return existing;
    const t = EntityEditor.makeTemplate(type);
    this.templates.push(t);
    return t;
  }

  spawnArea(type: CreatureType, r: TileRect, count: number, name?: string): void {
    const t = this.template(type);
    this.areas.push({ id: createId('spawn'), name: name ?? tr('{name} area', { name: t.name }), templateId: t.id, ...r, maxCount: count });
  }
}

const rnd = (p: Planner, n: number) => p.rng.int(0, n - 1);

// ------------------------------------------------------------- recipes
function forest(p: Planner, r: TileRect): void {
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      const t = p.terrainAt(x, y);
      const roll = p.rng.next();
      const tree = t === TerrainId.Snow ? 'tree_snow' : t === TerrainId.Sand ? 'tree_palm' : t === TerrainId.Swamp ? 'tree_dead' : roll < 0.17 ? 'tree_pine' : 'tree_oak';
      if (roll < 0.3) p.place(tree, x, y);
      else if (roll < 0.36) p.place(p.rng.next() < 0.3 ? 'berry_bush' : 'bush', x, y);
      else if (roll < 0.38) p.place('rock', x, y);
      else if (roll < 0.41) p.place('flowers', x, y);
    }
  if (r.w * r.h >= 64) p.spawnArea('wolf', shrink(r, 2), Math.min(8, Math.max(2, Math.round((r.w * r.h) / 120))), tr('Wolf den'));
}

function shrink(r: TileRect, n: number): TileRect {
  return { x: r.x + n, y: r.y + n, w: Math.max(1, r.w - n * 2), h: Math.max(1, r.h - n * 2) };
}

function settlement(p: Planner, r: TileRect, size: 'village' | 'town' | 'city', npcBudget?: number): void {
  const cx = r.x + Math.floor(r.w / 2);
  const cy = r.y + Math.floor(r.h / 2);
  const road = size === 'village' ? 'dirt_path' : 'road';
  const inner = size === 'city' ? shrink(r, 1) : r;

  // City walls with four gates.
  if (size === 'city') {
    for (let x = r.x; x < r.x + r.w; x++) for (const y of [r.y, r.y + r.h - 1]) if (Math.abs(x - cx) > 1) p.place('wall', x, y);
    for (let y = r.y; y < r.y + r.h; y++) for (const x of [r.x, r.x + r.w - 1]) if (Math.abs(y - cy) > 1) p.place('wall', x, y);
  }

  // Roads: a cross through the centre, plus a grid for towns/cities. Bridges over water.
  const roadLines: { h: boolean; at: number }[] = [{ h: true, at: cy }, { h: false, at: cx }];
  if (size !== 'village') {
    const step = size === 'city' ? 8 : 10;
    for (let y = cy - step; y > inner.y + 2; y -= step) roadLines.push({ h: true, at: y });
    for (let y = cy + step; y < inner.y + inner.h - 2; y += step) roadLines.push({ h: true, at: y });
    for (let x = cx - step; x > inner.x + 2; x -= step) roadLines.push({ h: false, at: x });
    for (let x = cx + step; x < inner.x + inner.w - 2; x += step) roadLines.push({ h: false, at: x });
  }
  for (const l of roadLines) {
    const len = l.h ? inner.w : inner.h;
    for (let i = 0; i < len; i++) {
      const x = l.h ? inner.x + i : l.at;
      const y = l.h ? l.at : inner.y + i;
      const t = p.terrainAt(x, y);
      if (t === TerrainId.Water) p.place('bridge', x, y);
      else if (t !== TerrainId.Lava) p.place(road, x, y);
    }
  }

  // Landmark in the centre.
  const landmark = size === 'village' ? 'well' : size === 'town' ? 'statue' : 'statue';
  p.place(landmark, cx + 1, cy + 1) || p.place(landmark, cx - 1, cy - 1);

  // Buildings along the roads.
  const services: string[] = size === 'village' ? ['shop'] : size === 'town' ? ['shop', 'smithy', 'tavern', 'temple'] : ['shop', 'smithy', 'tavern', 'temple', 'bank', 'shop', 'tavern'];
  const homes = size === 'village' ? ['house_small'] : ['house_small', 'house_large'];
  const placedServices: { kind: string; x: number; y: number }[] = [];
  const tryBuilding = (kind: string): boolean => {
    const d = getObjectDef(kind)!;
    for (let k = 0; k < 120; k++) {
      const l = roadLines[rnd(p, roadLines.length)];
      const along = l.h ? inner.x + rnd(p, Math.max(1, inner.w - d.w)) : inner.y + rnd(p, Math.max(1, inner.h - d.h));
      const side = p.rng.next() < 0.5;
      const x = l.h ? along : side ? l.at + 2 : l.at - d.w - 1;
      const y = l.h ? (side ? l.at - d.h - 1 : l.at + 2) : along;
      if (x < inner.x || y < inner.y || x + d.w > inner.x + inner.w || y + d.h > inner.y + inner.h) continue;
      if (p.place(kind, x, y)) {
        placedServices.push({ kind, x, y });
        return true;
      }
    }
    return false;
  };
  services.forEach(tryBuilding);
  const homeCount = Math.round((inner.w * inner.h) / (size === 'city' ? 40 : 60));
  for (let i = 0; i < homeCount; i++) tryBuilding(homes[rnd(p, homes.length)]);

  // Decorations.
  const decoCount = Math.round((inner.w * inner.h) / 30);
  const decos = size === 'village' ? ['fence', 'barrel', 'crate', 'flowers', 'bush', 'tree_oak'] : ['lamp', 'barrel', 'crate', 'flowers', 'sign', 'bush'];
  for (let i = 0; i < decoCount; i++) p.place(decos[rnd(p, decos.length)], inner.x + rnd(p, inner.w), inner.y + rnd(p, inner.h));
  if (size === 'city') for (const [x, y] of [[r.x + 1, r.y + 1], [r.x + r.w - 3, r.y + 1], [r.x + 1, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]]) p.place('tower', x, y);
  p.place('player_spawn', cx + 2, cy) || p.place('player_spawn', cx - 2, cy);

  // NPCs: service NPCs next to their buildings, the rest as residents.
  const doorOf = (kind: string) => {
    const b = placedServices.find((s) => s.kind === kind);
    if (!b) return undefined;
    const d = getObjectDef(kind)!;
    return { x: b.x + Math.floor(d.w / 2), y: b.y + d.h };
  };
  const plan: [NpcType, string | null][] = [];
  const add = (t: NpcType, at: string | null = null) => plan.push([t, at]);
  add('merchant', 'shop');
  add('questgiver', null);
  add('guard', null);
  if (size !== 'village') { add('blacksmith', 'smithy'); add('healer', 'temple'); add('trainer', 'tavern'); add('guard', null); }
  if (size === 'city') { add('banker', 'bank'); add('merchant', 'shop'); add('guard', null); add('guard', null); }
  const budget = npcBudget ?? plan.length + Math.round((inner.w * inner.h) / (size === 'village' ? 50 : 35));
  const residents: NpcType[] = size === 'village' ? ['farmer', 'farmer', 'villager'] : ['villager', 'villager', 'farmer'];
  while (plan.length < budget) add(residents[plan.length % residents.length]);
  plan.length = Math.min(plan.length, budget);
  for (const [type, at] of plan) {
    const n = p.addNpc(type, inner, at ? doorOf(at) : type === 'questgiver' ? { x: cx, y: cy + 2 } : undefined);
    if (!n) continue;
    if (type === 'guard') {
      // Patrol the four corners of the settlement.
      const m = 3;
      const corners = [[inner.x + m, inner.y + m], [inner.x + inner.w - m, inner.y + m], [inner.x + inner.w - m, inner.y + inner.h - m], [inner.x + m, inner.y + inner.h - m]];
      n.waypoints = corners.map(([x, y]) => ({ x, y })).filter((w) => p.freeWalkable(w.x, w.y));
      n.behavior = n.waypoints.length ? 'patrol' : 'wander';
      n.interactionRadius = Math.max(6, Math.round(Math.min(inner.w, inner.h) / 3));
    }
  }
}

function dungeonLike(p: Planner, r: TileRect, kind: 'dungeon' | 'cave'): void {
  const floor = kind === 'dungeon' ? TerrainId.Stone : TerrainId.Dirt;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) p.paint(x, y, floor);
  const cx = r.x + Math.floor(r.w / 2);
  const border = kind === 'dungeon' ? 'wall' : 'rock';
  for (let x = r.x; x < r.x + r.w; x++) for (const y of [r.y, r.y + r.h - 1]) if (Math.abs(x - cx) > 1 || y === r.y) p.place(border, x, y);
  for (let y = r.y; y < r.y + r.h; y++) for (const x of [r.x, r.x + r.w - 1]) p.place(border, x, y);
  p.place(kind === 'dungeon' ? 'dungeon_entrance' : 'cave_entrance', cx - 1, r.y + r.h - 3);
  const props = kind === 'dungeon' ? ['lamp', 'barrel', 'crate', 'statue'] : ['ore_rock', 'ore_rock', 'boulder', 'rock'];
  for (let i = 0; i < Math.round((r.w * r.h) / 25); i++) p.place(props[rnd(p, props.length)], r.x + 2 + rnd(p, Math.max(1, r.w - 4)), r.y + 2 + rnd(p, Math.max(1, r.h - 6)));
  const inner = shrink(r, 2);
  const count = Math.max(2, Math.min(10, Math.round((r.w * r.h) / 40)));
  if (kind === 'dungeon') {
    p.spawnArea('skeleton', { x: inner.x, y: inner.y + Math.floor(inner.h / 3), w: inner.w, h: Math.max(1, inner.h - Math.floor(inner.h / 3) - 2) }, count, tr('Crypt skeletons'));
    if (r.w >= 12 && r.h >= 12) p.spawnArea('boss', { x: cx - 2, y: r.y + 2, w: 4, h: 3 }, 1, tr('Throne room'));
  } else {
    p.spawnArea('spider', inner, count, tr('Spider nest'));
  }
}

/** Plan & apply population of a region as one undo step. Returns a short summary. */
export function populateRegion(world: WorldRuntime, history: History | null, region: Region, seed = Date.now(), npcBudget?: number): string {
  const p = new Planner(world, new SeededRandom(seed));
  const r: TileRect = { x: region.x, y: region.y, w: region.w, h: region.h };
  switch (region.type) {
    case 'forest': forest(p, r); break;
    case 'village': settlement(p, r, 'village', npcBudget); break;
    case 'town': settlement(p, r, 'town', npcBudget); break;
    case 'city': settlement(p, r, 'city', npcBudget); break;
    case 'dungeon': dungeonLike(p, r, 'dungeon'); break;
    case 'cave': dungeonLike(p, r, 'cave'); break;
    default: return tr('This region type has no generator.');
  }
  return applyPlan(world, history, p, tr('Populate {name}', { name: region.name }));
}

function applyPlan(world: WorldRuntime, history: History | null, p: Planner, label: string): string {
  const parts: EditorCommand[] = [];
  if (p.tileEdits.size) {
    const idx = Uint32Array.from(p.tileEdits.keys());
    const before = Uint8Array.from(idx, (i) => world.grid.tiles[i]);
    const after = Uint8Array.from(p.tileEdits.values());
    world.setTiles(idx, after);
    parts.push(new TileEditCommand(label, idx, before, after));
  }
  const changes: EntityChange[] = world.entities.bulk([
    ...p.templates.map((t) => ({ col: 'creatureTemplates' as const, id: t.id, value: t })),
    ...p.objects.map((o) => ({ col: 'objects' as const, id: o.id, value: o })),
    ...p.npcs.map((n) => ({ col: 'npcs' as const, id: n.id, value: n })),
    ...p.areas.map((a) => ({ col: 'spawnAreas' as const, id: a.id, value: a })),
  ]);
  if (changes.length) parts.push(new EntityCommand(label, changes));
  if (history && parts.length) history.push(new CompositeCommand(label, parts));
  const bits = [tr('objects: {n}', { n: p.objects.length }), tr('NPCs: {n}', { n: p.npcs.length })];
  if (p.areas.length) bits.push(tr('spawn areas: {n}', { n: p.areas.length }));
  if (p.tileEdits.size) bits.push(tr('tiles: {n}', { n: p.tileEdits.size }));
  return bits.join(', ');
}

/** Score a square for settling: share of walkable, non-blocked tiles. */
function landScore(world: WorldRuntime, x: number, y: number, size: number): number {
  let ok = 0;
  let n = 0;
  for (let j = 0; j < size; j += 2)
    for (let i = 0; i < size; i += 2) {
      n++;
      if (world.nav.isWalkable(x + i, y + j)) ok++;
    }
  return n ? ok / n : 0;
}

function findLand(world: WorldRuntime, size: number, avoid: TileRect[] = [], margin = 8): TileRect | null {
  const g = world.grid;
  if (g.width < size + 2 || g.height < size + 2) return null;
  let best: TileRect | null = null;
  let bestScore = -1;
  const cx = g.width / 2, cy = g.height / 2;
  const step = Math.max(2, Math.floor(size / 4));
  for (let y = 1; y + size < g.height - 1; y += step)
    for (let x = 1; x + size < g.width - 1; x += step) {
      if (avoid.some((a) => x < a.x + a.w + margin && x + size + margin > a.x && y < a.y + a.h + margin && y + size + margin > a.y)) continue;
      const s = landScore(world, x, y, size) - (Math.hypot(x + size / 2 - cx, y + size / 2 - cy) / Math.max(g.width, g.height)) * 0.3;
      if (s > bestScore) { bestScore = s; best = { x, y, w: size, h: size }; }
    }
  return bestScore > 0.55 ? best : null;
}

/**
 * Starter content for a new world: a settlement sized to the requested NPC count,
 * a forest with wolves and a goblin camp nearby. Not undoable (it's the initial state).
 */
export function generateStarterContent(world: WorldRuntime, npcCount: number, seed: number): string {
  const regions: Region[] = [];
  const g = world.grid;
  const size = npcCount > 40 ? 'city' : npcCount > 12 ? 'town' : 'village';
  const dim = Math.min(Math.floor(Math.min(g.width, g.height) * 0.6), size === 'city' ? 40 : size === 'town' ? 30 : 20);
  const results: string[] = [];
  const home = findLand(world, dim);
  if (home && npcCount > 0) {
    const reg: Region = { id: createId('reg'), name: tr(size === 'city' ? 'Capital City' : size === 'town' ? 'Starter Town' : 'Starter Village'), type: size, ...home, minLevel: 1, maxLevel: 5 };
    world.entities.add('regions', reg);
    regions.push(reg);
    results.push(`${reg.name}: ${populateRegion(world, null, reg, seed, npcCount)}`);
  }
  const wild = Math.min(18, Math.floor(Math.min(g.width, g.height) / 3));
  if (wild >= 8) {
    const forestRect = findLand(world, wild, regions);
    if (forestRect) {
      const reg: Region = { id: createId('reg'), name: tr('Whispering Woods'), type: 'forest', ...forestRect, minLevel: 3, maxLevel: 8 };
      world.entities.add('regions', reg);
      regions.push(reg);
      populateRegion(world, null, reg, seed + 1);
    }
    const campRect = findLand(world, Math.max(8, Math.floor(wild * 0.7)), regions);
    if (campRect) {
      const p = new Planner(world, new SeededRandom(seed + 2));
      const reg: Region = { id: createId('reg'), name: tr('Goblin Camp'), type: 'wilderness', ...campRect, minLevel: 2, maxLevel: 6 };
      world.entities.add('regions', reg);
      p.place('campfire', campRect.x + Math.floor(campRect.w / 2), campRect.y + Math.floor(campRect.h / 2));
      for (let i = 0; i < 6; i++) p.place(p.rng.next() < 0.5 ? 'crate' : 'barrel', campRect.x + rnd(p, campRect.w), campRect.y + rnd(p, campRect.h));
      p.spawnArea('goblin', campRect, 5, tr('Goblin camp'));
      p.spawnArea('slime', campRect, 3, tr('Slime pond'));
      applyPlan(world, null, p, tr('Starter camp'));
    }
  }
  return results.join('; ') || tr('No suitable land found.');
}

