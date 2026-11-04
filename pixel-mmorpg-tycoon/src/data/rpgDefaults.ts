import { createId } from '@/core/ids';
import { t } from '@/i18n';
import type { CreatureType } from './creatureTypes';
import type { NpcType } from './npcTypes';
import type {
  ClassDef, EconomyConfig, EquipSlot, ItemCategory, ItemDef, ItemStats, LootEntry, ProgressionConfig, Rarity, RpgConfig, ShopEntry,
} from '@/models/rpg';

export const ITEM_CATEGORIES: { key: ItemCategory; label: string }[] = [
  { key: 'weapon', label: 'Weapons' },
  { key: 'armor', label: 'Armor' },
  { key: 'potion', label: 'Potions' },
  { key: 'resource', label: 'Resources' },
  { key: 'material', label: 'Materials' },
  { key: 'food', label: 'Food' },
  { key: 'accessory', label: 'Accessories' },
  { key: 'quest', label: 'Quest Items' },
  { key: 'misc', label: 'Miscellaneous' },
];

export const RARITIES: { key: Rarity; label: string; color: string }[] = [
  { key: 'common', label: 'Common', color: '#c8c8c8' },
  { key: 'uncommon', label: 'Uncommon', color: '#6cc551' },
  { key: 'rare', label: 'Rare', color: '#5aa9e6' },
  { key: 'epic', label: 'Epic', color: '#b56cff' },
  { key: 'legendary', label: 'Legendary', color: '#f2a03a' },
];
export const rarityColor = (r: Rarity) => RARITIES.find((x) => x.key === r)?.color ?? '#c8c8c8';

export const EQUIP_SLOTS: { key: EquipSlot; label: string }[] = [
  { key: 'none', label: 'Not equippable' },
  { key: 'mainhand', label: 'Weapon' },
  { key: 'head', label: 'Head' },
  { key: 'chest', label: 'Chest' },
  { key: 'feet', label: 'Feet' },
  { key: 'ring', label: 'Ring' },
  { key: 'amulet', label: 'Amulet' },
];

export const STAT_KEYS: { key: keyof ItemStats; label: string }[] = [
  { key: 'attack', label: 'Attack' },
  { key: 'defense', label: 'Defense' },
  { key: 'hp', label: 'Max HP' },
  { key: 'mana', label: 'Max mana' },
  { key: 'str', label: 'STR' },
  { key: 'agi', label: 'AGI' },
  { key: 'int', label: 'INT' },
  { key: 'vit', label: 'VIT' },
  { key: 'heal', label: 'Heals HP' },
  { key: 'restoreMana', label: 'Restores mana' },
];

/** Icons available in the atlas (icon:<key>). */
export const ITEM_ICONS = [
  'sword', 'longsword', 'dagger', 'staff', 'bow', 'mace', 'helmet', 'cap', 'tunic', 'plate', 'boots',
  'potion_red', 'potion_blue', 'elixir', 'log', 'stone', 'ore', 'wheat', 'berries', 'herb', 'ingot', 'leather',
  'cloth', 'gel', 'pelt', 'bone', 'ear', 'silk', 'scale', 'bread', 'apple', 'meat', 'fish', 'ring', 'amulet',
  'letter', 'relic', 'torch', 'map', 'coin',
] as const;

type Tpl = Omit<ItemDef, 'id'> & { key: string };
const I = (key: string, name: string, description: string, category: ItemCategory, icon: string, rarity: Rarity, value: number, levelReq: number, stats: ItemStats, stackSize: number, slot: EquipSlot = 'none'): Tpl =>
  ({ key, name, description, category, icon, rarity, value, levelReq, stats, stackSize, slot });

