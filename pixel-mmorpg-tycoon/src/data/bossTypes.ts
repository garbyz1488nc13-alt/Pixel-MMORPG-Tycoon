import type { CreatureType } from './creatureTypes';

/** A ready-made raid boss the designer can drop on the map as a lair. */
export interface BossPreset {
  key: string;
  /** English source name (translated when the lair is placed). */
  name: string;
  description: string;
  type: CreatureType;
  level: number;
  maxHp: number;
  damage: number;
  defense: number;
  attackRange: number;
  xpReward: number;
  /** Gold each raider receives on a kill. */
  gold: number;
  respawnHours: number;
  minRaid: number;
  /** Loot by item key: [key, chance %, min, max]. Each raider rolls separately. */
  loot: [string, number, number, number][];
}

/**
 * Bosses are tuned so the recommended raid size at the boss level kills them in
 * ~30 real seconds, while a smaller group gets worn down and wipes.
 */
export const BOSS_PRESETS: readonly BossPreset[] = [
  {
    key: 'goblin_king', name: 'Goblin King', description: 'Fat, loud and greedy. A good first raid for a young clan.',
    type: 'goblin', level: 6, maxHp: 2800, damage: 38, defense: 4, attackRange: 1.6, xpReward: 500, gold: 60,
    respawnHours: 3, minRaid: 4,
    loot: [['copper_ring', 50, 1, 1], ['iron_sword', 35, 1, 1], ['health_potion', 100, 2, 3], ['goblin_ear', 100, 2, 4]],
  },
  {
    key: 'broodmother', name: 'Broodmother', description: 'A giant spider queen. Her venom slam hits the whole raid.',
    type: 'spider', level: 10, maxHp: 5600, damage: 58, defense: 8, attackRange: 1.6, xpReward: 1100, gold: 120,
    respawnHours: 5, minRaid: 5,
    loot: [['spider_silk', 100, 3, 5], ['iron_helmet', 35, 1, 1], ['vigor_amulet', 12, 1, 1], ['health_potion', 100, 2, 3]],
  },
  {
    key: 'lich', name: 'Lich of the Crypt', description: 'An undead sorcerer. Casts from a distance and never forgets a wipe.',
    type: 'skeleton', level: 15, maxHp: 8600, damage: 76, defense: 12, attackRange: 3, xpReward: 2200, gold: 220,
    respawnHours: 8, minRaid: 6,
    loot: [['holy_mace', 30, 1, 1], ['steel_longsword', 20, 1, 1], ['elixir', 25, 1, 1], ['map_fragment', 60, 1, 2], ['ancient_relic', 10, 1, 1]],
  },
  {
    key: 'warlord', name: 'Orc Warlord', description: 'Leads the orc hordes. Enrages hard at low health.',
    type: 'orc', level: 20, maxHp: 14800, damage: 102, defense: 16, attackRange: 1.8, xpReward: 4000, gold: 350,
    respawnHours: 12, minRaid: 8,
    loot: [['steel_longsword', 35, 1, 1], ['plate_armor', 15, 1, 1], ['iron_ingot', 100, 3, 6], ['elixir', 35, 1, 1]],
  },
  {
    key: 'demon_lord', name: 'Demon Lord', description: 'The end-game boss. Only the best clans will see him die.',
    type: 'boss', level: 30, maxHp: 26400, damage: 153, defense: 22, attackRange: 2.2, xpReward: 8000, gold: 600,
    respawnHours: 24, minRaid: 10,
    loot: [['plate_armor', 30, 1, 1], ['vigor_amulet', 45, 1, 1], ['elixir', 70, 1, 2], ['ancient_relic', 35, 1, 1]],
  },
  {
    key: 'ancient_dragon', name: 'Ancient Dragon', description: 'A legend. Server-wide bragging rights for the first kill.',
    type: 'dragon', level: 40, maxHp: 39600, damage: 204, defense: 30, attackRange: 2.6, xpReward: 14000, gold: 1000,
    respawnHours: 48, minRaid: 12,
    loot: [['dragon_scale', 100, 1, 3], ['plate_armor', 40, 1, 1], ['elixir', 80, 1, 2], ['ancient_relic', 40, 1, 1]],
  },
];

const BY = new Map(BOSS_PRESETS.map((b) => [b.key, b]));
export const getBossPreset = (key: string): BossPreset => BY.get(key) ?? BOSS_PRESETS[0];

/** Boss mechanics. */
export const BOSS_SLAM_TICKS = 45;
export const BOSS_SLAM_RADIUS = 3;
export const BOSS_SLAM_POWER = 0.7;
export const BOSS_ENRAGE_AT = 0.3;
export const BOSS_ENRAGE_MULT = 1.5;
/** Lair side length in tiles. */
export const LAIR_SIZE = 5;
