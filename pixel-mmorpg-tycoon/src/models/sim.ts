import type { EntityId } from '@/core/ids';
import type { ClassKey, EquipSlot, ItemStack } from './rpg';
import type { ActiveEvent, EventRecord, HistorySample } from './events';

export type GameMode = 'sandbox' | 'standard';

export type PlayerBehavior = 'explorer' | 'fighter' | 'grinder' | 'trader' | 'questhunter' | 'casual' | 'pvp';

/** Things that make players happy or unhappy. Accumulated per player (for reviews & feedback). */
export type FactorKey =
  | 'combat' | 'levelup' | 'quest' | 'loot' | 'explore' | 'trade' | 'social'
  | 'death' | 'noContent' | 'tooHard' | 'noQuests' | 'crowded' | 'expensive' | 'poor' | 'pvpKilled' | 'boredom' | 'queue' | 'unpaid'
  | 'cheaters' | 'justice' | 'antiCheatPain' | 'event'
  | 'clan' | 'raid' | 'drama' | 'p2w'
  | 'patch' | 'bugs' | 'nerf' | 'season'
  | 'friends' | 'friendsLeft' | 'home';

export type CheatKind = 'speed' | 'damage' | 'gold' | 'griefer' | 'bot' | 'goldseller';

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
  /** What reporters accused them of (they can be wrong). */
  reportKinds?: Partial<Record<CheatKind, number>>;
  /** Clan membership. */
  clanId?: EntityId;
  /** Season titles ("Season 2 champion"). */
  titles?: string[];
  /** Rented room: the building and the bed inside it. */
  home?: { objectId: EntityId; x: number; y: number };
  /** Friends (player ids) made by playing together. */
  friends?: EntityId[];
  /** Gold stored with a banker (safe when dying). */
  bank?: number;
  /** Highest level whose skills a trainer has taught (only matters if the world has trainers). */
  trainedLevel?: number;
  /** War Cry & co: damage bonus until this tick (runtime). */
  buffUntil?: number;
  buffPower?: number;
}

export type ClanStyle = 'hardcore' | 'casual' | 'pvp' | 'traders';

/** A player guild: a community that hangs out together and raids bosses. */
export interface Clan {
  id: EntityId;
  name: string;
  tag: string;
  /** CSS hex colour (marker under members). */
  color: string;
  style: ClanStyle;
  leaderId: EntityId;
  members: EntityId[];
  foundedAt: number;
  /** Prestige from boss kills; attracts recruits. */
  fame: number;
  /** 0..100: internal tension (wipes, loot drama). Too much and the clan splits. */
  drama: number;
  raidWins: number;
  raidWipes: number;
  /** Boss template id → kills. */
  bossKills: Record<EntityId, number>;
}

export type RaidPhase = 'gathering' | 'fighting';

/** A raid in progress: a group gathers at a boss lair, then pulls the boss. */
export interface RaidState {
  id: EntityId;
  /** null = pick-up group of clanless players. */
  clanId: EntityId | null;
  lairId: EntityId;
  members: EntityId[];
  phase: RaidPhase;
  startedAt: number;
  /** Game minute the gathering gives up. */
  gatherUntil: number;
  fightStartedAt: number | null;
  attempt: number;
  /** Rally point next to the lair. */
  rallyX: number;
  rallyY: number;
  /** Members who died during the current pull (they wait at the rally point). */
  fallen: EntityId[];
}

export interface RaidRecord {
  id: EntityId;
  clanId: EntityId | null;
  /** Clan name (or empty for a pick-up group) at the time of the raid. */
  clanName: string;
  bossName: string;
  lairId: EntityId;
  result: 'win' | 'wipe' | 'abandoned';
  at: number;
  members: number;
  minutes: number;
  worldFirst: boolean;
}

export interface LairStats {
  kills: number;
  wipes: number;
  lastKillAt: number | null;
  firstKill: { clanName: string; at: number } | null;
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
  clans: Clan[];
  raids: RaidState[];
  raidHistory: RaidRecord[];
  /** Per boss lair (spawn area id). */
  lairStats: Record<EntityId, LairStats>;
  auction: AuctionState;
  /** Lifetime room rent paid to the treasury. */
  rentPaid?: number;
  /** Per dungeon entrance: group runs and clears. */
  dungeonStats?: Record<EntityId, { runs: number; clears: number; wipes: number }>;
  /** Per quest: how many times it was taken and completed (quest giver statistics). */
  questStats?: Record<EntityId, { taken: number; done: number }>;
  season: SeasonState;
  patches: PatchState;
}

// ------------------------------------------------------------- auction house
export interface AuctionListing { id: EntityId; sellerId: EntityId; sellerName: string; itemId: EntityId; qty: number; /** Per unit. */ price: number; listedAt: number }
export interface AuctionSale { itemId: EntityId; qty: number; price: number; at: number; seller: string; buyer: string }
export interface AuctionState {
  listings: AuctionListing[];
  /** Most recent sales (newest last). */
  sales: AuctionSale[];
  /** House fee in % of each sale (goes to the world treasury). */
  feePct: number;
  /** Market price per item (moving average of sales). */
  avgPrice: Record<EntityId, number>;
  /** Lifetime totals. */
  volume: number;
  fees: number;
}

// ------------------------------------------------------------- seasons
export interface SeasonRecord {
  number: number;
  endedAt: number;
  topClans: { name: string; tag: string; points: number }[];
  topPlayers: { name: string; points: number }[];
  topPvp: { name: string; kills: number }[];
}
export interface SeasonState {
  number: number;
  startedAt: number;
  lengthDays: number;
  clanPoints: Record<EntityId, number>;
  playerPoints: Record<EntityId, number>;
  pvp: Record<EntityId, number>;
  history: SeasonRecord[];
}

// ------------------------------------------------------------- patches
export interface PatchNote { key: string; params?: Record<string, string | number> }
export interface PatchRecord {
  version: string;
  at: number;
  notes: PatchNote[];
  hype: number;
  bugsIntroduced: number;
  bugsFixed: number;
  moodBefore: number;
  /** Average mood one game day later. */
  moodAfter: number | null;
  popularityBefore: number;
  popularityAfter: number | null;
}
export interface PatchState {
  major: number;
  minor: number;
  lastAt: number | null;
  /** Content counts when the last patch shipped (to detect new content). */
  snapshot: Record<string, number>;
  /** Known bugs live on the servers. */
  bugs: number;
  /** Global XP rate set by patches (1 = normal). */
  xpRate: number;
  history: PatchRecord[];
}

export type ShopModel = 'none' | 'cosmetic' | 'boosts' | 'p2w';
export type IncomeSource = 'subs' | 'shop' | 'sponsors';

export interface LedgerRow {
  day: number;
  income: number;
  expenses: number;
  build: number;
  /** Income split by source. */
  sources?: Partial<Record<IncomeSource, number>>;
}

export interface StudioState {
  /** Studio money in $ (standard mode). */
  funds: number;
  serverTier: number;
  /** $ per active player per game day. */
  subscriptionPrice: number;
  /** How the in-game cash shop makes money. */
  shopModel: ShopModel;
  /** Sandbox only: performance cap for online players. */
  sandboxMaxOnline: number;
  /** Per game day: income/expenses. */
  ledger: LedgerRow[];
  daysInDebt: number;
  /** Standard mode: gradual unlocks. Missing = everything is open (sandbox, older saves). */
  progression?: {
    unlocked: string[];
    research: { key: string; done: number } | null;
    staff: { dev: number; marketer: number; cm: number };
    /** 0..100: how many people hear about the game. */
    hype: number;
  };
}
