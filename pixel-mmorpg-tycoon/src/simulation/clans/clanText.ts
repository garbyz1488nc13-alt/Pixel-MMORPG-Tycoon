import type { WorldRuntime } from '../WorldRuntime';

export function getItemName(world: WorldRuntime, itemId: string): string {
  return world.entities.get('items', itemId)?.name ?? '?';
}
