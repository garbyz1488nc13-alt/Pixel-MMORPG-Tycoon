import { createId } from '@/core/ids';
import { MAX_MAP_SIZE, MIN_MAP_SIZE } from '@/data/worldPresets';
import { TileGrid } from '@/models/TileGrid';
import { WORLD_SCHEMA_VERSION, type WorldMeta, type WorldSave } from '@/models/world';
import { emptyEntities } from '@/models/entities';
import { createDefaultSim, createDefaultStudio, defaultCommunity } from '@/data/studio';
import { createDefaultItems, createDefaultRpg, defaultLoot, defaultShop, DEFAULT_NPC_GOLD } from '@/data/rpgDefaults';

export const EXPORT_FORMAT = 'pixel-mmorpg-tycoon/world';

export interface WorldExportFile {
  format: typeof EXPORT_FORMAT;
  exportedAt: number;
  world: WorldSave;
}

export function toMeta(save: WorldSave, thumbnail?: string): WorldMeta {
  return {
    id: save.id,
    name: save.name,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    width: save.map.width,
    height: save.map.height,
    worldType: save.config.worldType,
    difficulty: save.config.difficulty,
    totalMinutes: save.clock.totalMinutes,
    thumbnail,
  };
}

export function exportWorldJson(save: WorldSave): string {
  const file: WorldExportFile = { format: EXPORT_FORMAT, exportedAt: Date.now(), world: save };
  return JSON.stringify(file, null, 2);
}

/** Upgrade older saves to the current schema. Add a case per version bump. */
export function migrate(save: WorldSave): WorldSave {
  if (save.schemaVersion > WORLD_SCHEMA_VERSION) {
    throw new Error(`This world was made with a newer version (schema ${save.schemaVersion}).`);
  }
  let s = { ...save };
  // v1 -> v2: entity layer added.
  if (s.schemaVersion < 2 || !s.entities) s = { ...s, entities: emptyEntities() };
  s.entities = { ...emptyEntities(), ...s.entities };
  // v2 -> v3: item database, economy & progression; item names become item ids.
  if (s.schemaVersion < 3 || !s.rpg) s = migrateToV3(s);
  // v3 -> v4: game mode, players, studio. Older worlds become sandbox worlds.
  if (s.schemaVersion < 4 || !s.sim || !s.studio) {
    s = { ...s, config: { ...s.config, gameMode: s.config.gameMode ?? 'sandbox' }, sim: s.sim ?? createDefaultSim(), studio: s.studio ?? createDefaultStudio('sandbox', s.config.difficulty) };
  }
  // v4 -> v5: reviews, rating, anti-cheat, bans; players get a report counter.
  if (s.schemaVersion < 5 || !s.sim.reviews) {
    s = { ...s, sim: { ...defaultCommunity(), ...s.sim, players: s.sim.players.map((p) => ({ ...p, reports: p.reports ?? 0 })) } };
  }
  return { ...s, schemaVersion: WORLD_SCHEMA_VERSION };
}

/** Legacy (v2) stacks referenced items by free-text name. */
type LegacyNamed = { name?: string; itemId?: string };

function migrateToV3(save: WorldSave): WorldSave {
  const e = structuredClone(save.entities);
  if (!e.items.length) e.items = createDefaultItems();
  const byName = new Map(e.items.map((i) => [i.name.toLowerCase(), i.id]));
  const resolve = (ref: LegacyNamed, value = 1): string => {
    if (ref.itemId) return ref.itemId;
    const name = (ref.name ?? '').trim() || 'Item';
    const hit = byName.get(name.toLowerCase());
    if (hit) return hit;
    const item = { id: createId('item'), name, description: '', category: 'misc' as const, icon: 'coin', rarity: 'common' as const, value: Math.max(0, Math.round(value)), levelReq: 1, stats: {}, stackSize: 99, slot: 'none' as const };
    e.items.push(item);
    byName.set(name.toLowerCase(), item.id);
    return item.id;
  };
  for (const n of e.npcs) {
    const legacy = n as unknown as { inventory: (LegacyNamed & { qty: number })[]; shop: { enabled: boolean; items: (LegacyNamed & { price?: number; stock: number; maxStock?: number })[] } };
    n.inventory = legacy.inventory.map((s) => ({ itemId: resolve(s), qty: s.qty }));
    n.shop = {
      enabled: legacy.shop.enabled,
      items: legacy.shop.items.map((s) => ({ itemId: resolve(s, (s.price ?? 0) / 1.25), stock: s.stock, maxStock: s.maxStock ?? Math.max(s.stock, 10) })),
    };
    if (n.shop.enabled && !n.shop.items.length) n.shop.items = defaultShop(n.type, e.items);
    if (typeof n.gold !== 'number') n.gold = DEFAULT_NPC_GOLD[n.type] ?? 30;
  }
  for (const c of e.creatureTemplates) {
    const legacy = c.loot as (LegacyNamed & { chance: number; min: number; max: number })[];
    c.loot = legacy.length ? legacy.map((l) => ({ itemId: resolve(l), chance: l.chance, min: l.min, max: l.max })) : defaultLoot(c.type, e.items);
  }
  return { ...save, entities: e, rpg: save.rpg ?? createDefaultRpg(save.config?.startingGold) };
}

/** Parse + validate an imported JSON file. Throws a readable error on bad input. */
export function parseWorldJson(text: string): WorldSave {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  const obj = raw as Partial<WorldExportFile> & Partial<WorldSave>;
  // Accept either the export envelope or a bare WorldSave.
  const world = (obj.format === EXPORT_FORMAT ? obj.world : obj) as WorldSave | undefined;
  if (!world || typeof world !== 'object') throw new Error('No world data found in file.');
  if (typeof world.name !== 'string') throw new Error('World is missing a name.');
  if (!world.map || typeof world.map.tilesRle !== 'string') throw new Error('World is missing map data.');
  const { width, height } = world.map;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < MIN_MAP_SIZE || height < MIN_MAP_SIZE || width > MAX_MAP_SIZE || height > MAX_MAP_SIZE) {
    throw new Error(`Invalid map size ${width}×${height}.`);
  }
  TileGrid.fromRle(width, height, world.map.tilesRle); // throws if corrupt
  if (!world.config || typeof world.config !== 'object') throw new Error('World is missing its config.');
  return migrate({
    ...world,
    schemaVersion: world.schemaVersion ?? 1,
    id: typeof world.id === 'string' ? world.id : createId('world'),
    createdAt: world.createdAt ?? Date.now(),
    updatedAt: world.updatedAt ?? Date.now(),
    clock: world.clock ?? { totalMinutes: 0 },
  });
}
