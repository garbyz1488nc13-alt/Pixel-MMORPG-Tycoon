/**
 * Map object registry. `key` is stored in saves, so keys must stay stable.
 * Footprint is in tiles, anchored at the object's top-left tile.
 * Sprites are drawn procedurally in game/textures/ObjectSprites.ts.
 */
export type ObjectCategory = 'trees' | 'rocks' | 'bushes' | 'houses' | 'buildings' | 'roads' | 'bridges' | 'decorations' | 'special' | 'spawns';

export interface ObjectDef {
  key: string;
  name: string;
  category: ObjectCategory;
  /** Footprint in tiles. */
  w: number;
  h: number;
  /** Blocks movement on its footprint. */
  blocks: boolean;
  /** Lies flat on the ground (roads, bridges): drawn under standing things. */
  flat?: boolean;
  /** Makes its tiles walkable even over water/lava (bridges). */
  walkableOverride?: boolean;
  /** Extra sprite height above the footprint, in tiles (trees, towers). */
  overhang?: number;
}

export const OBJECTS: readonly ObjectDef[] = [
  { key: 'tree_oak', name: 'Oak Tree', category: 'trees', w: 1, h: 1, blocks: true, overhang: 1 },
  { key: 'tree_pine', name: 'Pine Tree', category: 'trees', w: 1, h: 1, blocks: true, overhang: 1 },
  { key: 'tree_palm', name: 'Palm Tree', category: 'trees', w: 1, h: 1, blocks: true, overhang: 1 },
  { key: 'tree_dead', name: 'Dead Tree', category: 'trees', w: 1, h: 1, blocks: true, overhang: 1 },
  { key: 'tree_snow', name: 'Snowy Pine', category: 'trees', w: 1, h: 1, blocks: true, overhang: 1 },
  { key: 'rock', name: 'Rock', category: 'rocks', w: 1, h: 1, blocks: true },
  { key: 'boulder', name: 'Boulder', category: 'rocks', w: 2, h: 2, blocks: true },
  { key: 'ore_rock', name: 'Ore Vein', category: 'rocks', w: 1, h: 1, blocks: true },
  { key: 'bush', name: 'Bush', category: 'bushes', w: 1, h: 1, blocks: false },
  { key: 'berry_bush', name: 'Berry Bush', category: 'bushes', w: 1, h: 1, blocks: false },
  { key: 'house_small', name: 'Small House', category: 'houses', w: 2, h: 2, blocks: true, overhang: 1 },
  { key: 'house_large', name: 'Large House', category: 'houses', w: 3, h: 3, blocks: true, overhang: 1 },
  { key: 'shop', name: 'Shop', category: 'buildings', w: 3, h: 2, blocks: true, overhang: 1 },
  { key: 'smithy', name: 'Smithy', category: 'buildings', w: 3, h: 2, blocks: true, overhang: 1 },
  { key: 'tavern', name: 'Tavern', category: 'buildings', w: 4, h: 3, blocks: true, overhang: 1 },
  { key: 'hotel', name: 'Hotel', category: 'buildings', w: 3, h: 3, blocks: true, overhang: 2 },
  { key: 'temple', name: 'Temple', category: 'buildings', w: 3, h: 3, blocks: true, overhang: 2 },
  { key: 'bank', name: 'Bank', category: 'buildings', w: 3, h: 2, blocks: true, overhang: 1 },
  { key: 'tower', name: 'Watchtower', category: 'buildings', w: 2, h: 2, blocks: true, overhang: 3 },
  { key: 'wall', name: 'Stone Wall', category: 'buildings', w: 1, h: 1, blocks: true },
  { key: 'road', name: 'Road', category: 'roads', w: 1, h: 1, blocks: false, flat: true },
  { key: 'dirt_path', name: 'Dirt Path', category: 'roads', w: 1, h: 1, blocks: false, flat: true },
  { key: 'bridge', name: 'Bridge', category: 'bridges', w: 1, h: 1, blocks: false, flat: true, walkableOverride: true },
  { key: 'fence', name: 'Fence', category: 'decorations', w: 1, h: 1, blocks: true },
  { key: 'lamp', name: 'Lamp Post', category: 'decorations', w: 1, h: 1, blocks: true, overhang: 1 },
  { key: 'well', name: 'Well', category: 'decorations', w: 1, h: 1, blocks: true },
  { key: 'sign', name: 'Signpost', category: 'decorations', w: 1, h: 1, blocks: false },
  { key: 'barrel', name: 'Barrel', category: 'decorations', w: 1, h: 1, blocks: true },
  { key: 'crate', name: 'Crate', category: 'decorations', w: 1, h: 1, blocks: true },
  { key: 'campfire', name: 'Campfire', category: 'decorations', w: 1, h: 1, blocks: true },
  { key: 'flowers', name: 'Flowers', category: 'decorations', w: 1, h: 1, blocks: false, flat: true },
  { key: 'statue', name: 'Statue', category: 'decorations', w: 1, h: 1, blocks: true, overhang: 1 },
  { key: 'palisade', name: 'Wooden Palisade', category: 'buildings', w: 1, h: 1, blocks: true, overhang: 1 },
  { key: 'log_wall', name: 'Log Wall', category: 'buildings', w: 1, h: 1, blocks: true },
  { key: 'hut', name: 'Straw Hut', category: 'houses', w: 2, h: 2, blocks: true, overhang: 1 },
  { key: 'tent', name: 'Tent', category: 'decorations', w: 2, h: 1, blocks: true, overhang: 1 },
  { key: 'banner', name: 'Banner', category: 'decorations', w: 1, h: 1, blocks: true, overhang: 1 },
  { key: 'torch', name: 'Standing Torch', category: 'decorations', w: 1, h: 1, blocks: true, overhang: 1 },
  { key: 'hay', name: 'Hay Bale', category: 'decorations', w: 1, h: 1, blocks: true },
  { key: 'cart', name: 'Cart', category: 'decorations', w: 2, h: 1, blocks: true },
  { key: 'stall', name: 'Market Stall', category: 'decorations', w: 2, h: 1, blocks: true, overhang: 1 },
  { key: 'bench', name: 'Bench', category: 'decorations', w: 1, h: 1, blocks: false },
  { key: 'gravestone', name: 'Gravestone', category: 'decorations', w: 1, h: 1, blocks: true },
  { key: 'bones', name: 'Bones', category: 'decorations', w: 1, h: 1, blocks: false, flat: true },
  { key: 'stump', name: 'Tree Stump', category: 'decorations', w: 1, h: 1, blocks: true },
  { key: 'mushrooms', name: 'Mushrooms', category: 'decorations', w: 1, h: 1, blocks: false, flat: true },
  { key: 'totem', name: 'Goblin Totem', category: 'decorations', w: 1, h: 1, blocks: true, overhang: 1 },
  { key: 'spikes', name: 'Wooden Spikes', category: 'decorations', w: 1, h: 1, blocks: true },
  { key: 'portal', name: 'Portal', category: 'special', w: 1, h: 1, blocks: false },
  { key: 'dungeon_entrance', name: 'Dungeon Entrance', category: 'special', w: 2, h: 2, blocks: false },
  { key: 'cave_entrance', name: 'Cave Entrance', category: 'special', w: 2, h: 2, blocks: false },
  { key: 'player_spawn', name: 'Player Spawn', category: 'spawns', w: 1, h: 1, blocks: false, flat: true },
];

const BY_KEY = new Map(OBJECTS.map((o) => [o.key, o]));
export function getObjectDef(key: string): ObjectDef | undefined {
  return BY_KEY.get(key);
}

export const OBJECT_CATEGORIES: { key: ObjectCategory; label: string }[] = [
  { key: 'trees', label: 'Trees' },
  { key: 'rocks', label: 'Rocks' },
  { key: 'bushes', label: 'Bushes' },
  { key: 'houses', label: 'Houses' },
  { key: 'buildings', label: 'Buildings' },
  { key: 'roads', label: 'Roads' },
  { key: 'bridges', label: 'Bridges' },
  { key: 'decorations', label: 'Decorations' },
  { key: 'special', label: 'Dungeons & Portals' },
];