/** Built-in item set (English source names, translated when a world is created). */
export const DEFAULT_ITEMS: Tpl[] = [
  I('wooden_sword', 'Wooden Sword', 'A training blade. Better than bare hands.', 'weapon', 'sword', 'common', 15, 1, { attack: 4 }, 1, 'mainhand'),
  I('iron_sword', 'Iron Sword', 'Reliable steel for a new adventurer.', 'weapon', 'sword', 'common', 80, 5, { attack: 10, str: 1 }, 1, 'mainhand'),
  I('steel_longsword', 'Steel Longsword', 'Heavy and sharp. Favoured by knights.', 'weapon', 'longsword', 'rare', 420, 15, { attack: 24, str: 3 }, 1, 'mainhand'),
  I('rogue_dagger', 'Rogue Dagger', 'Quick strikes from the shadows.', 'weapon', 'dagger', 'uncommon', 120, 1, { attack: 8, agi: 3 }, 1, 'mainhand'),
  I('oak_staff', 'Oak Staff', 'Channels arcane power.', 'weapon', 'staff', 'common', 70, 1, { attack: 5, int: 3, mana: 15 }, 1, 'mainhand'),
  I('hunting_bow', 'Hunting Bow', 'Hits what you can see.', 'weapon', 'bow', 'common', 90, 1, { attack: 9, agi: 2 }, 1, 'mainhand'),
  I('holy_mace', 'Holy Mace', 'Blessed by the temple priests.', 'weapon', 'mace', 'rare', 380, 12, { attack: 18, vit: 2, int: 2 }, 1, 'mainhand'),
  I('leather_cap', 'Leather Cap', 'Keeps the rain off.', 'armor', 'cap', 'common', 25, 1, { defense: 2 }, 1, 'head'),
  I('iron_helmet', 'Iron Helmet', 'Solid protection for the head.', 'armor', 'helmet', 'uncommon', 110, 8, { defense: 6, vit: 1 }, 1, 'head'),
  I('leather_tunic', 'Leather Tunic', 'Light armour for travellers.', 'armor', 'tunic', 'common', 45, 1, { defense: 4 }, 1, 'chest'),
  I('plate_armor', 'Plate Armor', 'Heavy steel plates. Nearly impenetrable.', 'armor', 'plate', 'epic', 900, 20, { defense: 22, vit: 4, agi: -2 }, 1, 'chest'),
  I('travel_boots', 'Travel Boots', 'Comfortable for long journeys.', 'armor', 'boots', 'common', 35, 1, { defense: 2, agi: 1 }, 1, 'feet'),
  I('health_potion', 'Health Potion', 'Restores a bit of health.', 'potion', 'potion_red', 'common', 20, 1, { heal: 50 }, 20),
  I('mana_potion', 'Mana Potion', 'Restores mana.', 'potion', 'potion_blue', 'common', 25, 1, { restoreMana: 40 }, 20),
  I('elixir', 'Grand Elixir', 'Fully restores body and mind.', 'potion', 'elixir', 'epic', 400, 15, { heal: 500, restoreMana: 300 }, 5),
  I('wood', 'Wood', 'Logs cut from trees.', 'resource', 'log', 'common', 2, 1, {}, 99),
  I('stone', 'Stone', 'Rough building stone.', 'resource', 'stone', 'common', 2, 1, {}, 99),
  I('iron_ore', 'Iron Ore', 'Smelts into iron ingots.', 'resource', 'ore', 'common', 6, 1, {}, 99),
  I('wheat', 'Wheat', 'Golden grain from the fields.', 'resource', 'wheat', 'common', 3, 1, {}, 99),
  I('berries', 'Berries', 'Sweet wild berries.', 'resource', 'berries', 'common', 2, 1, { heal: 5 }, 50),
  I('herb', 'Healing Herb', 'Used to brew potions.', 'resource', 'herb', 'common', 5, 1, {}, 50),
  I('iron_ingot', 'Iron Ingot', 'Ready for the anvil.', 'material', 'ingot', 'common', 18, 1, {}, 50),
  I('leather', 'Leather', 'Tanned hide.', 'material', 'leather', 'common', 8, 1, {}, 50),
  I('cloth', 'Cloth', 'Rough woven cloth.', 'material', 'cloth', 'common', 6, 1, {}, 50),
  I('slime_gel', 'Slime Gel', 'Sticky and slightly glowing.', 'material', 'gel', 'common', 4, 1, {}, 50),
  I('wolf_pelt', 'Wolf Pelt', 'Thick grey fur.', 'material', 'pelt', 'common', 12, 1, {}, 30),
  I('bone', 'Bone', 'Brittle old bone.', 'material', 'bone', 'common', 5, 1, {}, 50),
  I('goblin_ear', 'Goblin Ear', 'Proof of a goblin slain.', 'material', 'ear', 'common', 6, 1, {}, 50),
  I('spider_silk', 'Spider Silk', 'Strong as steel wire.', 'material', 'silk', 'uncommon', 20, 1, {}, 50),
  I('dragon_scale', 'Dragon Scale', 'Warm to the touch.', 'material', 'scale', 'legendary', 1500, 1, {}, 10),
  I('bread', 'Bread', 'Fresh from the oven.', 'food', 'bread', 'common', 4, 1, { heal: 15 }, 20),
  I('apple', 'Apple', 'Crisp and juicy.', 'food', 'apple', 'common', 2, 1, { heal: 8 }, 20),
  I('roast_meat', 'Roast Meat', 'Hearty and filling.', 'food', 'meat', 'common', 8, 1, { heal: 30 }, 20),
  I('fish', 'Grilled Fish', 'Caught this morning.', 'food', 'fish', 'common', 6, 1, { heal: 20 }, 20),
  I('copper_ring', 'Copper Ring', 'A simple band. Slightly lucky.', 'accessory', 'ring', 'uncommon', 60, 3, { agi: 1, str: 1 }, 1, 'ring'),
  I('vigor_amulet', 'Amulet of Vigor', 'Pulses with life energy.', 'accessory', 'amulet', 'rare', 350, 10, { hp: 60, vit: 3 }, 1, 'amulet'),
  I('old_letter', 'Old Letter', 'Sealed with wax. For someone in town.', 'quest', 'letter', 'common', 0, 1, {}, 1),
  I('ancient_relic', 'Ancient Relic', 'Hums with forgotten magic.', 'quest', 'relic', 'epic', 0, 1, {}, 1),
  I('torch', 'Torch', 'Lights the way in dark places.', 'misc', 'torch', 'common', 3, 1, {}, 20),
  I('map_fragment', 'Map Fragment', 'Part of a larger map.', 'misc', 'map', 'uncommon', 15, 1, {}, 10),
];

