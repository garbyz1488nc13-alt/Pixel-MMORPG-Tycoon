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
export const ENTERABLE = new Set(['hotel', 'hut', 'house_small', 'house_large', 'shop', 'smithy', 'tavern', 'temple', 'bank']);

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

/** Furniture a building comes with when built (taverns and hotels). */
export function defaultInterior(kind: string): import('@/models/entities').Interior | undefined {
  if (kind === 'tavern') return { furniture: [
    { kind: 'fireplace', x: 1, y: 1 }, { kind: 'counter', x: 5, y: 1 }, { kind: 'counter', x: 6, y: 1 }, { kind: 'barrel', x: 7, y: 1 },
    { kind: 'table', x: 3, y: 3 }, { kind: 'chair', x: 2, y: 3 }, { kind: 'table', x: 7, y: 4 }, { kind: 'chair', x: 8, y: 4 },
    { kind: 'bed', x: 10, y: 1 }, { kind: 'bed', x: 10, y: 3 }, { kind: 'bed', x: 10, y: 5 }, { kind: 'rug', x: 5, y: 5 }, { kind: 'plant', x: 1, y: 6 },
  ] };
  if (kind === 'hotel') {
    // A lobby counter and rows of rooms (one bed each).
    const f: import('@/models/entities').Furniture[] = [{ kind: 'counter', x: 3, y: 6 }, { kind: 'counter', x: 4, y: 6 }, { kind: 'plant', x: 1, y: 6 }, { kind: 'rug', x: 5, y: 6 }];
    for (const y of [1, 3]) for (let x = 1; x <= 7; x++) f.push({ kind: 'bed', x, y });
    return { furniture: f };
  }
  return undefined;
}

/** Homes come unfurnished; their default rooms (one per bed) are used until you furnish them. */
export function homeInterior(kind: string): import('@/models/entities').Interior | undefined {
  const beds: Record<string, [number, number][]> = {
    hut: [[1, 1]],
    house_small: [[1, 1], [4, 1]],
    house_large: [[1, 1], [3, 1], [5, 1], [7, 1]],
  };
  if (beds[kind]) return { furniture: [...beds[kind].map(([x, y]) => ({ kind: 'bed' as const, x, y })), { kind: 'table', x: 2, y: 3 }, { kind: 'chair', x: 3, y: 3 }, { kind: 'barrel', x: 1, y: 3 }] };
  return defaultInterior(kind);
}

/** Buildings whose beds are rooms for rent. */
export const RENTABLE = new Set(['hotel', 'tavern', 'hut', 'house_small', 'house_large']);

/** Daily rent for a room (gold to the world treasury). */
export const ROOM_RENT_PER_DAY = 8;
