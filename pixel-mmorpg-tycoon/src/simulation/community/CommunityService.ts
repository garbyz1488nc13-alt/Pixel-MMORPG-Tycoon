import { createId, type EntityId } from '@/core/ids';
import { EventBus } from '@/core/EventBus';
import {
  ANTI_CHEAT, BANNED_INNOCENT_REVIEW, cheaterChance, REVIEW_OPENERS, REVIEW_PHRASES, STREAMER_REVIEW_BAD, STREAMER_REVIEW_GOOD, streamerChance,
  addReport, guessCheat,
} from '@/data/community';
import { FACTORS } from '@/data/playerTypes';
import type { CheatKind, FactorKey, PlayerState, Review, ReviewLine } from '@/models/sim';
import type { ActorManager } from '../actors/ActorManager';
import type { PlayerManager } from '../players/PlayerManager';
import type { WorldRuntime } from '../WorldRuntime';

export type CommunityEvents = {
  review: { review: Review };
  streamStart: { player: PlayerState };
  streamEnd: { player: PlayerState; happy: boolean };
  ban: { name: string; cheater: boolean; auto: boolean; kind?: CheatKind };
};

const MAX_REVIEWS = 200;
const RATING_WINDOW = 60;
const CHEATS: CheatKind[] = ['speed', 'damage', 'gold', 'griefer', 'bot', 'bot', 'goldseller'];

/**
 * The player community around the game: reviews and rating, streamers,
 * cheaters, reports, anti-cheat and bans. All effects feed back into popularity.
 */
export class CommunityService {
  readonly events = new EventBus<CommunityEvents>();
  private unsubs: (() => void)[] = [];

  constructor(private world: WorldRuntime, private actors: ActorManager, private pm: PlayerManager) {
    this.unsubs.push(
      pm.events.on('joined', ({ player, returning }) => {
        if (!returning) this.rollNewcomer(player);
        if (player.streamer) this.events.emit('streamStart', { player });
      }),
      pm.events.on('left', ({ player, quit }) => this.onLeft(player, quit)),
    );
  }

  private get sim() {
    return this.world.sim;
  }

  private rand(): number {
    return this.actors.rand();
  }

  private pick<T>(list: T[]): T {
    return list[Math.floor(this.rand() * list.length)];
  }

  // ------------------------------------------------------------ newcomers
  /** Some newcomers stream the game, some cheat. */
  rollNewcomer(p: PlayerState): void {
    const pop = this.sim.popularity;
    if (this.rand() < streamerChance(pop)) {
      // Most streamers are small; a few are huge.
      const r = this.rand();
      p.streamer = { viewers: Math.round(r < 0.7 ? 30 + this.rand() * 300 : r < 0.95 ? 300 + this.rand() * 2000 : 2000 + this.rand() * 15000), streamedMinutes: 0 };
    } else if (this.rand() < cheaterChance(pop)) {
      p.cheat = this.pick(CHEATS);
      // Bots and gold sellers never sleep and don't care about fun.
      if (p.cheat === 'bot' || p.cheat === 'goldseller') { p.behavior = p.cheat === 'bot' ? 'grinder' : 'trader'; p.sessionLeft = 60 * 48; }
    }
  }

  // -------------------------------------------------------------- reviews
  stars(satisfaction: number): number {
    return satisfaction < 20 ? 1 : satisfaction < 40 ? 2 : satisfaction < 60 ? 3 : satisfaction < 80 ? 4 : 5;
  }

  private phrase(key: FactorKey, p: PlayerState): ReviewLine | null {
    const list = REVIEW_PHRASES[key];
    if (!list) return null;
    return { key: this.pick(list), params: { level: p.level } };
  }