export function createDefaultItems(): ItemDef[] {
  return DEFAULT_ITEMS.map((d) => ({ ...d, id: createId('item'), name: t(d.name), description: t(d.description), stats: { ...d.stats } }));
}

/** Map item key → id for a world's item list. */
export function itemKeyIndex(items: ItemDef[]): Map<string, string> {
  return new Map(items.filter((i) => i.key).map((i) => [i.key!, i.id]));
}

/** Default loot by creature type, by item key. */
export const DEFAULT_LOOT: Record<CreatureType, [string, number, number, number][]> = {
  slime: [['slime_gel', 80, 1, 2], ['health_potion', 10, 1, 1]],
  goblin: [['goblin_ear', 70, 1, 1], ['copper_ring', 5, 1, 1], ['bread', 25, 1, 2], ['leather_cap', 6, 1, 1], ['travel_boots', 5, 1, 1]],
  wolf: [['wolf_pelt', 75, 1, 1], ['roast_meat', 30, 1, 1], ['leather_tunic', 4, 1, 1]],
  skeleton: [['bone', 80, 1, 3], ['iron_sword', 6, 1, 1], ['map_fragment', 8, 1, 1], ['iron_helmet', 5, 1, 1]],
  orc: [['iron_ingot', 50, 1, 2], ['iron_helmet', 8, 1, 1], ['roast_meat', 30, 1, 2]],
  spider: [['spider_silk', 70, 1, 2], ['herb', 30, 1, 2]],
  zombie: [['cloth', 60, 1, 2], ['bone', 40, 1, 1]],
  dragon: [['dragon_scale', 100, 1, 3], ['elixir', 50, 1, 1], ['ancient_relic', 25, 1, 1]],
  boss: [['vigor_amulet', 40, 1, 1], ['elixir', 60, 1, 2], ['ancient_relic', 30, 1, 1]],
};

