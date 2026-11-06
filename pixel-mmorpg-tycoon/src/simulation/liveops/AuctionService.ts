import { createId, type EntityId } from '@/core/ids';
import { EventBus } from '@/core/EventBus';
import { GATHER_SOURCES } from '@/data/rpgDefaults';
import type { ItemDef } from '@/models/rpg';
import type { AuctionListing, AuctionSale, PlayerState } from '@/models/sim';
import { removeItem } from '@/systems/rpg/inventory';
import type { EconomyService } from '../economy/EconomyService';
import type { PlayerManager } from '../players/PlayerManager';
import type { WorldRuntime } from '../WorldRuntime';

export type AuctionEvents = { sale: { sale: AuctionSale; item: ItemDef } };

/** Listings expire after this many game minutes and go back to the seller. */
export const LISTING_MINUTES = 48 * 60;
export const MAX_FEE_PCT = 20;

/**
 * Player-to-player auction house for loot that can only be dropped by monsters
 * (not sold in shops, not gatherable). Players list such loot instead of dumping it
 * on merchants; others buy upgrades and quest items. Prices follow supply and demand;
 * the house fee goes to the world treasury (which pays quest rewards).
 */
export class AuctionService {
  readonly events = new EventBus<AuctionEvents>();
  private dropOnly = new Set<EntityId>();
  private cacheVersion = -1;

  constructor(private world: WorldRuntime, private pm: PlayerManager, private econ: EconomyService, private rand: () => number) {}

  private get state() {
    return this.world.sim.auction;
  }

  private get now() {
    return this.world.clock.totalMinutes;
  }

  /** Items that only drop from monsters. */
  isDropOnly(itemId: EntityId): boolean {
    const s = this.world.entities;
    if (this.cacheVersion !== s.version) {
      this.cacheVersion = s.version;
      const looted = new Set(s.list('creatureTemplates').flatMap((c) => c.loot.map((l) => l.itemId)));
      const sold = new Set(s.list('npcs').flatMap((n) => (n.shop.enabled ? n.shop.items.map((i) => i.itemId) : [])));
      const gatherKeys = new Set(Object.values(GATHER_SOURCES));
      this.dropOnly = new Set(s.list('items').filter((it) => looted.has(it.id) && !sold.has(it.id) && it.category !== 'quest' && !(it.key && gatherKeys.has(it.key)) && it.value > 0).map((it) => it.id));
    }
    return this.dropOnly.has(itemId);
  }

  dropOnlyItems(): ItemDef[] {
    this.isDropOnly('');
    return [...this.dropOnly].map((id) => this.world.entities.get('items', id)).filter((x): x is ItemDef => !!x);
  }

  /** Market price per unit: average of recent sales, or 1.5× the base value before any sale. */
  marketPrice(item: ItemDef): number {
    return Math.max(1, Math.round(this.state.avgPrice[item.id] ?? item.value * 1.5));
  }

  /** Items the player still needs for an active collect/deliver objective. */
  private questNeeds(p: PlayerState): Map<EntityId, number> {
    const need = new Map<EntityId, number>();
    for (const pq of p.quests) {
      if (pq.status !== 'active') continue;
      const q = this.world.entities.get('quests', pq.questId);
      q?.objectives.forEach((o, i) => {
        if ((o.type === 'collect' || o.type === 'deliver') && o.targetId) need.set(o.targetId, (need.get(o.targetId) ?? 0) + Math.max(0, o.count - (pq.counts[i] ?? 0)));
      });
    }
    return need;
  }

  /** Gear gain over what the player wears now (0 = not an upgrade / can't use). */
  private upgradeGain(p: PlayerState, it: ItemDef): number {
    if (it.slot === 'none' || it.levelReq > p.level) return 0;
    const cur = p.equipment[it.slot] ? this.world.entities.get('items', p.equipment[it.slot]!) : undefined;
    return Math.max(0, this.pm.itemScore(it) - (cur ? this.pm.itemScore(cur) : 0));
  }

  hourly(): void {
    this.expire();
    const online = this.pm.online().filter((p) => !p.cheat || p.cheat === 'gold' || p.cheat === 'bot');
    for (const p of online) this.listLoot(p);
    for (const p of [...online].sort(() => this.rand() - 0.5)) this.shop(p);
    this.craftersBuy();
    this.discount();
  }

  private listLoot(p: PlayerState): void {
    const needs = this.questNeeds(p);
    for (const s of [...p.inventory]) {
      if (!this.isDropOnly(s.itemId)) continue;
      const it = this.world.entities.get('items', s.itemId);
      if (!it || this.upgradeGain(p, it) > 0) continue;
      const keep = needs.get(s.itemId) ?? 0;
      const qty = s.qty - keep;
      if (qty <= 0 || this.state.listings.filter((l) => l.sellerId === p.id).length >= (p.cheat === 'bot' ? 20 : 6)) continue;
      // Traders price smart; everyone else guesses.
      // Bots dump loot at half price (crashing the market); traders price smart; everyone else guesses.
      const greed = p.cheat === 'bot' ? 0.45 + this.rand() * 0.1 : p.behavior === 'trader' ? 1 + this.rand() * 0.25 : 0.8 + this.rand() * 0.5;
      p.inventory = removeItem(p.inventory, s.itemId, qty).inv;
      this.state.listings.push({ id: createId('lot'), sellerId: p.id, sellerName: p.name, itemId: s.itemId, qty, price: Math.max(1, Math.round(this.marketPrice(it) * greed)), listedAt: this.now });
    }
  }

