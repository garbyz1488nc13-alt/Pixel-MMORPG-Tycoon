import type { EntityId } from '@/core/ids';
import type { Difficulty, WorldType } from '@/data/worldPresets';
import type { WorldEntities } from './entities';
import type { RpgConfig } from './rpg';

/** Bump when the saved shape changes; migrations live in persistence/migrations.ts. */
export const WORLD_SCHEMA_VERSION = 3;

export interface WorldConfig {
  worldType: WorldType;
  difficulty: Difficulty;
  seed: number;
  startingGold: number;
  /** Stored now, consumed by the NPC system (Phase 2). */
  initialNpcCount: number;
  /** Stored now, consumed by the player simulation (Phase 4). */
  initialPlayerCount: number;
}

export interface WorldClockState {
  /** Total in-game minutes since world creation. */
  totalMinutes: number;
}

export interface CameraState { x: number; y: number; zoom: number }

/** Map payload in a save: tiles are RLE-encoded to keep saves small. */
export interface SerializedMap {
  width: number;
  height: number;
  tilesRle: string;
}

/** Full, serializable world snapshot. Everything a world needs to be restored. */
export interface WorldSave {
  schemaVersion: number;
  id: EntityId;
  name: string;
  createdAt: number;
  updatedAt: number;
  config: WorldConfig;
  map: SerializedMap;
  clock: WorldClockState;
  camera?: CameraState;
  /** Objects, regions, NPCs, creatures (schema v2+). */
  entities: WorldEntities;
  /** Economy & progression rules (schema v3+). */
  rpg: RpgConfig;
}

/** Lightweight listing record (no map data) for menus. */
export interface WorldMeta {
  id: EntityId;
  name: string;
  createdAt: number;
  updatedAt: number;
  width: number;
  height: number;
  worldType: WorldType;
  difficulty: Difficulty;
  totalMinutes: number;
  /** Small PNG data URL of the map for the world list. */
  thumbnail?: string;
}

export interface SaveSlotRecord {
  /** `${worldId}:${slotKey}` */
  key: string;
  worldId: EntityId;
  slot: SaveSlotKey;
  savedAt: number;
  label: string;
  data: WorldSave;
}

export type SaveSlotKey = 'auto' | 'slot1' | 'slot2' | 'slot3';
export const SAVE_SLOTS: { key: SaveSlotKey; label: string }[] = [
  { key: 'auto', label: 'Autosave' },
  { key: 'slot1', label: 'Slot 1' },
  { key: 'slot2', label: 'Slot 2' },
  { key: 'slot3', label: 'Slot 3' },
];
