import type { EntityId } from '@/core/ids';
import { getNpcType } from '@/data/npcTypes';
import type { ItemDef, ItemStack, ShopEntry } from '@/models/rpg';
import type { NpcDef } from '@/models/entities';
import { addItem, countItem, removeItem, totalUnits } from '@/systems/rpg/inventory';
import { buyPrice, sellPrice, taxOn } from '@/systems/rpg/pricing';
import { rollLoot } from '@/systems/rpg/loot';
import type { WorldRuntime } from '../WorldRuntime';
import type { ActorManager } from '../actors/ActorManager';
import type { Actor } from '../actors/Actor';
import { EventBus } from '@/core/EventBus';

export type TradeKind = 'sale' | 'purchase' | 'restock' | 'loot' | 'harvest';

export interface Trade {
  at: number;
  kind: TradeKind;
  /** Who traded with the merchant (or looted / harvested). */
  actorId: EntityId | null;
  merchantId: EntityId | null;
  itemId: EntityId;
  qty: number;
  /** Total coins that changed hands (0 for loot/harvest). */
  total: number;
  tax: number;
}

export type EconomyEvents = { trade: Trade };

/** Anything with a purse and a bag that can trade with merchants (NPCs, players). */
export interface Trader {
  id: EntityId;
  name: string;
  getInventory(): ItemStack[];
  getGold(): number;
  set(inventory: ItemStack[], gold: number): void;
}

const MAX_TRADES = 300;
const HISTORY_POINTS = 72;

/**
 * Runs every money/item movement in the world, so totals always add up:
 * merchant gold + NPC gold + treasury only change through trades, restocks and taxes.
 */
export class EconomyService {
  readonly events = new EventBus<EconomyEvents>();
  readonly trades: Trade[] = [];
  readonly totals = { volume: 0, taxes: 0, count: 0, sinks: 0 };
  readonly merchantRevenue = new Map<EntityId, number>();
  readonly itemVolume = new Map<EntityId, number>();
  /** Average shop price per item, sampled every game hour. */
  readonly priceHistory = new Map<EntityId, number[]>();
  readonly treasuryHistory: number[] = [];
  readonly volumeHistory: number[] = [];
  private restockCarry = new Map<string, number>();
  private volumeThisHour = 0;

  constructor(private world: WorldRuntime, private actors: ActorManager) {}

  private get eco() {
    return this.world.rpg.economy;
  }

  item(id: EntityId): ItemDef | undefined {
    return this.world.entities.get('items', id);
  }

  private lookup = (id: EntityId) => this.item(id);

  merchants(): NpcDef[] {
    return this.world.entities.list('npcs').filter((n) => n.shop.enabled);
  }

  private record(t: Trade): void {
    this.trades.push(t);
    if (this.trades.length > MAX_TRADES) this.trades.shift();
    if (t.total > 0) {
      this.totals.volume += t.total;
      this.totals.count++;
      this.volumeThisHour += t.total;
      this.itemVolume.set(t.itemId, (this.itemVolume.get(t.itemId) ?? 0) + t.qty);
    }
    this.totals.taxes += t.tax;
    if (t.merchantId && t.kind === 'purchase') this.merchantRevenue.set(t.merchantId, (this.merchantRevenue.get(t.merchantId) ?? 0) + t.total);
    this.events.emit('trade', t);
  }

  private payTax(amount: number): void {
    if (amount <= 0) return;
    this.eco.treasury += amount;
    this.world.events.emit('rpg:changed', undefined);
  }

  // --------------------------------------------------------- trades
  /** Wrap an NPC definition as a trader. */
  npcTrader(id: EntityId): Trader | null {
    const store = this.world.entities;
    const n = store.get('npcs', id);
    if (!n) return null;
    return {
      id, name: n.name,
      getInventory: () => store.get('npcs', id)?.inventory ?? [],
      getGold: () => store.get('npcs', id)?.gold ?? 0,
      set: (inventory, gold) => { store.update('npcs', id, { inventory, gold }); },
    };
  }

  private resolve(t: EntityId | Trader): Trader | null {
    return typeof t === 'string' ? this.npcTrader(t) : t;
  }