export function defaultLoot(type: CreatureType, items: ItemDef[]): LootEntry[] {
  const idx = itemKeyIndex(items);
  return DEFAULT_LOOT[type].filter(([k]) => idx.has(k)).map(([k, chance, min, max]) => ({ itemId: idx.get(k)!, chance, min, max }));
}

/** Default shop assortment by NPC type (item key, max stock). */
export const DEFAULT_SHOPS: Partial<Record<NpcType, [string, number][]>> = {
  merchant: [['bread', 30], ['apple', 30], ['health_potion', 15], ['torch', 20], ['leather_tunic', 15], ['travel_boots', 15], ['leather_cap', 10]],
  blacksmith: [['wooden_sword', 6], ['iron_sword', 6], ['rogue_dagger', 4], ['hunting_bow', 4], ['leather_cap', 12], ['iron_helmet', 6], ['leather_tunic', 8], ['iron_ingot', 20]],
  healer: [['health_potion', 30], ['mana_potion', 25], ['herb', 20], ['elixir', 2]],
};

export function defaultShop(type: NpcType, items: ItemDef[]): ShopEntry[] {
  const idx = itemKeyIndex(items);
  return (DEFAULT_SHOPS[type] ?? []).filter(([k]) => idx.has(k)).map(([k, max]) => ({ itemId: idx.get(k)!, stock: max, maxStock: max }));
}

export const DEFAULT_NPC_GOLD: Record<NpcType, number> = {
  merchant: 600, blacksmith: 700, questgiver: 100, guard: 40, healer: 400, banker: 2000, trainer: 120, farmer: 20, villager: 30,
};

export const DEFAULT_ECONOMY: EconomyConfig = {
  currencyName: 'Gold',
  treasury: 10000,
  sellMarkup: 0.25,
  buybackRate: 0.4,
  taxRate: 0.05,
  rarityMultipliers: { common: 1, uncommon: 1.2, rare: 1.5, epic: 2, legendary: 3 },
  demandElasticity: 0.5,
  restockPerHour: 0.1,
  priceFloor: 0.5,
  priceCeiling: 2.5,
};

const S = (name: string, unlockLevel: number, kind: 'attack' | 'heal' | 'buff', power: number, manaCost: number, cooldown: number) =>
  ({ id: createId('skill'), name: t(name), unlockLevel, kind, power, manaCost, cooldown });

