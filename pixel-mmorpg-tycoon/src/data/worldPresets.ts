import { TerrainId } from './terrain';

export type WorldType = 'continent' | 'islands' | 'highlands' | 'desert' | 'frozen' | 'volcanic' | 'flat';
export type Difficulty = 'relaxed' | 'normal' | 'hard' | 'brutal';

export interface MapSizePreset { key: string; label: string; width: number; height: number }

export const MAP_SIZES: MapSizePreset[] = [
  { key: 'tiny', label: 'Tiny', width: 48, height: 48 },
  { key: 'small', label: 'Small', width: 96, height: 96 },
  { key: 'medium', label: 'Medium', width: 160, height: 160 },
  { key: 'large', label: 'Large', width: 256, height: 256 },
];

export const MIN_MAP_SIZE = 16;
export const MAX_MAP_SIZE = 512;

export const WORLD_TYPES: { key: WorldType; label: string; description: string }[] = [
  { key: 'continent', label: 'Continent', description: 'One large landmass with forests, hills and coasts.' },
  { key: 'islands', label: 'Archipelago', description: 'Many islands separated by sea.' },
  { key: 'highlands', label: 'Highlands', description: 'Rocky mountains with snowy peaks and valleys.' },
  { key: 'desert', label: 'Desert', description: 'Sand dunes with rare oases.' },
  { key: 'frozen', label: 'Frozen North', description: 'Snowfields, frozen lakes and stone ridges.' },
  { key: 'volcanic', label: 'Volcanic', description: 'Ash plains, lava flows and stone.' },
  { key: 'flat', label: 'Empty Canvas', description: 'Plain grass — build everything yourself.' },
];

export const DIFFICULTIES: { key: Difficulty; label: string; description: string }[] = [
  { key: 'relaxed', label: 'Relaxed', description: 'More starting gold, forgiving players.' },
  { key: 'normal', label: 'Normal', description: 'Balanced experience.' },
  { key: 'hard', label: 'Hard', description: 'Less gold, demanding players.' },
  { key: 'brutal', label: 'Brutal', description: 'Tight budget, players churn quickly.' },
];

export const DEFAULT_TERRAIN_FOR_TYPE: Record<WorldType, TerrainId> = {
  continent: TerrainId.Grass,
  islands: TerrainId.Water,
  highlands: TerrainId.Stone,
  desert: TerrainId.Sand,
  frozen: TerrainId.Snow,
  volcanic: TerrainId.Stone,
  flat: TerrainId.Grass,
};
