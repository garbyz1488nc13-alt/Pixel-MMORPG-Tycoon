import { createId } from '@/core/ids';
import type { Difficulty, WorldType } from '@/data/worldPresets';
import type { TileGrid } from '@/models/TileGrid';
import { WORLD_SCHEMA_VERSION, type WorldSave } from '@/models/world';
import { emptyEntities } from '@/models/entities';
import { START_MINUTES } from '@/simulation/time';
import { generateTerrain } from './WorldGenerator';

export interface NewWorldOptions {
  name: string;
  width: number;
  height: number;
  worldType: WorldType;
  difficulty: Difficulty;
  seed: number;
  startingGold: number;
  initialNpcCount: number;
  initialPlayerCount: number;
}

/** Build a fresh WorldSave from creation options. Optionally reuse a pre-generated grid (preview). */
export function createWorldSave(opts: NewWorldOptions, pregenerated?: TileGrid): WorldSave {
  const grid =
    pregenerated && pregenerated.width === opts.width && pregenerated.height === opts.height
      ? pregenerated
      : generateTerrain(opts.width, opts.height, opts.worldType, opts.seed);
  const now = Date.now();
  return {
    schemaVersion: WORLD_SCHEMA_VERSION,
    id: createId('world'),
    name: opts.name.trim() || 'Unnamed World',
    createdAt: now,
    updatedAt: now,
    config: {
      worldType: opts.worldType,
      difficulty: opts.difficulty,
      seed: opts.seed,
      startingGold: opts.startingGold,
      initialNpcCount: opts.initialNpcCount,
      initialPlayerCount: opts.initialPlayerCount,
    },
    map: { width: grid.width, height: grid.height, tilesRle: grid.toRle() },
    clock: { totalMinutes: START_MINUTES },
    entities: emptyEntities(),
  };
}
