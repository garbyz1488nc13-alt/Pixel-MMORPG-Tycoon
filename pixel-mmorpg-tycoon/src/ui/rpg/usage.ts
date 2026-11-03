import type { EntityId } from '@/core/ids';
import type { EntityStore } from '@/simulation/EntityStore';

export interface ItemUsage { shops: string[]; inventories: string[]; loot: string[]; quests: string[] }

/** Where an item is referenced across the world. */
export function itemUsage(store: EntityStore, id: EntityId): ItemUsage {
  const npcs = store.list('npcs');
  return {
    shops: npcs.filter((n) => n.shop.enabled && n.shop.items.some((s) => s.itemId === id)).map((n) => n.name),
    inventories: npcs.filter((n) => n.inventory.some((s) => s.itemId === id)).map((n) => n.name),
    loot: store.list('creatureTemplates').filter((c) => c.loot.some((l) => l.itemId === id)).map((c) => c.name),
    quests: store.list('quests').filter((q) => q.rewards.items.some((s) => s.itemId === id) || q.objectives.some((o) => o.targetId === id)).map((q) => q.name),
  };
}

export const usageCount = (u: ItemUsage) => u.shops.length + u.inventories.length + u.loot.length + u.quests.length;
