export type CreatureType = 'slime' | 'goblin' | 'wolf' | 'skeleton' | 'orc' | 'spider' | 'zombie' | 'dragon' | 'boss';
export type Aggression = 'passive' | 'defensive' | 'aggressive';

export interface CreatureTypeDef {
  key: CreatureType;
  name: string;
  /** Sprite size in tiles (1 = 32px, 2 = 64px). */
  size: number;
  defaults: {
    level: number; maxHp: number; damage: number; defense: number; speed: number;
    aggression: Aggression; aggroRange: number; attackRange: number; respawnMinutes: number; xpReward: number;
  };
}

export const CREATURE_TYPES: readonly CreatureTypeDef[] = [
  { key: 'slime', name: 'Slime', size: 1, defaults: { level: 1, maxHp: 30, damage: 4, defense: 0, speed: 0.8, aggression: 'passive', aggroRange: 3, attackRange: 1.1, respawnMinutes: 12, xpReward: 10 } },
  { key: 'goblin', name: 'Goblin', size: 1, defaults: { level: 4, maxHp: 60, damage: 9, defense: 2, speed: 1.5, aggression: 'aggressive', aggroRange: 5, attackRange: 1.2, respawnMinutes: 20, xpReward: 25 } },
  { key: 'wolf', name: 'Wolf', size: 1, defaults: { level: 6, maxHp: 80, damage: 12, defense: 3, speed: 2.2, aggression: 'aggressive', aggroRange: 6, attackRange: 1.2, respawnMinutes: 20, xpReward: 35 } },
  { key: 'skeleton', name: 'Skeleton', size: 1, defaults: { level: 10, maxHp: 120, damage: 16, defense: 6, speed: 1.2, aggression: 'aggressive', aggroRange: 5, attackRange: 1.3, respawnMinutes: 60, xpReward: 60 } },
  { key: 'orc', name: 'Orc', size: 1, defaults: { level: 14, maxHp: 220, damage: 24, defense: 9, speed: 1.3, aggression: 'aggressive', aggroRange: 6, attackRange: 1.3, respawnMinutes: 90, xpReward: 110 } },
  { key: 'spider', name: 'Giant Spider', size: 1, defaults: { level: 8, maxHp: 90, damage: 14, defense: 3, speed: 1.9, aggression: 'aggressive', aggroRange: 5, attackRange: 1.2, respawnMinutes: 50, xpReward: 45 } },
  { key: 'zombie', name: 'Zombie', size: 1, defaults: { level: 9, maxHp: 150, damage: 13, defense: 4, speed: 0.7, aggression: 'aggressive', aggroRange: 4, attackRange: 1.2, respawnMinutes: 60, xpReward: 50 } },
  { key: 'dragon', name: 'Dragon', size: 2, defaults: { level: 40, maxHp: 3000, damage: 85, defense: 30, speed: 1.4, aggression: 'aggressive', aggroRange: 9, attackRange: 2.2, respawnMinutes: 720, xpReward: 2500 } },
  { key: 'boss', name: 'Demon Lord', size: 2, defaults: { level: 30, maxHp: 2000, damage: 60, defense: 22, speed: 1.2, aggression: 'aggressive', aggroRange: 8, attackRange: 2, respawnMinutes: 480, xpReward: 1500 } },
];

const BY = new Map(CREATURE_TYPES.map((t) => [t.key, t]));
export const getCreatureType = (k: CreatureType): CreatureTypeDef => BY.get(k) ?? CREATURE_TYPES[0];

export const AGGRESSIONS: { key: Aggression; label: string; hint: string }[] = [
  { key: 'passive', label: 'Passive', hint: 'Never attacks; flees when hurt.' },
  { key: 'defensive', label: 'Defensive', hint: 'Fights back only when attacked.' },
  { key: 'aggressive', label: 'Aggressive', hint: 'Attacks anyone entering its aggro range.' },
];