  /** Seller gives items to a merchant for coins. Returns coins received. */
  sellToMerchant(sellerRef: EntityId | Trader, merchantId: EntityId, itemId: EntityId, qty: number): number {
    const store = this.world.entities;
    const seller = this.resolve(sellerRef);
    const merchant = store.get('npcs', merchantId);
    const item = this.item(itemId);
    if (!seller || !merchant || !item || item.value <= 0) return 0;
    const entry = merchant.shop.items.find((s) => s.itemId === itemId) ?? null;
    const unit = buyPrice(item, entry, this.eco);
    const affordable = unit > 0 ? Math.min(qty, Math.floor(merchant.gold / unit)) : qty;
    const n = Math.min(affordable, countItem(seller.getInventory(), itemId));
    if (n <= 0) return 0;
    const total = unit * n;
    const tax = taxOn(total, this.eco);
    const sellerInv = removeItem(seller.getInventory(), itemId, n).inv;
    let shop = merchant.shop;
    let mInv = merchant.inventory;
    if (entry) shop = { ...shop, items: shop.items.map((s) => (s.itemId === itemId ? { ...s, stock: s.stock + n } : s)) };
    else mInv = addItem(mInv, itemId, n, this.lookup, 40).inv;
    seller.set(sellerInv, seller.getGold() + total - tax);
    store.update('npcs', merchantId, { gold: merchant.gold - total, shop, inventory: mInv });
    this.payTax(tax);
    this.record({ at: this.world.clock.totalMinutes, kind: 'sale', actorId: seller.id, merchantId, itemId, qty: n, total, tax });
    return total - tax;
  }

  /** Buyer purchases from a merchant's shop. Returns units bought. */
  buyFromMerchant(buyerRef: EntityId | Trader, merchantId: EntityId, itemId: EntityId, qty: number): number {
    const store = this.world.entities;
    const buyer = this.resolve(buyerRef);
    const merchant = store.get('npcs', merchantId);
    const item = this.item(itemId);
    const entry = merchant?.shop.items.find((s) => s.itemId === itemId);
    if (!buyer || !merchant || !item || !entry || entry.stock <= 0) return 0;
    const unit = sellPrice(item, entry, this.eco);
    const n = Math.min(qty, entry.stock, unit > 0 ? Math.floor(buyer.getGold() / unit) : qty);
    if (n <= 0) return 0;
    const added = addItem(buyer.getInventory(), itemId, n, this.lookup);
    const bought = n - added.leftover;
    if (bought <= 0) return 0;
    const paid = unit * bought;
    const paidTax = taxOn(paid, this.eco);
    buyer.set(added.inv, buyer.getGold() - paid);
    store.update('npcs', merchantId, { gold: merchant.gold + paid - paidTax, shop: { ...merchant.shop, items: merchant.shop.items.map((s) => (s.itemId === itemId ? { ...s, stock: s.stock - bought } : s)) } });
    this.payTax(paidTax);
    this.record({ at: this.world.clock.totalMinutes, kind: 'purchase', actorId: buyer.id, merchantId, itemId, qty: bought, total: paid, tax: paidTax });
    return bought;
  }

  /** Merchants refill shelves from outside suppliers (money leaves the world). */
  restock(minutes: number): void {
    const store = this.world.entities;
    for (const m of this.merchants()) {
      const actor = this.actors.actors.get(m.id);
      if (actor?.state === 'dead') continue;
      let gold = m.gold;
      let changed = false;
      const items = m.shop.items.map((s): ShopEntry => {
        if (s.stock >= s.maxStock) return s;
        const item = this.item(s.itemId);
        if (!item) return s;
        const key = `${m.id}:${s.itemId}`;
        const carry = (this.restockCarry.get(key) ?? 0) + (s.maxStock - s.stock) * this.eco.restockPerHour * (minutes / 60);
        let units = Math.floor(carry);
        this.restockCarry.set(key, carry - units);
        if (units <= 0) return s;
        const unitCost = buyPrice(item, s, this.eco);
        if (unitCost > 0) units = Math.min(units, Math.floor(gold / unitCost));
        if (units <= 0) return s;
        gold -= unitCost * units;
        changed = true;
        this.totals.sinks += unitCost * units;
        this.record({ at: this.world.clock.totalMinutes, kind: 'restock', actorId: null, merchantId: m.id, itemId: s.itemId, qty: units, total: 0, tax: 0 });
        return { ...s, stock: s.stock + units };
      });
      if (changed) store.update('npcs', m.id, { gold, shop: { ...m.shop, items } });
    }
  }

  /** Put an item into an NPC's bag (loot, harvest). Returns units that fit. */
  giveItem(npcId: EntityId, itemId: EntityId, qty: number, kind: 'loot' | 'harvest'): number {
    const n = this.world.entities.get('npcs', npcId);
    if (!n) return 0;
    const res = addItem(n.inventory, itemId, qty, this.lookup);
    const got = qty - res.leftover;
    if (got > 0) {
      this.world.entities.update('npcs', npcId, { inventory: res.inv });
      this.record({ at: this.world.clock.totalMinutes, kind, actorId: npcId, merchantId: null, itemId, qty: got, total: 0, tax: 0 });
    }
    return got;
  }

  /** Killer NPC collects the creature's loot. */
  lootKill(killer: Actor, victimTemplateId: EntityId): { itemId: EntityId; qty: number }[] {
    if (killer.kind !== 'npc') return [];
    const tpl = this.world.entities.get('creatureTemplates', victimTemplateId);
    if (!tpl) return [];
    const drops = rollLoot(tpl.loot, () => this.actors.rand());
    return drops.map((d) => ({ itemId: d.itemId, qty: this.giveItem(killer.defId, d.itemId, d.qty, 'loot') })).filter((d) => d.qty > 0);
  }

