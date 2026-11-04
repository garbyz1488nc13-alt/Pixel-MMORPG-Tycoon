import type { HistorySample } from '@/models/events';
import type { ActorManager } from '../actors/ActorManager';
import type { EconomyService } from '../economy/EconomyService';
import type { PlayerManager } from '../players/PlayerManager';
import type { WorldRuntime } from '../WorldRuntime';

const MAX_SAMPLES = 168; // 7 game days of hourly samples

/**
 * Records what happens in the world: lifetime totals, hourly samples
 * for the dashboard, and where players spend their time.
 */
export class AnalyticsService {
  private hour = { kills: 0, deaths: 0, quests: 0, joins: 0, quits: 0 };
  private lastVolume = 0;
  private unsubs: (() => void)[] = [];

  constructor(private world: WorldRuntime, private actors: ActorManager, private pm: PlayerManager, private econ: EconomyService) {
    const totals = () => this.world.sim.totals;
    this.lastVolume = econ.totals.volume;
    this.unsubs.push(
      actors.events.on('died', ({ victim, killer }) => {
        if (victim.kind === 'creature' && killer?.kind === 'player') { totals().kills++; this.hour.kills++; }
        if (victim.kind === 'player') {
          totals().deaths++;
          this.hour.deaths++;
          if (killer?.kind === 'player') totals().pvpKills++;
        }
      }),
      pm.events.on('questDone', () => { totals().quests++; this.hour.quests++; }),
      pm.events.on('levelUp', () => { totals().levelUps++; }),
      pm.events.on('joined', ({ returning }) => { if (!returning) this.hour.joins++; }),
      pm.events.on('left', ({ quit }) => { if (quit) this.hour.quits++; }),
    );
  }

  /** Take an hourly sample and count player-hours per region. */
  hourly(): HistorySample {
    const sim = this.world.sim;
    const online = this.pm.online();
    const avg = (f: (p: (typeof online)[number]) => number) => (online.length ? online.reduce((n, p) => n + f(p), 0) / online.length : 0);
    const sample: HistorySample = {
      t: this.world.clock.totalMinutes,
      online: online.length,
      popularity: Math.round(sim.popularity * 10) / 10,
      rating: sim.rating,
      satisfaction: Math.round(avg((p) => p.satisfaction)),
      avgLevel: Math.round(avg((p) => p.level) * 10) / 10,
      treasury: Math.round(this.world.rpg.economy.treasury),
      moneySupply: this.econ.moneySupply(),
      tradeVolume: this.econ.totals.volume - this.lastVolume,
      funds: Math.round(this.world.studio.funds),
      ...this.hour,
    };
    this.lastVolume = this.econ.totals.volume;
    this.hour = { kills: 0, deaths: 0, quests: 0, joins: 0, quits: 0 };
    sim.history.push(sample);
    if (sim.history.length > MAX_SAMPLES) sim.history.shift();

    const regions = this.world.entities.list('regions');
    for (const p of online) {
      const a = this.actors.actors.get(p.id);
      if (!a) continue;
      const x = Math.floor(a.x), y = Math.floor(a.y);
      for (const r of regions) if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) sim.regionVisits[r.id] = (sim.regionVisits[r.id] ?? 0) + 1;
    }
    return sample;
  }

  dispose(): void {
    this.unsubs.forEach((u) => u());
  }
}
