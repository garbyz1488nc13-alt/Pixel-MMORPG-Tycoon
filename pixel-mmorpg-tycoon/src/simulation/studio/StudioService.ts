import { getObjectDef } from '@/data/objects';
import { getTier, MONSTER_SLOT_COST, NPC_HIRE_COST, NPC_UPKEEP_PER_DAY, OBJECT_COST, REFUND_RATE, SERVER_TIERS } from '@/data/studio';
import { t } from '@/i18n';
import { ANTI_CHEAT } from '@/data/community';
import type { EntityChange } from '../EntityStore';
import type { WorldRuntime } from '../WorldRuntime';

/** Build cost of one entity in $ (standard mode). */
export function entityCost(change: EntityChange['before'], col: EntityChange['col']): number {
  if (!change) return 0;
  switch (col) {
    case 'objects': {
      const def = getObjectDef((change as { kind: string }).kind);
      return def ? OBJECT_COST[def.category] : 0;
    }
    case 'npcs':
      return NPC_HIRE_COST;
    case 'spawnAreas':
      return (change as { maxCount: number }).maxCount * MONSTER_SLOT_COST;
    default:
      return 0;
  }
}

/**
 * Studio money and server limits. In sandbox mode everything is free and unlimited;
 * in standard mode every build costs money and is capped by the server tier.
 */
export class StudioService {
  /** Last refusal reason (shown to the user). */
  lastError: string | null = null;
  /** While true, entity changes are free (starter content, loading). */
  free = false;

  constructor(private world: WorldRuntime) {}

  get standard(): boolean {
    return this.world.config.gameMode === 'standard';
  }

  get state() {
    return this.world.studio;
  }

  tier() {
    return getTier(this.state.serverTier);
  }

  counts() {
    const e = this.world.entities;
    return { objects: e.count('objects'), npcs: e.count('npcs'), monsters: e.list('spawnAreas').reduce((n, a) => n + a.maxCount, 0) };
  }

  /** $ delta of a batch: positive = cost, negative = refund. `undo` refunds in full. */
  costOf(changes: EntityChange[], mode: 'forward' | 'backward' | 'undo' = 'forward'): number {
    let total = 0;
    for (const c of changes) {
      const before = mode === 'forward' ? c.before : c.after;
      const after = mode === 'forward' ? c.after : c.before;
      const delta = entityCost(after, c.col) - entityCost(before, c.col);
      total += delta >= 0 ? delta : delta * (mode === 'undo' ? 1 : REFUND_RATE);
    }
    return Math.round(total);
  }

  /** Check a batch that has ALREADY been applied to the store. Returns an error or null. */
  check(changes: EntityChange[]): string | null {
    if (!this.standard || this.free) return null;
    const cost = this.costOf(changes);
    const tier = this.tier();
    const c = this.counts();
    const grew = (col: EntityChange['col']) => changes.some((x) => x.col === col && (!x.before || entityCost(x.after, col) > entityCost(x.before, col)));
    if (grew('objects') && c.objects > tier.maxObjects) return t('Server limit: {n} objects. Upgrade the server in the Studio tab.', { n: tier.maxObjects });
    if (grew('npcs') && c.npcs > tier.maxNpcs) return t('Server limit: {n} NPCs. Upgrade the server in the Studio tab.', { n: tier.maxNpcs });
    if (grew('spawnAreas') && c.monsters > tier.maxMonsters) return t('Server limit: {n} monsters. Upgrade the server in the Studio tab.', { n: tier.maxMonsters });
    if (cost > 0 && cost > this.state.funds) return t('Not enough money: needs ${cost}, you have ${funds}.', { cost, funds: Math.floor(this.state.funds) });
    return null;
  }

  /** Charge/refund for a batch. */
  apply(changes: EntityChange[], mode: 'forward' | 'backward' | 'undo' = 'forward'): void {
    if (!this.standard || this.free) return;
    const cost = this.costOf(changes, mode);
    if (!cost) return;
    this.state.funds -= cost;
    this.today().build += cost;
    this.world.events.emit('studio:changed', undefined);
  }

  today() {
    const day = Math.floor(this.world.clock.totalMinutes / 1440) + 1;
    let row = this.state.ledger[this.state.ledger.length - 1];
    if (!row || row.day !== day) {
      row = { day, income: 0, expenses: 0, build: 0 };
      this.state.ledger.push(row);
      if (this.state.ledger.length > 60) this.state.ledger.shift();
    }
    return row;
  }

  /** Hourly finances: subscriptions in, servers & staff out. */
  hourly(online: number): { income: number; expenses: number } {
    if (!this.standard) return { income: 0, expenses: 0 };
    const income = (online * this.state.subscriptionPrice) / 30 / 24;
    const antiCheat = ANTI_CHEAT[this.world.sim.antiCheat]?.costPerDay ?? 0;
    const expenses = (this.tier().upkeepPerDay + this.world.entities.count('npcs') * NPC_UPKEEP_PER_DAY + antiCheat) / 24;
    this.state.funds += income - expenses;
    const row = this.today();
    row.income += income;
    row.expenses += expenses;
    this.world.events.emit('studio:changed', undefined);
    return { income, expenses };
  }

  /** Called at the start of each game day. Returns days in debt. */
  daily(): number {
    if (!this.standard) return 0;
    this.state.daysInDebt = this.state.funds < 0 ? this.state.daysInDebt + 1 : 0;
    return this.state.daysInDebt;
  }

  canUpgrade(): boolean {
    const next = SERVER_TIERS[this.state.serverTier];
    return !!next && this.state.funds >= next.upgradeCost;
  }

  upgrade(): boolean {
    const next = SERVER_TIERS[this.state.serverTier];
    if (!next || this.state.funds < next.upgradeCost) return false;
    this.state.funds -= next.upgradeCost;
    this.today().build += next.upgradeCost;
    this.state.serverTier++;
    this.world.events.emit('studio:changed', undefined);
    return true;
  }
}
