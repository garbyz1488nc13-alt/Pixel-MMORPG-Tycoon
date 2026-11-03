import { createId } from '@/core/ids';
import { MAX_MAP_SIZE, MIN_MAP_SIZE } from '@/data/worldPresets';
import { TileGrid } from '@/models/TileGrid';
import { WORLD_SCHEMA_VERSION, type WorldMeta, type WorldSave } from '@/models/world';
import { emptyEntities } from '@/models/entities';

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
  return { ...s, schemaVersion: WORLD_SCHEMA_VERSION };
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