export const CLASS_SOURCE: { key: ClassDef['key']; name: string; description: string; primary: ClassDef['primary']; base: ClassDef['base']; growth: ClassDef['growth']; skills: [string, number, 'attack' | 'heal' | 'buff', number, number, number][] }[] = [
  { key: 'warrior', name: 'Warrior', description: 'Front-line fighter with heavy armour and high health.', primary: 'str', base: { str: 8, agi: 4, int: 2, vit: 7 }, growth: { str: 2.2, agi: 0.8, int: 0.3, vit: 1.8 },
    skills: [['Power Strike', 1, 'attack', 1.8, 5, 4], ['War Cry', 5, 'buff', 20, 10, 20], ['Whirlwind', 12, 'attack', 2.6, 18, 10]] },
  { key: 'mage', name: 'Mage', description: 'Master of destructive spells; fragile but deadly.', primary: 'int', base: { str: 2, agi: 3, int: 9, vit: 4 }, growth: { str: 0.3, agi: 0.7, int: 2.5, vit: 0.9 },
    skills: [['Fireball', 1, 'attack', 2.2, 12, 3], ['Frost Nova', 6, 'attack', 1.6, 20, 8], ['Arcane Shield', 10, 'buff', 30, 25, 25]] },
  { key: 'archer', name: 'Archer', description: 'Ranged damage dealer with keen eyes.', primary: 'agi', base: { str: 4, agi: 9, int: 3, vit: 5 }, growth: { str: 0.8, agi: 2.3, int: 0.5, vit: 1.1 },
    skills: [['Aimed Shot', 1, 'attack', 2, 6, 4], ['Volley', 7, 'attack', 2.4, 15, 9], ['Eagle Eye', 12, 'buff', 25, 12, 30]] },
  { key: 'rogue', name: 'Rogue', description: 'Swift and sneaky; critical strikes from the shadows.', primary: 'agi', base: { str: 5, agi: 8, int: 3, vit: 5 }, growth: { str: 1, agi: 2.1, int: 0.5, vit: 1 },
    skills: [['Backstab', 1, 'attack', 2.4, 8, 5], ['Poison Blade', 5, 'buff', 15, 10, 15], ['Shadow Step', 10, 'attack', 3, 20, 12]] },
  { key: 'paladin', name: 'Paladin', description: 'Holy knight who both fights and heals.', primary: 'str', base: { str: 7, agi: 3, int: 5, vit: 7 }, growth: { str: 1.7, agi: 0.6, int: 1.2, vit: 1.6 },
    skills: [['Holy Strike', 1, 'attack', 1.7, 8, 4], ['Lay on Hands', 4, 'heal', 40, 20, 20], ['Divine Aura', 10, 'buff', 20, 25, 30]] },
];

export function createDefaultClasses(): ClassDef[] {
  return CLASS_SOURCE.map((c) => ({
    key: c.key, name: t(c.name), description: t(c.description), primary: c.primary, base: { ...c.base }, growth: { ...c.growth },
    skills: c.skills.map((s) => S(...s)),
  }));
}

export const DEFAULT_PROGRESSION_RULES: Omit<ProgressionConfig, 'classes'> = {
  maxLevel: 50, xpBase: 100, xpExponent: 1.5, baseHp: 50, hpPerVit: 10, baseMana: 20, manaPerInt: 8, attackPerPrimary: 1.5, defensePerVit: 0.5,
};

export function createDefaultRpg(startingGold = DEFAULT_ECONOMY.treasury): RpgConfig {
  return {
    economy: { ...DEFAULT_ECONOMY, currencyName: t(DEFAULT_ECONOMY.currencyName), treasury: startingGold, rarityMultipliers: { ...DEFAULT_ECONOMY.rarityMultipliers } },
    progression: { ...DEFAULT_PROGRESSION_RULES, classes: createDefaultClasses() },
  };
}

/** Map objects that can be gathered, and the item key they yield. */
export const GATHER_SOURCES: Record<string, string> = {
  tree_oak: 'wood', tree_pine: 'wood', tree_palm: 'wood', tree_dead: 'wood', tree_snow: 'wood',
  rock: 'stone', boulder: 'stone', ore_rock: 'iron_ore', berry_bush: 'berries', bush: 'herb',
};

export const OBJECTIVE_TYPES: { key: import('@/models/rpg').ObjectiveType; label: string; hint: string }[] = [
  { key: 'kill', label: 'Kill Monsters', hint: 'Defeat N creatures of a kind.' },
  { key: 'collect', label: 'Collect Items', hint: 'Obtain N items (monster loot or shops).' },
  { key: 'deliver', label: 'Deliver Items', hint: 'Bring N items to an NPC.' },
  { key: 'explore', label: 'Explore Location', hint: 'Visit a region.' },
  { key: 'talk', label: 'Talk to NPC', hint: 'Speak with a specific NPC.' },
  { key: 'boss', label: 'Defeat Boss', hint: 'Defeat a boss creature.' },
  { key: 'gather', label: 'Gather Resources', hint: 'Gather N resources from trees, rocks or bushes.' },
];
