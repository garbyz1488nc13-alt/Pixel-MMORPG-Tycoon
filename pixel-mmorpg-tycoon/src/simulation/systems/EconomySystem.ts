import { getNpcType } from '@/data/npcTypes';
import { itemKeyIndex } from '@/data/rpgDefaults';
import type { ActorManager } from '../actors/ActorManager';
import type { EconomyService } from '../economy/EconomyService';
import { MINUTES_PER_DAY, toGameTime } from '../time';
import type { SimContext, SimulationSystem } from '../types';
import { isWorkingHour } from './NpcSystem';

/** Errand cool-down per NPC, in game minutes. */
const ERRAND_COOLDOWN = 120;

/**
 * Economy tick (every 5 game minutes): merchants restock, farmers harvest,
 * NPCs get sent on trade errands, prices and treasury are sampled hourly.
 */
export class EconomySystem implements SimulationSystem {
  readonly id = 'economy';
  readonly interval = 20;
  private nextErrand = new Map<string, number>();
  private lastHarvestHour = new Map<string, number>();

  constructor(private econ: EconomyService, private mgr: ActorManager) {}

  update(ctx: SimContext, dtMinutes: number): void {
    const now = ctx.world.clock.totalMinutes;
    const before = now - dtMinutes;
    const hour = toGameTime(now).minuteOfDay / 60;
    const absHour = Math.floor(now / 60);

    this.econ.restock(dtMinutes);

    const items = itemKeyIndex(ctx.world.entities.list('items'));
    const wheat = items.get('wheat');
    for (const n of ctx.world.entities.list('npcs')) {
      const a = this.mgr.actors.get(n.id);
      if (!a || a.state === 'dead') continue;
      const working = isWorkingHour(hour, n.workStart, n.workEnd);

      // Farmers harvest once per working hour.
      if (n.type === 'farmer' && working && wheat && this.lastHarvestHour.get(n.id) !== absHour) {
        this.lastHarvestHour.set(n.id, absHour);
        this.econ.giveItem(n.id, wheat, 2, 'harvest');
      }

      // Trade errands.
      if (a.errand || a.targetId || a.state === 'flee' || !working) continue;
      if ((this.nextErrand.get(n.id) ?? 0) > now) continue;
      const fresh = ctx.world.entities.get('npcs', n.id)!;
      if (this.econ.wantsToSell(fresh)) {
        const m = this.econ.pickMerchant(fresh, this.econ.sellable(fresh)[0]?.itemId);
        if (m && m.id !== n.id) { a.errand = { kind: 'sell', merchantId: m.id }; a.path = null; this.nextErrand.set(n.id, now + ERRAND_COOLDOWN); continue; }
      }
      if (!getNpcType(n.type).defender && this.mgr.rand() < 0.25) {
        const food = this.econ.wantsFood(fresh);
        const m = food ? this.econ.pickMerchant(fresh, food) : null;
        if (food && m && m.id !== n.id) { a.errand = { kind: 'buy', merchantId: m.id, itemId: food }; a.path = null; }
        this.nextErrand.set(n.id, now + ERRAND_COOLDOWN);
      }
    }

    if (Math.floor(now / 60) > Math.floor(before / 60)) this.econ.sampleHour();
    if (Math.floor(now / MINUTES_PER_DAY) > Math.floor(before / MINUTES_PER_DAY)) this.econ.dailyConsumption();
  }
}
