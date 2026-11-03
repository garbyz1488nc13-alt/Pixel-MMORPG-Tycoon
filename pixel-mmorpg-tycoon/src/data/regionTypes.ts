export type RegionType = 'town' | 'village' | 'city' | 'forest' | 'dungeon' | 'cave' | 'wilderness' | 'safezone';

export interface RegionTypeDef { key: RegionType; name: string; color: number; safe: boolean; /** Has a "Populate" generator. */ populate: boolean }

export const REGION_TYPES: readonly RegionTypeDef[] = [
  { key: 'village', name: 'Village', color: 0xf2c14e, safe: true, populate: true },
  { key: 'town', name: 'Town', color: 0xffa94d, safe: true, populate: true },
  { key: 'city', name: 'City', color: 0xff7a59, safe: true, populate: true },
  { key: 'forest', name: 'Forest', color: 0x6cc551, safe: false, populate: true },
  { key: 'dungeon', name: 'Dungeon', color: 0xb56cff, safe: false, populate: true },
  { key: 'cave', name: 'Cave', color: 0x9aa3ad, safe: false, populate: true },
  { key: 'wilderness', name: 'Wilderness', color: 0x7fd7ff, safe: false, populate: false },
  { key: 'safezone', name: 'Safe Zone', color: 0x9cf0c0, safe: true, populate: false },
];
const BY = new Map(REGION_TYPES.map((t) => [t.key, t]));
export const getRegionType = (k: RegionType): RegionTypeDef => BY.get(k) ?? REGION_TYPES[6];