  /** Build a review from what this player felt most. */
  composeReview(p: PlayerState): Review {
    const stars = this.stars(p.satisfaction);
    const lines: ReviewLine[] = [{ key: this.pick(REVIEW_OPENERS[stars]) }];
    const worst = this.pm.worstFactor(p);
    const best = this.pm.bestFactor(p);
    if (p.streamer) lines.push({ key: stars >= 3 ? STREAMER_REVIEW_GOOD : STREAMER_REVIEW_BAD, params: { viewers: p.streamer.viewers.toLocaleString() } });
    if (stars <= 3 && worst) { const l = this.phrase(worst, p); if (l) lines.push(l); }
    if (stars >= 3 && best) { const l = this.phrase(best, p); if (l) lines.push(l); }
    return {
      id: createId('rev'), playerName: p.name, stars, lines, at: this.world.clock.totalMinutes, level: p.level,
      hours: Math.round(p.playMinutes / 60), streamer: !!p.streamer, weight: p.streamer ? 3 : 1,
      reason: stars <= 3 ? worst : best,
    };
  }

  addReview(r: Review): void {
    this.sim.reviews.push(r);
    if (this.sim.reviews.length > MAX_REVIEWS) this.sim.reviews.shift();
    this.recomputeRating();
    this.events.emit('review', { review: r });
  }

  /** Weighted average of recent reviews; newer reviews count a bit more. */
  recomputeRating(): number {
    const recent = this.sim.reviews.slice(-RATING_WINDOW);
    let sum = 0, w = 0;
    recent.forEach((r, i) => {
      const weight = r.weight * (0.5 + (i + 1) / recent.length);
      sum += r.stars * weight;
      w += weight;
    });
    this.sim.rating = w ? Math.round((sum / w) * 100) / 100 : 0;
    return this.sim.rating;
  }

  private onLeft(p: PlayerState, quit: boolean): void {
    if (p.streamer) this.events.emit('streamEnd', { player: p, happy: p.satisfaction >= 55 });
    // Quitters almost always leave a review; regulars sometimes do after a decent session.
    const chance = quit ? 0.8 : p.playMinutes > 90 ? 0.2 : 0;
    if (this.rand() < chance || (p.streamer && p.playMinutes > 60)) this.addReview(this.composeReview(p));
  }

  // ------------------------------------------------------------- cheaters
  /** 0..100: how suspicious a player looks from reports and stats (cheats are not visible directly). */
  suspicion(p: PlayerState): number {
    const hours = Math.max(1, p.playMinutes / 60);
    const kph = p.stats.kills / hours;
    const gph = p.stats.goldEarned / hours;
    let s = p.reports * 4 + Math.max(0, kph - 10) * 2 + Math.max(0, gph - 80) / 6 + p.stats.pvpKills * 2;
    if (p.cheat === 'speed') s += 20; // visibly too fast
    return Math.max(0, Math.min(100, Math.round(s)));
  }

  suspects(): PlayerState[] {
    return this.sim.players.filter((p) => p.online && (p.reports > 0 || this.suspicion(p) >= 15)).sort((a, b) => this.suspicion(b) - this.suspicion(a));
  }

  /** Ban a player. Banning an honest player backfires. */
  ban(id: EntityId, auto = false): boolean {
    const p = this.pm.get(id);
    if (!p) return false;
    const cheater = !!p.cheat;
    this.pm.removePlayer(p);
    if (auto) this.sim.bans.auto++;
    if (cheater) {
      this.sim.bans.cheaters++;
      this.sim.popularity = Math.min(100, this.sim.popularity + (p.reports > 3 ? 1.5 : 0.5));
      for (const o of this.pm.online()) if (!o.cheat) this.pm.feel(o, 'justice', p.reports > 2 ? 1 : 0.4);
    } else {
      this.sim.bans.innocent++;
      this.sim.popularity = Math.max(1, this.sim.popularity - 4);
      for (const o of this.pm.online()) o.satisfaction = Math.max(0, o.satisfaction - 2);
      this.addReview({
        id: createId('rev'), playerName: p.name, stars: 1, lines: [{ key: BANNED_INNOCENT_REVIEW }], at: this.world.clock.totalMinutes,
        level: p.level, hours: Math.round(p.playMinutes / 60), streamer: !!p.streamer, weight: p.streamer ? 6 : 2, reason: null,
      });
    }
    this.events.emit('ban', { name: p.name, cheater, auto, kind: p.cheat });
    return true;
  }