  private shop(p: PlayerState): void {
    if (p.gold < 5) return;
    const needs = this.questNeeds(p);
    const lots = [...this.state.listings].sort((a, b) => a.price - b.price);
    for (const lot of lots) {
      if (lot.sellerId === p.id || !this.state.listings.includes(lot)) continue;
      const it = this.world.entities.get('items', lot.itemId);
      if (!it) continue;
      const need = needs.get(lot.itemId) ?? 0;
      const gain = this.upgradeGain(p, it);
      // Flippers: traders buy underpriced lots to resell.
      const flip = p.behavior === 'trader' && lot.price < this.marketPrice(it) * 0.7;
      if (!need && !gain && !flip) continue;
      const qty = need ? Math.min(lot.qty, need) : gain ? 1 : lot.qty;
      const budget = gain ? p.gold * 0.6 : p.gold * 0.8;
      if (qty * lot.price > budget) continue;
      this.buy(p, lot, qty, it);
      if (gain) this.pm.autoEquip(p);
      if (need) { this.pm.questEvent(p, { type: 'collect', itemId: lot.itemId, qty }); needs.set(lot.itemId, need - qty); }
      if (p.gold < 5) return;
    }
  }

  private buy(buyer: PlayerState, lot: AuctionListing, qty: number, it: ItemDef): void {
    if (this.pm.giveItem(buyer, lot.itemId, qty) < qty) return;
    buyer.gold -= qty * lot.price;
    this.pm.feel(buyer, 'loot', 0.5);
    this.settle(lot, qty, buyer.name, it);
  }

  /** Craftsmen NPCs (blacksmiths, healers, merchants) buy cheap materials to craft with. */
  private craftersBuy(): void {
    const crafters = this.world.entities.list('npcs').filter((n) => ['blacksmith', 'healer', 'merchant'].includes(n.type) && n.gold > 20);
    for (const npc of crafters) {
      let budget = Math.floor(npc.gold * 0.08);
      const lots = this.state.listings
        .filter((l) => { const it = this.world.entities.get('items', l.itemId); return it && (it.category === 'material' || it.category === 'food') && l.price <= it.value * 2; })
        .sort((a, b) => a.price - b.price);
      let spent = 0;
      for (const lot of lots) {
        if (budget < lot.price) break;
        const it = this.world.entities.get('items', lot.itemId)!;
        const qty = Math.min(lot.qty, Math.floor(budget / lot.price), 10);
        if (qty <= 0) continue;
        budget -= qty * lot.price;
        spent += qty * lot.price;
        this.settle(lot, qty, npc.name, it);
      }
      if (spent) this.world.entities.update('npcs', npc.id, { gold: npc.gold - spent });
    }
  }

  /** Pay the seller (minus fee), update the market and history. */
  private settle(lot: AuctionListing, qty: number, buyerName: string, it: ItemDef): void {
    const total = qty * lot.price;
    const fee = Math.round((total * this.state.feePct) / 100);
    const seller = this.pm.get(lot.sellerId);
    if (seller) {
      seller.gold += total - fee;
      seller.stats.goldEarned += total - fee;
      this.pm.feel(seller, 'trade', 1.5);
      if (this.state.feePct > 10) this.pm.feel(seller, 'expensive', 0.5);
    }
    this.econ.addToTreasury(fee);
    lot.qty -= qty;
    if (lot.qty <= 0) this.state.listings = this.state.listings.filter((l) => l !== lot);
    const prev = this.state.avgPrice[lot.itemId];
    this.state.avgPrice[lot.itemId] = prev === undefined ? lot.price : prev * 0.7 + lot.price * 0.3;
    this.state.volume += total;
    this.state.fees += fee;
    const sale: AuctionSale = { itemId: lot.itemId, qty, price: lot.price, at: this.now, seller: lot.sellerName, buyer: buyerName };
    this.state.sales.push(sale);
    if (this.state.sales.length > 80) this.state.sales.shift();
    this.events.emit('sale', { sale, item: it });
  }

  /** Expired lots go back to their sellers (or vanish if they quit). */
  private expire(): void {
    for (const lot of [...this.state.listings]) {
      if (this.now - lot.listedAt < LISTING_MINUTES) continue;
      const seller = this.pm.get(lot.sellerId);
      const it = this.world.entities.get('items', lot.itemId);
      if (seller && it) this.pm.giveItem(seller, lot.itemId, lot.qty);
      this.state.listings = this.state.listings.filter((l) => l !== lot);
    }
  }

  /** Lots that do not sell get cheaper — this is how prices find their level. */
  private discount(): void {
    for (const lot of this.state.listings) if (this.now - lot.listedAt >= 360) lot.price = Math.max(1, Math.round(lot.price * 0.93));
  }

  /** Per item: listings, cheapest price, market price, units sold recently. */
  market(): { item: ItemDef; listed: number; cheapest: number | null; price: number; sold: number }[] {
    return this.dropOnlyItems().map((item) => {
      const lots = this.state.listings.filter((l) => l.itemId === item.id);
      return {
        item,
        listed: lots.reduce((n, l) => n + l.qty, 0),
        cheapest: lots.length ? Math.min(...lots.map((l) => l.price)) : null,
        price: this.marketPrice(item),
        sold: this.state.sales.filter((s) => s.itemId === item.id).reduce((n, s) => n + s.qty, 0),
      };
    }).sort((a, b) => b.sold - a.sold || b.listed - a.listed);
  }
}
