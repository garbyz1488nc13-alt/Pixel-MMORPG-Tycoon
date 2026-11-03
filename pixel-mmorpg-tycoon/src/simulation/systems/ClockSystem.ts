import type { SimContext, SimulationSystem } from '../types';
import { t } from '@/i18n';
import { MINUTES_PER_DAY, toGameTime } from '../time';
import type { EventBus } from '@/core/EventBus';
import type { SimEvents } from '../SimulationEngine';

/** Advances world time and announces dawn/dusk and new days. */
export class ClockSystem implements SimulationSystem {
  readonly id = 'clock';
  constructor(private bus: EventBus<SimEvents>) {}

  update(ctx: SimContext, dtMinutes: number): void {
    const before = ctx.world.clock.totalMinutes;
    const after = before + dtMinutes;
    ctx.world.clock.totalMinutes = after;

    if (Math.floor(after / MINUTES_PER_DAY) > Math.floor(before / MINUTES_PER_DAY)) {
      this.bus.emit('sim:message', { text: t('A new day begins — Day {n}.', { n: toGameTime(after).day }) });
    }
    const crossed = (hour: number) => {
      const mark = (m: number) => Math.floor((m - hour * 60) / MINUTES_PER_DAY);
      return mark(after) > mark(before);
    };
    if (crossed(6)) this.bus.emit('sim:message', { text: t('The sun rises over the world.') });
    if (crossed(19)) this.bus.emit('sim:message', { text: t('Night falls. Torches are lit in the towns.') });
  }
}
