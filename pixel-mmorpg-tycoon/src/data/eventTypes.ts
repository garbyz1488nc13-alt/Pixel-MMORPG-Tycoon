import type { EventDef, EventMetric, EventType } from '@/models/events';

export interface EventTypeDef {
  type: EventType;
  name: string;
  description: string;
  needsRegion: boolean;
  needsTemplate: boolean;
  /** Region types this event prefers when picking a default target. */
  preferRegions: string[];
  defaults: { durationHours: number; count: number; xpMultiplier: number };
  /** Cost to run in standard mode ($). */
  cost: number;
}

export const EVENT_TYPES: EventTypeDef[] = [
  { type: 'invasion', name: 'Monster Invasion', description: 'A horde of monsters attacks a settlement. Guards and players defend it; kills give bonus XP.', needsRegion: true, needsTemplate: true, preferRegions: ['village', 'town', 'city'], defaults: { durationHours: 4, count: 10, xpMultiplier: 1.5 }, cost: 300 },
  { type: 'worldBoss', name: 'World Boss', description: 'A huge boss appears. Players gather from all over the world to defeat it together.', needsRegion: true, needsTemplate: true, preferRegions: ['wilderness', 'forest', 'dungeon'], defaults: { durationHours: 6, count: 1, xpMultiplier: 2 }, cost: 600 },
  { type: 'rareMerchant', name: 'Rare Merchant', description: 'A travelling merchant sells rare and epic items for a few hours.', needsRegion: true, needsTemplate: false, preferRegions: ['town', 'city', 'village'], defaults: { durationHours: 8, count: 0, xpMultiplier: 1 }, cost: 250 },
  { type: 'doubleXp', name: 'Double XP', description: 'All experience is multiplied. Grinders love it and popularity rises.', needsRegion: false, needsTemplate: false, preferRegions: [], defaults: { durationHours: 6, count: 0, xpMultiplier: 2 }, cost: 400 },
  { type: 'festival', name: 'Festival', description: 'A celebration in town: players gather, socialise and feel happier every hour.', needsRegion: true, needsTemplate: false, preferRegions: ['town', 'city', 'village'], defaults: { durationHours: 6, count: 0, xpMultiplier: 1 }, cost: 500 },
  { type: 'dungeonOpening', name: 'Dungeon Opening', description: 'A dungeon opens its gates: many monsters with bonus XP. Explorers and fighters rush in.', needsRegion: true, needsTemplate: true, preferRegions: ['dungeon', 'cave'], defaults: { durationHours: 8, count: 12, xpMultiplier: 1.5 }, cost: 450 },
  { type: 'factionWar', name: 'Faction War', description: 'Players split into two factions and fight in a region. PvP players thrive, casual players may not.', needsRegion: true, needsTemplate: false, preferRegions: ['wilderness', 'forest'], defaults: { durationHours: 4, count: 0, xpMultiplier: 1 }, cost: 200 },
];
export const getEventType = (t: EventType) => EVENT_TYPES.find((e) => e.type === t) ?? EVENT_TYPES[0];

export const EVENT_METRICS: { key: EventMetric; label: string }[] = [
  { key: 'online', label: 'Players online' },
  { key: 'popularity', label: 'Popularity' },
  { key: 'rating', label: 'Rating' },
  { key: 'satisfaction', label: 'Avg. satisfaction' },
  { key: 'day', label: 'Game day' },
];

export const TRIGGER_KINDS: { key: EventDef['trigger']['kind']; label: string; hint: string }[] = [
  { key: 'manual', label: 'Manual', hint: 'Starts only when you press "Start now".' },
  { key: 'schedule', label: 'Schedule', hint: 'Starts every N game days at a set hour.' },
  { key: 'condition', label: 'Condition', hint: 'Starts automatically when a metric crosses a value.' },
];
