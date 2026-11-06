/** Standard mode: features the studio has to research before players get them. */
export type FeatureKey = 'dungeons' | 'housing' | 'events' | 'clans' | 'auction' | 'seasons';

export interface FeatureDef {
  key: FeatureKey;
  name: string;
  hint: string;
  /** Developer-days of work. */
  work: number;
  /** $ to start the research. */
  cost: number;
  requires?: FeatureKey;
}

export const FEATURES: FeatureDef[] = [
  { key: 'dungeons', name: 'Group dungeons', hint: 'Parties of 3–5 run dungeons and caves for XP and gear.', work: 1.5, cost: 1200 },
  { key: 'housing', name: 'Housing', hint: 'Players rent rooms in houses and hotels: personal storage and a respawn point.', work: 1.5, cost: 1000 },
  { key: 'events', name: 'World events', hint: 'Invasions, festivals, faction wars and other events.', work: 2, cost: 1500 },
  { key: 'clans', name: 'Clans & raids', hint: 'Players form clans and raid bosses together.', work: 3, cost: 2500 },
  { key: 'auction', name: 'Auction house', hint: 'Players trade items with each other.', work: 3, cost: 2500, requires: 'clans' },
  { key: 'seasons', name: 'Seasons & leagues', hint: 'Seasonal ladders with rewards bring players back.', work: 4, cost: 4000, requires: 'clans' },
];

export type StaffRole = 'dev' | 'marketer' | 'cm';

export const STAFF: Record<StaffRole, { name: string; hint: string; perDay: number }> = {
  dev: { name: 'Developer', hint: 'Researches new features faster (1 dev-day of work per game day).', perDay: 120 },
  marketer: { name: 'Marketer', hint: 'Keeps the hype up every hour.', perDay: 90 },
  cm: { name: 'Community manager', hint: 'Keeps players a little happier and talks the game up.', perDay: 70 },
};

export interface Campaign { key: string; name: string; cost: number; hype: number }
export const CAMPAIGNS: Campaign[] = [
  { key: 'post', name: 'Social media post', cost: 150, hype: 8 },
  { key: 'stream', name: 'Ad on a big stream', cost: 600, hype: 25 },
  { key: 'trailer', name: 'Trailer', cost: 1800, hype: 60 },
];

/** Work the founders do themselves (dev-days per game day). */
export const FOUNDER_WORK = 0.5;
/** Players waiting at launch in a standard game: almost nobody knows about it yet. */
export const STANDARD_LAUNCH_PLAYERS = 2;
