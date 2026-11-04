import type { FurnitureKind } from '@/models/entities';
import { getObjectDef } from './objects';

/** Furniture you can place inside buildings. Cost applies in standard mode. */
export const FURNITURE: { key: FurnitureKind; name: string; cost: number; hint?: string }[] = [
  { key: 'spawn', name: 'Spawn point', cost: 50, hint: 'Players log in here and walk out of the door.' },
  { key: 'bed', name: 'Bed', cost: 8, hint: 'Tired players come in to rest.' },
  { key: 'table', name: 'Table', cost: 6 },
  { key: 'chair', name: 'Chair', cost: 3 },
  { key: 'counter', name: 'Counter', cost: 10 },
  { key: 'barrel', name: 'Barrel', cost: 4 },
  { key: 'fireplace', name: 'Fireplace', cost: 15 },
  { key: 'rug', name: 'Rug', cost: 5 },
  { key: 'plant', name: 'Plant', cost: 3 },
  { key: 'shelf', name: 'Shelf', cost: 6 },
];
export const getFurniture = (k: FurnitureKind) => FURNITURE.find((f) => f.key === k) ?? FURNITURE[0];

/** Buildings you can walk into. */
export const ENTERABLE = new Set(['hut', 'house_small', 'house_large', 'shop', 'smithy', 'tavern', 'temple', 'bank']);

/** Interior room size (tiles) for a building. */
export function interiorSize(kind: string): { w: number; h: number } {
  const d = getObjectDef(kind);
  return { w: Math.max(6, (d?.w ?? 2) * 3), h: Math.max(5, (d?.h ?? 2) * 2 + 2) };
}

/** Tile just outside the building's door (bottom centre). */
export function doorTile(o: { kind: string; x: number; y: number }): { x: number; y: number } {
  const d = getObjectDef(o.kind);
  return { x: o.x + Math.floor((d?.w ?? 1) / 2), y: o.y + (d?.h ?? 1) };
}
