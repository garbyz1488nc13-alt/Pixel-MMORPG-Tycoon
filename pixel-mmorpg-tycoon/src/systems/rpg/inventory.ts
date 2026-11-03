import type { EntityId } from '@/core/ids';
import type { ItemDef, ItemStack } from '@/models/rpg';

/**
 * Pure inventory operations on ItemStack[] respecting each item's stack size.
 * A slot holds at most `stackSize` units; `maxSlots` limits the number of stacks.
 */
export type ItemLookup = (id: EntityId) => ItemDef | undefined;

export function countItem(inv: ItemStack[], itemId: EntityId): number {
  return inv.reduce((n, s) => (s.itemId === itemId ? n + s.qty : n), 0);
}

/** Add items; returns the new inventory and how many did not fit. */
export function addItem(inv: ItemStack[], itemId: EntityId, qty: number, items: ItemLookup, maxSlots = 24): { inv: ItemStack[]; leftover: number } {
  const def = items(itemId);
  const stackSize = Math.max(1, def?.stackSize ?? 1);
  const out = inv.map((s) => ({ ...s }));
  let left = qty;
  for (const s of out) {
    if (left <= 0) break;
    if (s.itemId !== itemId || s.qty >= stackSize) continue;
    const add = Math.min(stackSize - s.qty, left);
    s.qty += add;
    left -= add;
  }
  while (left > 0 && out.length < maxSlots) {
    const add = Math.min(stackSize, left);
    out.push({ itemId, qty: add });
    left -= add;
  }
  return { inv: out, leftover: left };
}

/** Remove up to qty; returns the new inventory and how many were actually removed. */
export function removeItem(inv: ItemStack[], itemId: EntityId, qty: number): { inv: ItemStack[]; removed: number } {
  let left = qty;
  const out: ItemStack[] = [];
  // Take from the smallest stacks first to keep inventories tidy.
  const order = inv.map((s, i) => ({ s, i })).sort((a, b) => (a.s.itemId === itemId && b.s.itemId === itemId ? a.s.qty - b.s.qty : 0));
  const taken = new Map<number, number>();
  for (const { s, i } of order) {
    if (left <= 0) break;
    if (s.itemId !== itemId) continue;
    const take = Math.min(s.qty, left);
    taken.set(i, take);
    left -= take;
  }
  inv.forEach((s, i) => {
    const q = s.qty - (taken.get(i) ?? 0);
    if (q > 0) out.push({ ...s, qty: q });
  });
  return { inv: out, removed: qty - left };
}

export function totalUnits(inv: ItemStack[]): number {
  return inv.reduce((n, s) => n + s.qty, 0);
}

/** Merge stacks of the same item (used after editing). */
export function compact(inv: ItemStack[], items: ItemLookup, maxSlots = 24): ItemStack[] {
  let out: ItemStack[] = [];
  for (const s of inv) out = addItem(out, s.itemId, s.qty, items, maxSlots).inv;
  return out;
}
