import type { Difficulty } from './worldPresets';
import type { ObjectCategory } from './objects';

/** Server tiers: capacity caps and costs (standard mode). */
export interface ServerTier { tier: number; name: string; maxOnline: number; maxNpcs: number; maxMonsters: number; maxObjects: number; upgradeCost: number; upkeepPerDay: number }

export const SERVER_TIERS: ServerTier[] = [
  { tier: 1, name: 'Garage server', maxOnline: 30, maxNpcs: 40, maxMonsters: 40, maxObjects: 400, upgradeCost: 0, upkeepPerDay: 40 },
  { tier: 2, name: 'Rented rack', maxOnline: 80, maxNpcs: 80, maxMonsters: 100, maxObjects: 1000, upgradeCost: 2500, upkeepPerDay: 120 },
  { tier: 3, name: 'Small datacenter', maxOnline: 200, maxNpcs: 150, maxMonsters: 250, maxObjects: 2500, upgradeCost: 9000, upkeepPerDay: 350 },
  { tier: 4, name: 'Cloud cluster', maxOnline: 500, maxNpcs: 300, maxMonsters: 600, maxObjects: 6000, upgradeCost: 30000, upkeepPerDay: 900 },
  { tier: 5, name: 'Global network', maxOnline: 1000, maxNpcs: 500, maxMonsters: 1200, maxObjects: 12000, upgradeCost: 90000, upkeepPerDay: 2200 },
];
export const getTier = (n: number) => SERVER_TIERS[Math.max(0, Math.min(SERVER_TIERS.length - 1, n - 1))];

export const STARTING_FUNDS: Record<Difficulty, number> = { relaxed: 25000, normal: 12000, hard: 6000, brutal: 3000 };

/** Build costs in $ (standard mode). */
export const OBJECT_COST: Record<ObjectCategory, number> = {
  trees: 4, rocks: 4, bushes: 3, houses: 120, buildings: 300, roads: 2, bridges: 15, decorations: 8, special: 500, spawns: 50,
};
export const NPC_HIRE_COST = 150;
export const NPC_UPKEEP_PER_DAY = 12;
export const MONSTER_SLOT_COST = 80;
/** Share of the build cost returned when something is removed. */
export const REFUND_RATE = 0.5;
export const DEFAULT_SUBSCRIPTION = 10;

import type { SimState, StudioState, GameMode } from '@/models/sim';

export function createDefaultStudio(mode: GameMode, difficulty: Difficulty): StudioState {
  return { funds: mode === 'standard' ? STARTING_FUNDS[difficulty] : 0, serverTier: 1, subscriptionPrice: DEFAULT_SUBSCRIPTION, sandboxMaxOnline: 150, ledger: [], daysInDebt: 0 };
}

export function createDefaultSim(): SimState {
  return { players: [], popularity: 20, totalJoined: 0, totalLeft: 0, arrivalCarry: 0 };
}
