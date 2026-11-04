import type { ClassKey } from '@/models/rpg';
import type { FactorKey, PlayerBehavior } from '@/models/sim';

/** How much each kind of player cares about each activity (0..1.5). */
export interface BehaviorDef {
  key: PlayerBehavior;
  name: string;
  description: string;
  share: number;
  weights: { fight: number; quest: number; explore: number; trade: number; gather: number; social: number; pvp: number };
  /** Typical session length in game hours [min, max]. */
  session: [number, number];
}

export const BEHAVIORS: BehaviorDef[] = [
  { key: 'explorer', name: 'Explorer', description: 'Wants to see every corner of the world.', share: 0.13, weights: { fight: 0.5, quest: 0.6, explore: 1.4, trade: 0.3, gather: 0.5, social: 0.4, pvp: 0 }, session: [2, 5] },
  { key: 'fighter', name: 'Fighter', description: 'Lives for combat and tough monsters.', share: 0.18, weights: { fight: 1.4, quest: 0.6, explore: 0.4, trade: 0.3, gather: 0.1, social: 0.3, pvp: 0.2 }, session: [2, 6] },
  { key: 'grinder', name: 'Grinder', description: 'Levels up as fast as possible.', share: 0.15, weights: { fight: 1.3, quest: 0.9, explore: 0.2, trade: 0.4, gather: 0.2, social: 0.1, pvp: 0 }, session: [5, 10] },
  { key: 'trader', name: 'Trader', description: 'Gathers, buys low and sells high.', share: 0.1, weights: { fight: 0.4, quest: 0.4, explore: 0.3, trade: 1.4, gather: 1.2, social: 0.5, pvp: 0 }, session: [2, 6] },
  { key: 'questhunter', name: 'Quest Hunter', description: 'Completes every quest available.', share: 0.15, weights: { fight: 0.6, quest: 1.5, explore: 0.6, trade: 0.3, gather: 0.4, social: 0.3, pvp: 0 }, session: [2, 6] },
  { key: 'casual', name: 'Casual Player', description: 'Plays short sessions, hangs out in town.', share: 0.22, weights: { fight: 0.5, quest: 0.6, explore: 0.5, trade: 0.4, gather: 0.4, social: 1.2, pvp: 0 }, session: [1, 2] },
  { key: 'pvp', name: 'PvP Player', description: 'Hunts other players outside safe zones.', share: 0.07, weights: { fight: 0.7, quest: 0.2, explore: 0.4, trade: 0.3, gather: 0, social: 0.2, pvp: 1.5 }, session: [2, 5] },
];
export const getBehavior = (k: PlayerBehavior) => BEHAVIORS.find((b) => b.key === k) ?? BEHAVIORS[0];

export const CLASS_SHARES: [ClassKey, number][] = [['warrior', 0.26], ['mage', 0.2], ['archer', 0.2], ['rogue', 0.17], ['paladin', 0.17]];

/** Satisfaction effect of each factor event, and how it reads in feedback. */
export const FACTORS: Record<FactorKey, { delta: number; label: string; positive: boolean }> = {
  combat: { delta: 0.6, label: 'Fun fights', positive: true },
  levelup: { delta: 6, label: 'Levelling up', positive: true },
  quest: { delta: 7, label: 'Quests', positive: true },
  loot: { delta: 2, label: 'Good loot', positive: true },
  explore: { delta: 3, label: 'Exploring the world', positive: true },
  trade: { delta: 1, label: 'Trading', positive: true },
  social: { delta: 0.4, label: 'Hanging out in town', positive: true },
  death: { delta: -6, label: 'Dying', positive: false },
  noContent: { delta: -2, label: 'Nothing to fight at my level', positive: false },
  tooHard: { delta: -3, label: 'Monsters too strong', positive: false },
  noQuests: { delta: -1.5, label: 'Not enough quests', positive: false },
  crowded: { delta: -1.5, label: 'Crowded hunting spots', positive: false },
  expensive: { delta: -1.5, label: 'Prices too high', positive: false },
  poor: { delta: -1, label: 'Hard to earn gold', positive: false },
  pvpKilled: { delta: -8, label: 'Killed by other players', positive: false },
  boredom: { delta: -1, label: 'Boredom', positive: false },
  queue: { delta: -4, label: 'Server full / queues', positive: false },
  unpaid: { delta: -4, label: 'Quest rewards not paid', positive: false },
  cheaters: { delta: -3, label: 'Cheaters ruin the game', positive: false },
  justice: { delta: 4, label: 'Cheaters get banned', positive: true },
  antiCheatPain: { delta: -1, label: 'Intrusive anti-cheat', positive: false },
  event: { delta: 2, label: 'World events', positive: true },
};

const PREFIX = ['Dark', 'Shadow', 'Pixel', 'Iron', 'Silent', 'Crimson', 'Lucky', 'Frost', 'Storm', 'Mighty', 'Sneaky', 'Epic', 'Lazy', 'Golden', 'Wild', 'Cosmic'];
const ROOT = ['Wolf', 'Blade', 'Panda', 'Mage', 'Knight', 'Fox', 'Dragon', 'Raven', 'Slayer', 'Hunter', 'Bard', 'Tiger', 'Owl', 'Goblin', 'Lord', 'Kitten'];
const UA = ['Bogdan', 'Taras', 'Oksana', 'Kozak', 'Mavka', 'Lisovyk', 'Vovk', 'Sokil', 'Zirka', 'Bandura'];

/** Gamer-tag style names. */
export function playerName(rand: () => number): string {
  const r = rand();
  const n = Math.floor(rand() * 99);
  if (r < 0.15) return `${UA[Math.floor(rand() * UA.length)]}_${n}`;
  if (r < 0.3) return `xX${ROOT[Math.floor(rand() * ROOT.length)]}Xx`;
  return `${PREFIX[Math.floor(rand() * PREFIX.length)]}${ROOT[Math.floor(rand() * ROOT.length)]}${r < 0.65 ? n : ''}`;
}
