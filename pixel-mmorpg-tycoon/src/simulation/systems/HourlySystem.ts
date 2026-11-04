import type { PlayerManager } from '../players/PlayerManager';
import type { StudioService } from '../studio/StudioService';
import type { CommunityService } from '../community/CommunityService';
import type { AnalyticsService } from '../analytics/AnalyticsService';
import type { EventService } from '../events/EventService';
import type { ClanService } from '../clans/ClanService';
import { MINUTES_PER_DAY } from '../time';
import type { SimContext, SimulationSystem } from '../types';

/** Hour/day boundaries: player population, studio finances. */
export class HourlySystem implements SimulationSystem {
  readonly id = 'hourly';
  readonly interval = 4;

  constructor(
    private players: PlayerManager, private studio: StudioService, private onDay: (debtDays: number) => void,
    private community?: CommunityService, private analytics?: AnalyticsService, private worldEvents?: EventService,
    private clans?: ClanService,
  ) {}

  update(ctx: SimContext, dt: number): void {
    const now = ctx.world.clock.totalMinutes;
    const before = now - dt;
    this.worldEvents?.update(before);
    if (Math.floor(now / 60) > Math.floor(before / 60)) {
      this.players.hourly();
      this.community?.hourly();
      this.worldEvents?.hourly();
      this.clans?.hourly();
      this.studio.hourly(this.players.online(), { feel: (p, k, m) => this.players.feel(p, k, m), gainXp: (p, n) => this.players.gainXp(p, n) });
      this.analytics?.hourly();
    }
    if (Math.floor(now / MINUTES_PER_DAY) > Math.floor(before / MINUTES_PER_DAY)) {
      this.community?.daily();
      this.onDay(this.studio.daily());
    }
  }
}