  // -------------------------------------------------------------- hourly
  hourly(): void {
    const sim = this.sim;
    const online = this.pm.online();
    const ac = ANTI_CHEAT[sim.antiCheat] ?? ANTI_CHEAT[0];

    // Rating drives popularity once there are reviews.
    if (sim.reviews.length >= 3) sim.popularity += (sim.rating - 3) * 0.4;

    for (const p of online) {
      // Streamers: happy streams bring waves of viewers-turned-players; bored ones hurt.
      if (p.streamer) {
        const mood = (p.satisfaction - 50) / 50;
        p.streamer.streamedMinutes += 60;
        sim.popularity += (p.streamer.viewers / 2500) * mood * 2;
        if (mood > 0.2) sim.arrivalCarry += (p.streamer.viewers / 800) * mood;
      }
      if (!p.cheat) continue;
      // Cheaters: dupes inflate the economy; everyone nearby has a worse time and some report them.
      if (p.cheat === 'gold') { p.gold += 80; p.stats.goldEarned += 80; }
      const a = this.actors.actors.get(p.id);
      if (!a) continue;
      let reports = 0;
      for (const o of this.actors.spatial.query(a.x, a.y, 12)) {
        if (o.kind !== 'player' || o.id === a.id) continue;
        const other = this.pm.get(o.defId);
        if (!other || other.cheat) continue;
        this.pm.feel(other, 'cheaters', 0.25);
        // Only some witnesses bother to report, and at most a few per hour.
        if (reports < 3 && this.rand() < 0.12) reports++;
      }
      for (let i = 0; i < reports; i++) addReport(p, guessCheat(p.cheat, () => this.rand()));
    }

    // Honest top players sometimes get reported by jealous rivals.
    const top = [...online].filter((p) => !p.cheat).sort((a, b) => b.level - a.level)[0];
    // Jealous accusations: "nobody gets that strong legit, must be a damage/speed hack".
    if (top && this.rand() < 0.08) addReport(top, this.rand() < 0.6 ? 'damage' : 'speed');

    // Anti-cheat: auto-bans, false positives, and annoyance at the highest level.
    if (ac.detect > 0) {
      for (const p of [...online]) {
        if (p.cheat && this.rand() < ac.detect) this.ban(p.id, true);
        else if (!p.cheat && this.rand() < ac.falseBan / 24) this.ban(p.id, true);
      }
    }
    if (ac.annoys) for (const p of this.pm.online()) this.pm.feel(p, 'antiCheatPain', 0.3);

    sim.popularity = Math.max(1, Math.min(100, sim.popularity));
  }

  daily(): void {
    if (this.sim.reviews.length) {
      this.sim.ratingHistory.push(this.sim.rating);
      if (this.sim.ratingHistory.length > 60) this.sim.ratingHistory.shift();
    }
  }

  /** Most common reasons in recent negative / positive reviews. */
  reviewReasons(): { bad: [FactorKey, number][]; good: [FactorKey, number][] } {
    const bad = new Map<FactorKey, number>();
    const good = new Map<FactorKey, number>();
    for (const r of this.sim.reviews.slice(-RATING_WINDOW)) {
      if (!r.reason) continue;
      const m = FACTORS[r.reason].positive ? good : bad;
      m.set(r.reason, (m.get(r.reason) ?? 0) + 1);
    }
    const sort = (m: Map<FactorKey, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { bad: sort(bad), good: sort(good) };
  }

  dispose(): void {
    this.unsubs.forEach((u) => u());
    this.events.clear();
  }
}
