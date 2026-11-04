import type { EntityId } from '@/core/ids';
import type { ClassKey, EquipSlot, ItemStack } from './rpg';

export type GameMode = 'sandbox' | 'standard';

export type PlayerBehavior = 'explorer' | 'fighter' | 'grinder' | 'trader' | 'questhunter' | 'casual' | 'pvp';

/** Things that make players happy or unhappy. Accumulated per player (for reviews & feedback). */
export type FactorKey =
  | 'combat' | 'levelup' | 'quest' | 'loot' | 'explore' | 'trade' | 'social'
  | 'death' | 'noContent' | 'tooHard' | 'noQuests' | 'crowded' | 'expensive' | 'poor' | 'pvpKilled' | 'boredom' | 'queue' | 'unpaid';

export interface PlayerQuest { questId: EntityId; counts: number[]; status: 'active' | 'complete' }

/** A simulated MMORPG player. Persisted with the world. */
export interface PlayerState {
  id: EntityId;
  name: string;
  classKey: ClassKey;
  behavior: PlayerBehavior;
  level: number;
  /** XP inside the current level. */
  xp: number;
  gold: number;
  hp: number;
  mana: number;
  inventory: ItemStack[];
  equipment: Partial<Record<EquipSlot, EntityId>>;
  quests: PlayerQuest[];
  completedQuests: EntityId[];
  /** 0..100 */
  satisfaction: number;
  /** Lifetime contribution of each factor to satisfaction. */
  factors: Partial<Record<FactorKey, number>>;
  visitedRegions: EntityId[];
  online: boolean;
  /** Game minute when an offline player comes back. */
  returnAt: number;
  /** Game minutes left in the current session. */
  sessionLeft: number;
  playMinutes: number;
  joinedAt: number;
  x: number;
  y: number;
  stats: { kills: number; deaths: number; questsDone: number; goldEarned: number; pvpKills: number };
}

export interface SimState {
  players: PlayerState[];
  /** 0..100: drives how many new players arrive. */
  popularity: number;
  totalJoined: number;
  totalLeft: number;
  /** Fractional arrivals carried between hours. */
  arrivalCarry: number;
}

export interface StudioState {
  /** Studio money in $ (standard mode). */
  funds: number;
  serverTier: number;
  /** $ per player per 30 game days. */
  subscriptionPrice: number;
  /** Sandbox only: performance cap for online players. */
  sandboxMaxOnline: number;
  /** Per game day: income/expenses. */
  ledger: { day: number; income: number; expenses: number; build: number }[];
  daysInDebt: number;
}
