import type { EconomyConfig, ItemDef, ShopEntry } from '@/models/rpg';

/** Base value adjusted for rarity. */
export function baseValue(item: ItemDef, eco: EconomyConfig): number {
  return item.value * (eco.rarityMultipliers[item.rarity] ?? 1);
}

/**
 * Supply/demand factor for a merchant's stock: scarce goods cost more, a glut costs less.
 * stock = maxStock → 1.0; empty shelf → 1 + elasticity; double stock → 1 − elasticity/… (clamped).
 */
export function demandFactor(entry: Pick<ShopEntry, 'stock' | 'maxStock'> | null, eco: EconomyConfig): number {
  if (!entry || entry.maxStock <= 0) return 1;
  const shortage = (entry.maxStock - entry.stock) / entry.maxStock; // 1 = empty, 0 = balanced, <0 = surplus
  const f = 1 + eco.demandElasticity * shortage;
  return Math.min(eco.priceCeiling, Math.max(eco.priceFloor, f));
}

/** What a player/NPC pays the merchant. */
export function sellPrice(item: ItemDef, entry: ShopEntry | null, eco: EconomyConfig): number {
  if (item.value <= 0) return 0;
  return Math.max(1, Math.round(baseValue(item, eco) * (1 + eco.sellMarkup) * demandFactor(entry, eco)));
}

/** What the merchant pays when buying an item from someone. */
export function buyPrice(item: ItemDef, entry: ShopEntry | null, eco: EconomyConfig): number {
  if (item.value <= 0) return 0;
  return Math.max(item.value > 0 ? 1 : 0, Math.round(baseValue(item, eco) * eco.buybackRate * demandFactor(entry, eco)));
}

export function taxOn(amount: number, eco: EconomyConfig): number {
  return Math.round(amount * eco.taxRate);
}
