import type { EntityId } from '@/core/ids';

export type EventType = 'invasion' | 'worldBoss' | 'rareMerchant' | 'doubleXp' | 'festival' | 'dungeonOpening' | 'factionWar';

export type EventMetric = 'online' | 'popularity' | 'rating' | 'satisfaction' | 'day';

export interface EventTrigger {
  kind: 'manual' | 'schedule' | 'condition';
  /** schedule: every N game days at this hour. */
  everyDays: number;
  hour: number;
  /** condition: start when metric <op> value. */
  metric: EventMetric;
  op: '<' | '>';
  value: number;
  /** Minimum game hours between two runs. */
  cooldownHours: number;
}

/** A designer-authored world event. Stored in the entity store (undoable). */
export interface EventDef {
  id: EntityId;
  name: string;
  type: EventType;
  enabled: boolean;
  durationHours: number;
  /** Target region (invasion, boss, merchant, dungeon, festival, war). */
  regionId: EntityId | null;
  /** Creature used by invasion / boss / dungeon. */
  templateId: EntityId | null;
  /** Monsters spawned (invasion / dungeon). */
  count: number;
  /** XP multiplier while active (double XP, dungeon). */
  xpMultiplier: number;
  trigger: EventTrigger;
}

/** A running event (saved with the world, including what it spawned). */
export interface ActiveEvent {
  id: EntityId;
  defId: EntityId;
  name: string;
  type: EventType;
  startedAt: number;
  endsAt: number;
  /** Temporary entities created by the event (removed when it ends). */
  spawnAreaIds: EntityId[];
  npcIds: EntityId[];
  /** Counters for the summary. */
  kills: number;
  participants: EntityId[];
}

export interface EventRecord {
  name: string;
  type: EventType;
  startedAt: number;
  endedAt: number;
  kills: number;
  participants: number;
  popularityDelta: number;
}

/** One hourly analytics sample. */
export interface HistorySample {
  t: number;
  online: number;
  popularity: number;
  rating: number;
  satisfaction: number;
  avgLevel: number;
  treasury: number;
  moneySupply: number;
  tradeVolume: number;
  funds: number;
  kills: number;
  deaths: number;
  quests: number;
  joins: number;
  quits: number;
}
