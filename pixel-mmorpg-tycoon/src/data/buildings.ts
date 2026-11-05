import type { NpcDef } from '@/models/entities';
import type { WorldRuntime } from '@/simulation/WorldRuntime';
import { doorTile } from './furniture';

/** Which building makes an NPC's service work better. */
export const SERVICE_BUILDING: Partial<Record<NpcDef['type'], string>> = {
  merchant: 'shop', blacksmith: 'smithy', healer: 'temple', banker: 'bank', trainer: 'tavern',
};

/** How close (tiles) an NPC's home must be to its building. */
export const HOUSED_RADIUS = 8;

/** The NPC's own building nearby (shop for a merchant, temple for a healer…), if any. */
export function serviceBuilding(world: WorldRuntime, npc: NpcDef) {
  const kind = SERVICE_BUILDING[npc.type];
  if (!kind) return undefined;
  let best: ReturnType<WorldRuntime['entities']['list']>[number] | undefined;
  let bd = HOUSED_RADIUS;
  for (const o of world.entities.list('objects')) {
    if (o.kind !== kind) continue;
    const d = doorTile(o);
    const dist = Math.hypot(d.x - npc.x, d.y - npc.y);
    if (dist <= bd) { bd = dist; best = o; }
  }
  return best as { id: string; kind: string; x: number; y: number } | undefined;
}

/** Temples on the map (players come back to life at the nearest one). */
export function temples(world: WorldRuntime): { x: number; y: number }[] {
  return world.entities.list('objects').filter((o) => o.kind === 'temple').map((o) => doorTile(o));
}

/** Restock speed of merchants: own building ×2, street stall ×0.5. */
export const HOUSED_RESTOCK = 2;
export const STREET_RESTOCK = 0.5;
/** Bank interest per game hour (paid from the treasury). */
export const BANK_INTEREST_PER_HOUR = 0.002;
/** Temple healers heal passers-by: share of max HP per pulse. */
export const TEMPLE_HEAL = 0.12;

/** What a building does (inspector text, English source). */
export const BUILDING_ROLE: Record<string, string> = {
  shop: 'A merchant within 8 tiles of the door restocks twice as fast. Without a shop merchants run a slow street stall.',
  smithy: 'A blacksmith within 8 tiles of the door restocks twice as fast.',
  temple: 'Dead players come back to life at the nearest temple. A healer living by it heals hurt players who walk past.',
  bank: 'Lets a banker take deposits: players store gold safe from death and earn interest from the treasury.',
  tavern: 'Players rest and hang out inside (furniture). A trainer living here gives bonus XP lessons.',
};
export const NPC_HOUSED_HINT: Partial<Record<NpcDef['type'], string>> = {
  merchant: 'Restocks twice as fast.', blacksmith: 'Restocks twice as fast.',
  healer: 'Heals hurt players walking past the temple.', banker: 'Takes deposits; savings earn interest.', trainer: 'Lessons give bonus XP.',
};
export const NPC_STREET_HINT: Partial<Record<NpcDef['type'], string>> = {
  merchant: 'Street stall: restocks at half speed. Build a Shop within 8 tiles.', blacksmith: 'Restocks at half speed. Build a Smithy within 8 tiles.',
  healer: 'Only sells potions. Build a Temple within 8 tiles so they heal players.', banker: 'Cannot take deposits without a Bank within 8 tiles.',
  trainer: 'Teaches skills, but no lessons. Put them by a Tavern.',
};
