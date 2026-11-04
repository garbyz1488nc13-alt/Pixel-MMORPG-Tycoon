import type { PlayerManager } from '../players/PlayerManager';
import type { StudioService } from '../studio/StudioService';
import { MINUTES_PER_DAY } from '../time';
import type { SimContext, SimulationSystem } from '../types';

/** Hour/day boundaries: player population, studio finances. */
export class HourlySystem implements SimulationSystem {
  readonly id = 'hourly';
  readonly interval = 4;

  constructor(private players: PlayerManager, private studio: StudioService, private onDay: (debtDays: number) => void) {}

  update(ctx: SimContext, dt: number): void {
    const now = ctx.world.clock.totalMinutes;
    const before = now - dt;
    if (Math.floor(now / 60) > Math.floor(before / 60)) {
      this.players.hourly();
      this.studio.hourly(this.players.online().length);
    }
    if (Math.floor(now / MINUTES_PER_DAY) > Math.floor(before / MINUTES_PER_DAY)) this.onDay(this.studio.daily());
  }
}
