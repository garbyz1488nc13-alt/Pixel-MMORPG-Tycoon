import type { EntityId } from '@/core/ids';
import type { ClassKey, EquipSlot, ItemStack } from './rpg';
import type { ActiveEvent, EventRecord, HistorySample } from './events';

export type GameMode = 'sandbox' | 'standard';

export type PlayerBehavior = 'explorer' | 'fighter' | 'grinder' | 'trader' | 'questhunter' | 'casual' | 'pvp';

/** Things that make players happy or unhappy. Accumulated per player (for reviews & feedback). */
export type FactorKey =
  | 'combat' | 'levelup' | 'quest' | 'loot' | 'explore' | 'trade' | 'social'
  | 'death' | 'noContent' | 'tooHard' | 'noQuests' | 'crowded' | 'expensive' | 'poor' | 'pvpKilled' | 'boredom' | 'queue' | 'unpaid'
  | 'cheaters' | 'justice' | 'antiCheatPain' | 'event';

export type CheatKind = 'speed' | 'damage' | 'gold' | 'griefer';

/** A line of review text: an English source key + params, translated when displayed. */
export interface ReviewLine { key: string; params?: Record<string, string | number> }

export interface Review {
  id: EntityId;
  playerName: string;
  stars: number;
  lines: ReviewLine[];
  at: number;
  level: number;
  hours: number;
  streamer: boolean;
  /** Weight in the rating (streamers count more). */
  weight: number;
  /** Main reason (for complaint statistics). */
  reason: FactorKey | null;
}

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
  /** Streamers broadcast the game to their viewers. */
  streamer?: { viewers: number; streamedMinutes: number };
  /** Hidden from the UI: what this player cheats with (if anything). */
  cheat?: CheatKind;
  /** How many times other players reported this player. */
  reports: number;
}

export interface SimState {
  players: PlayerState[];
  /** 0..100: drives how many new players arrive. */
  popularity: number;
  totalJoined: number;
  totalLeft: number;
  /** Fractional arrivals carried between hours. */
  arrivalCarry: number;
  /** Most recent reviews (newest last). */
  reviews: Review[];
  /** Weighted average stars of recent reviews (0 = no reviews yet). */
  rating: number;
  /** Daily rating snapshots. */
  ratingHistory: number[];
  /** 0 none, 1 basic, 2 advanced, 3 kernel-level. */
  antiCheat: number;
  bans: { cheaters: number; innocent: number; auto: number };
  /** Hourly analytics samples (last 7 game days). */
  history: HistorySample[];
  /** Lifetime counters (survive players quitting). */
  totals: { kills: number; deaths: number; quests: number; pvpKills: number; levelUps: number };
  /** Player-hours spent in each region. */
  regionVisits: Record<EntityId, number>;
  activeEvents: ActiveEvent[];
  eventHistory: EventRecord[];
  /** Game minute each event definition last started (cooldowns). */
  eventLastRun: Record<EntityId, number>;
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