  // ---------------------------------------------------- NPC errands
  /** Items an NPC will try to sell (not quest items, not equipment it might use). */
  sellable(n: Pick<NpcDef, 'inventory'>): { itemId: EntityId; qty: number }[] {
    return n.inventory.filter((s) => {
      const it = this.item(s.itemId);
      return it && it.value > 0 && it.category !== 'quest';
    });
  }

  wantsToSell(n: NpcDef): boolean {
    if (n.shop.enabled) return false;
    return totalUnits(this.sellable(n)) >= 4;
  }

  /** Civilians keep a little food at home; returns the food item they'd buy, if any. */
  wantsFood(n: NpcDef): EntityId | null {
    if (n.shop.enabled || getNpcType(n.type).defender) return null;
    const hasFood = n.inventory.some((s) => this.item(s.itemId)?.category === 'food');
    if (hasFood) return null;
    for (const m of this.merchants()) {
      for (const s of m.shop.items) {
        const it = this.item(s.itemId);
        if (it?.category === 'food' && s.stock > 0 && sellPrice(it, s, this.eco) <= n.gold) return s.itemId;
      }
    }
    return null;
  }

  /** Nearest living merchant, preferring one who stocks `itemId`. */
  pickMerchant(from: { x: number; y: number }, itemId?: EntityId): NpcDef | null {
    let best: NpcDef | null = null;
    let bestScore = Infinity;
    for (const m of this.merchants()) {
      const a = this.actors.actors.get(m.id);
      if (!a || a.state === 'dead') continue;
      // Prefer a shop that already trades this item; otherwise the general store (merchant type).
      const stocks = itemId ? m.shop.items.some((s) => s.itemId === itemId) : true;
      const general = m.type === 'merchant';
      const score = Math.hypot(m.x - from.x, m.y - from.y) + (stocks ? 0 : general ? 15 : 40);
      if (score < bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  /** Called when an NPC arrives at the merchant for its errand. */
  completeErrand(a: Actor): void {
    const errand = a.errand;
    a.errand = null;
    if (!errand) return;
    const n = this.world.entities.get('npcs', a.defId);
    if (!n) return;
    if (errand.kind === 'sell') {
      for (const s of this.sellable(n)) this.sellToMerchant(n.id, errand.merchantId, s.itemId, s.qty);
    } else if (errand.kind === 'buy' && errand.itemId) {
      this.buyFromMerchant(n.id, errand.merchantId, errand.itemId, 1 + Math.floor(this.actors.rand() * 2));
    }
  }

  /** Civilians eat at the start of each day (consumes food → creates demand). */
  dailyConsumption(): void {
    for (const n of this.world.entities.list('npcs')) {
      const food = n.inventory.find((s) => this.item(s.itemId)?.category === 'food');
      if (food && !n.shop.enabled) this.world.entities.update('npcs', n.id, { inventory: removeItem(n.inventory, food.itemId, 1).inv });
    }
  }

  // ------------------------------------------------------ analytics
  avgShopPrice(itemId: EntityId): number | null {
    const item = this.item(itemId);
    if (!item) return null;
    const prices: number[] = [];
    for (const m of this.merchants()) for (const s of m.shop.items) if (s.itemId === itemId) prices.push(sellPrice(item, s, this.eco));
    return prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
  }

  sampleHour(): void {
    const tracked = new Set(this.merchants().flatMap((m) => m.shop.items.map((s) => s.itemId)));
    for (const id of tracked) {
      const p = this.avgShopPrice(id);
      if (p === null) continue;
      const h = this.priceHistory.get(id) ?? [];
      h.push(Math.round(p * 10) / 10);
      if (h.length > HISTORY_POINTS) h.shift();
      this.priceHistory.set(id, h);
    }
    this.treasuryHistory.push(Math.round(this.eco.treasury));
    if (this.treasuryHistory.length > HISTORY_POINTS) this.treasuryHistory.shift();
    this.volumeHistory.push(this.volumeThisHour);
    if (this.volumeHistory.length > HISTORY_POINTS) this.volumeHistory.shift();
    this.volumeThisHour = 0;
  }

  /** Total coins in the world (NPC + player purses + treasury). */
  moneySupply(): number {
    const players = this.world.sim.players.reduce((n, p) => n + p.gold, 0);
    return Math.round(this.world.entities.list('npcs').reduce((n, x) => n + x.gold, 0) + players + this.eco.treasury);
  }

  /** Pay a quest's coin reward from the treasury. Returns what was actually paid. */
  payFromTreasury(amount: number): number {
    const paid = Math.max(0, Math.min(amount, Math.floor(this.eco.treasury)));
    this.eco.treasury -= paid;
    if (paid) this.world.events.emit('rpg:changed', undefined);
    return paid;
  }

  dispose(): void {
    this.events.clear();
  }
}
