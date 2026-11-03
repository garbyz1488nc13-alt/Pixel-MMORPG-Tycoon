import type { LootEntry } from '@/models/rpg';
import type { ItemStack } from '@/models/rpg';

/** Roll a loot table: each entry drops independently with chance% and a quantity in [min, max]. */
export function rollLoot(loot: LootEntry[], rand: () => number): ItemStack[] {
  const out: ItemStack[] = [];
  for (const e of loot) {
    if (rand() * 100 >= e.chance) continue;
    const lo = Math.min(e.min, e.max);
    const hi = Math.max(e.min, e.max);
    const qty = lo + Math.floor(rand() * (hi - lo + 1));
    if (qty > 0) out.push({ itemId: e.itemId, qty });
  }
  return out;
}

/** Expected units of each item per kill (for the editor's loot preview). */
export function expectedDrops(loot: LootEntry[]): { itemId: string; perKill: number }[] {
  return loot.map((e) => ({ itemId: e.itemId, perKill: (e.chance / 100) * ((Math.min(e.min, e.max) + Math.max(e.min, e.max)) / 2) }));
}
