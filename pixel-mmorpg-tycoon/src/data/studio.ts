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

/** Build cost of one object in $ (standard mode). */
export const OBJECT_COST: Record<ObjectCategory, number> = {
  trees: 4, rocks: 5, bushes: 3, houses: 350, buildings: 900, roads: 2, bridges: 15, decorations: 10, special: 700, spawns: 50,
};
export const NPC_HIRE_COST = 150;
export const NPC_UPKEEP_PER_DAY = 6;
export const MONSTER_SLOT_COST = 80;
/** Share of the build cost returned when something is removed. */
export const REFUND_RATE = 0.5;
/** $ per active player per game day (a game day is ~10 real minutes at x1). */
export const DEFAULT_SUBSCRIPTION = 3;
export const MAX_SUBSCRIPTION = 15;

/**
 * Cash shop models. Chance = purchase chance per online player per game hour (for a
 * happy, average spender); price = average purchase. Greedier models earn more but
 * annoy the players who do not pay.
 */
export const SHOP_MODELS: Record<ShopModel, { label: string; hint: string; chance: number; price: number; anger: number }> = {
  none: { label: 'No cash shop', hint: 'Players love it, you earn only from subscriptions.', chance: 0, price: 0, anger: 0 },
  cosmetic: { label: 'Cosmetics only', hint: 'Hats, mounts and pets. Fair and safe, decent income.', chance: 0.05, price: 6, anger: 0 },
  boosts: { label: 'XP boosts', hint: 'Buyers level faster. More money, some players grumble.', chance: 0.07, price: 9, anger: 0.15 },
  p2w: { label: 'Pay-to-win gear', hint: 'Huge income, but non-payers rage and leave bad reviews.', chance: 0.09, price: 16, anger: 0.6 },
};
/** Sponsorship: $ per streamer viewer per game hour. */
export const SPONSOR_PER_VIEWER_HOUR = 0.004;
/** Sponsorship bonus for a world-first boss kill, per boss level. */
export const WORLD_FIRST_SPONSOR_PER_LEVEL = 60;

import type { SimState, StudioState, GameMode, ShopModel } from '@/models/sim';

export function createDefaultStudio(mode: GameMode, difficulty: Difficulty): StudioState {
  return { funds: mode === 'standard' ? STARTING_FUNDS[difficulty] : 0, serverTier: 1, subscriptionPrice: DEFAULT_SUBSCRIPTION, shopModel: 'cosmetic', sandboxMaxOnline: 150, ledger: [], daysInDebt: 0 };
}

export function createDefaultSim(): SimState {
  return { players: [], popularity: 20, totalJoined: 0, totalLeft: 0, arrivalCarry: 0, ...defaultCommunity(), ...defaultManagement(), ...defaultClans() };
}

export function defaultCommunity(): Pick<SimState, 'reviews' | 'rating' | 'ratingHistory' | 'antiCheat' | 'bans'> {
  return { reviews: [], rating: 0, ratingHistory: [], antiCheat: 0, bans: { cheaters: 0, innocent: 0, auto: 0 } };
}

export function defaultManagement(): Pick<SimState, 'history' | 'totals' | 'regionVisits' | 'activeEvents' | 'eventHistory' | 'eventLastRun'> {
  return { history: [], totals: { kills: 0, deaths: 0, quests: 0, pvpKills: 0, levelUps: 0 }, regionVisits: {}, activeEvents: [], eventHistory: [], eventLastRun: {} };
}

export function defaultClans(): Pick<SimState, 'clans' | 'raids' | 'raidHistory' | 'lairStats'> {
  return { clans: [], raids: [], raidHistory: [], lairStats: {} };
}

/** Building a boss lair (standard mode): base + per recommended raid member. */
export const LAIR_BASE_COST = 500;
export const LAIR_COST_PER_RAIDER = 100;
