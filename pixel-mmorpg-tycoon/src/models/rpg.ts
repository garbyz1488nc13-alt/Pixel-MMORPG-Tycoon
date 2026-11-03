import type { EntityId } from '@/core/ids';

export type ItemCategory = 'weapon' | 'armor' | 'potion' | 'resource' | 'material' | 'food' | 'accessory' | 'quest' | 'misc';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type EquipSlot = 'none' | 'mainhand' | 'head' | 'chest' | 'feet' | 'ring' | 'amulet';
export type Attribute = 'str' | 'agi' | 'int' | 'vit';

export interface ItemStats {
  attack?: number;
  defense?: number;
  hp?: number;
  mana?: number;
  str?: number;
  agi?: number;
  int?: number;
  vit?: number;
  /** Consumables: HP / mana restored on use. */
  heal?: number;
  restoreMana?: number;
}

export interface ItemDef {
  id: EntityId;
  /** Stable key for built-in items (used by gathering & defaults). Custom items have none. */
  key?: string;
  name: string;
  description: string;
  category: ItemCategory;
  /** Icon key from the sprite atlas (icon:<key>). */
  icon: string;
  rarity: Rarity;
  /** Base value in the world currency. */
  value: number;
  levelReq: number;
  stats: ItemStats;
  stackSize: number;
  slot: EquipSlot;
}

export interface ItemStack { itemId: EntityId; qty: number }

export interface ShopEntry {
  itemId: EntityId;
  stock: number;
  /** Stock the merchant restocks towards; also the "balanced" point for pricing. */
  maxStock: number;
}

export interface LootEntry { itemId: EntityId; chance: number; min: number; max: number }

export type ObjectiveType = 'kill' | 'boss' | 'collect' | 'gather' | 'deliver' | 'explore' | 'talk';

export interface QuestObjective {
  id: EntityId;
  type: ObjectiveType;
  /** Creature template (kill/boss), item (collect/gather/deliver), region (explore) or NPC (talk). */
  targetId: EntityId | null;
  /** Deliver: NPC who receives the items. */
  receiverId?: EntityId | null;
  count: number;
}

export interface QuestDef {
  id: EntityId;
  name: string;
  description: string;
  giverId: EntityId | null;
  requiredLevel: number;
  objectives: QuestObjective[];
  rewards: { xp: number; currency: number; items: ItemStack[] };
  /** Quest chain: this quest unlocks after the prerequisite is completed. */
  prerequisiteId: EntityId | null;
  repeatable: boolean;
}

export interface EconomyConfig {
  currencyName: string;
  /** World treasury: receives taxes, pays quest rewards (Phase 4). */
  treasury: number;
  /** Merchants sell at value × (1 + sellMarkup). */
  sellMarkup: number;
  /** Merchants buy at value × buybackRate. */
  buybackRate: number;
  /** Share of every trade that goes to the treasury. */
  taxRate: number;
  rarityMultipliers: Record<Rarity, number>;
  /** 0 = fixed prices, 1 = prices swing strongly with stock. */
  demandElasticity: number;
  /** Share of missing stock merchants restock per game hour. */
  restockPerHour: number;
  priceFloor: number;
  priceCeiling: number;
}

export interface SkillDef {
  id: EntityId;
  name: string;
  unlockLevel: number;
  kind: 'attack' | 'heal' | 'buff';
  /** Attack: damage multiplier; heal: HP restored as % of max HP; buff: % bonus. */
  power: number;
  manaCost: number;
  cooldown: number;
}

export type ClassKey = 'warrior' | 'mage' | 'archer' | 'rogue' | 'paladin';

export interface ClassDef {
  key: ClassKey;
  name: string;
  description: string;
  primary: Attribute;
  base: Record<Attribute, number>;
  growth: Record<Attribute, number>;
  skills: SkillDef[];
}

export interface ProgressionConfig {
  maxLevel: number;
  /** XP needed for level L → L+1 = round(xpBase × L ^ xpExponent). */
  xpBase: number;
  xpExponent: number;
  baseHp: number;
  hpPerVit: number;
  baseMana: number;
  manaPerInt: number;
  /** Attack per point of the class's primary attribute. */
  attackPerPrimary: number;
  /** Defense per point of VIT. */
  defensePerVit: number;
  classes: ClassDef[];
}

export interface RpgConfig {
  economy: EconomyConfig;
  progression: ProgressionConfig;
}
