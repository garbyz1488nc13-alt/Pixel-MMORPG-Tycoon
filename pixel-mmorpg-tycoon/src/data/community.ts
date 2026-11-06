import type { CheatKind, FactorKey, PlayerState } from '@/models/sim';

/**
 * Review phrases. Each factor has a couple of variants so reviews don't repeat.
 * Strings are English source keys (translated when shown).
 */
export const REVIEW_PHRASES: Partial<Record<FactorKey, string[]>> = {
  combat: ['Combat feels great, every fight is fun.', 'Love the monster fights!'],
  levelup: ['Levelling is smooth and rewarding.', 'Got {level} levels in no time, very satisfying.'],
  quest: ['The quests are fun and pay well.', 'Great quest chains, I did them all.'],
  loot: ['The loot is amazing!', 'Found some really rare gear.'],
  explore: ['The world is beautiful to explore.', 'So many places to discover.'],
  trade: ['The economy works, trading is fun.', 'Made a nice profit selling my loot.'],
  social: ['Friendly town, nice place to hang out.', 'Cozy towns full of life.'],
  justice: ['The devs actually ban cheaters. Respect.', 'Glad the cheaters got banned.'],
  event: ['The live events are awesome!', 'Joined a huge event with half the server, epic!'],
  clan: ['My clan is like a second family.', 'Found an amazing guild, we play every evening.'],
  raid: ['Boss raids are the best part, we finally downed it!', 'Spent 3 hours wiping on a boss and loved every minute.'],
  death: ['I die way too often.', 'Monsters keep killing me.'],
  noContent: ['There is nothing to fight at my level.', 'Ran out of monsters for level {level}.'],
  tooHard: ['Monsters are way too strong.', 'Everything one-shots me.'],
  noQuests: ['Not enough quests.', 'I finished all quests in an hour.'],
  crowded: ['Hunting spots are packed, no mobs left.', 'Too many players fighting over the same monsters.'],
  expensive: ['Shop prices are a rip-off.', 'Cannot afford anything in the shops.'],
  poor: ['Impossible to earn gold.', 'I am always broke.'],
  pvpKilled: ['Got ganked by PvP players again.', 'PvP players kill newbies everywhere.'],
  boredom: ['Got bored, nothing new to do.', 'Saw everything already, boring.'],
  queue: ['Server is always full, I cannot log in.', 'Queues, queues, queues.'],
  unpaid: ['Quest rewards did not even pay out.', 'The treasury is broke, no quest gold.'],
  cheaters: ['Full of cheaters and nobody bans them.', 'A speedhacker ruined my session.'],
  patch: ['The devs ship patches all the time, love it!', 'New patch, new content, I am back!'],
  bugs: ['Fell through the map AGAIN. Fix your bugs.', 'So many bugs, did anyone test this patch?'],
  nerf: ['They nerfed my main into the ground. Unsubscribed.', 'Nerf after nerf, devs hate my class.'],
  season: ['Climbing the season ladder with my clan is addictive.', 'Season rewards are worth the grind.'],
  p2w: ['Pay-to-win garbage, whales one-shot everyone.', 'The cash shop sells the best gear. Uninstalled.'],
  home: ['Love my little room at the hotel.', 'Finally rented a room in town, feels like home.'],
  friends: ['Made great friends here, we play every day.', 'Came for the game, stayed for my friends.'],
  friendsLeft: ['All my friends quit, it is lonely now.', 'My whole group left, so am I.'],
  drama: ['Guild drama ruined everything, the officers are clowns.', 'Our clan fell apart over one epic drop. Never again.'],
  antiCheatPain: ['The anti-cheat is so intrusive it slows my PC.', 'Kernel anti-cheat? No thanks.'],
};

export const REVIEW_OPENERS: Record<number, string[]> = {
  1: ['Terrible.', 'Do not play this.', 'Uninstalled.'],
  2: ['Disappointing.', 'Could be better.'],
  3: ['It is okay.', 'Mixed feelings.'],
  4: ['Really good game.', 'Enjoying it a lot.'],
  5: ['Masterpiece!', 'Best MMO I have played.', 'Absolutely love it!'],
};

export const BANNED_INNOCENT_REVIEW = 'I got banned for NOTHING. Never playing again!';
export const STREAMER_REVIEW_GOOD = 'Streamed it to {viewers} viewers — chat loved it!';
export const STREAMER_REVIEW_BAD = 'Streamed it to {viewers} viewers… chat was bored. Not recommended.';

export const CHEAT_KINDS: { key: CheatKind; label: string; hint: string }[] = [
  { key: 'speed', label: 'Speed hack', hint: 'Moves impossibly fast.' },
  { key: 'damage', label: 'Damage hack', hint: 'Kills monsters in one hit.' },
  { key: 'gold', label: 'Gold dupe', hint: 'Duplicates gold and items, inflating the economy.' },
  { key: 'griefer', label: 'Griefer', hint: 'Kills players everywhere, even in safe zones.' },
  { key: 'bot', label: 'Farming bot', hint: 'Farms monsters non-stop and dumps loot on the auction, crashing prices.' },
  { key: 'goldseller', label: 'Gold seller', hint: 'Spams the chat in town with real-money gold offers.' },
];

/** Anti-cheat tiers: detection chance per cheater per game hour, false bans per honest player per day, $ per day. */
export const ANTI_CHEAT: { level: number; name: string; detect: number; falseBan: number; costPerDay: number; annoys: boolean; description: string }[] = [
  { level: 0, name: 'None', detect: 0, falseBan: 0, costPerDay: 0, annoys: false, description: 'Cheaters run free. You can still ban by hand.' },
  { level: 1, name: 'Basic', detect: 0.08, falseBan: 0, costPerDay: 60, annoys: false, description: 'Catches obvious cheaters now and then.' },
  { level: 2, name: 'Advanced', detect: 0.2, falseBan: 0.002, costPerDay: 200, annoys: false, description: 'Catches most cheaters within hours; rare false bans.' },
  { level: 3, name: 'Kernel-level', detect: 0.45, falseBan: 0.006, costPerDay: 500, annoys: true, description: 'Catches nearly everyone fast, but honest players hate it and false bans happen.' },
];

/** Share of newcomers that cheat, and the chance a newcomer is a streamer. */
export function cheaterChance(popularity: number): number {
  return 0.04 + popularity * 0.0006;
}
export function streamerChance(popularity: number): number {
  return 0.006 + popularity * 0.0004;
}

/** Record a report with the cheat the reporter believes it is. */
export function addReport(p: PlayerState, kind: CheatKind, n = 1): void {
  if (n <= 0) return;
  p.reports += n;
  const k = (p.reportKinds ??= {});
  k[kind] = (k[kind] ?? 0) + n;
}

/** A witness guesses the cheat: usually right, sometimes not. */
export function guessCheat(real: CheatKind | undefined, rand: () => number): CheatKind {
  if (real && rand() < 0.75) return real;
  return CHEAT_KINDS[Math.floor(rand() * CHEAT_KINDS.length)].key;
}

/** Accusations sorted by how often they were made. */
export function accusations(p: PlayerState): { kind: CheatKind; n: number }[] {
  return Object.entries(p.reportKinds ?? {}).map(([kind, n]) => ({ kind: kind as CheatKind, n: n ?? 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
}

export const cheatLabel = (k: CheatKind) => CHEAT_KINDS.find((c) => c.key === k)?.label ?? k;
