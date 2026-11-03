import { getLang, t } from '@/i18n';
export type NpcType = 'merchant' | 'blacksmith' | 'questgiver' | 'guard' | 'healer' | 'banker' | 'trainer' | 'farmer' | 'villager';
export type NpcBehavior = 'stationary' | 'wander' | 'patrol';

export interface NpcTypeDef {
  key: NpcType;
  name: string;
  /** Defaults used when a new NPC of this type is placed. */
  defaults: { level: number; maxHp: number; speed: number; behavior: NpcBehavior; workStart: number; workEnd: number; interactionRadius: number; hasShop: boolean };
  /** Sprite palette: hair, skin, body, dark (belt), accent, legs, feet. */
  palette: { h: string; s: string; b: string; B: string; a: string; l: string; f: string };
  accessory?: 'helmet' | 'hood' | 'strawhat' | 'apron' | 'hat' | 'crown' | 'headband';
  /** Fights hostile creatures within its interaction radius. */
  defender?: boolean;
}

export const NPC_TYPES: readonly NpcTypeDef[] = [
  { key: 'merchant', name: 'Merchant', defaults: { level: 5, maxHp: 80, speed: 1.2, behavior: 'stationary', workStart: 8, workEnd: 20, interactionRadius: 2, hasShop: true }, palette: { h: '#6b3e1f', s: '#f0c39a', b: '#3f8a4a', B: '#24532b', a: '#f2c14e', l: '#5a4630', f: '#2b1d12' }, accessory: 'hat' },
  { key: 'blacksmith', name: 'Blacksmith', defaults: { level: 10, maxHp: 140, speed: 1.1, behavior: 'stationary', workStart: 7, workEnd: 19, interactionRadius: 2, hasShop: true }, palette: { h: '#2a1a10', s: '#c98d62', b: '#6e4a2c', B: '#3d2816', a: '#9aa3ad', l: '#3a3a44', f: '#1b1b20' }, accessory: 'apron' },
  { key: 'questgiver', name: 'Quest Giver', defaults: { level: 15, maxHp: 120, speed: 1, behavior: 'stationary', workStart: 0, workEnd: 24, interactionRadius: 3, hasShop: false }, palette: { h: '#d8d8d8', s: '#e8b98f', b: '#5a3f8f', B: '#36255a', a: '#f2c14e', l: '#3b2c5c', f: '#1e1530' }, accessory: 'hood' },
  { key: 'guard', name: 'Guard', defaults: { level: 12, maxHp: 220, speed: 1.6, behavior: 'patrol', workStart: 0, workEnd: 24, interactionRadius: 6, hasShop: false }, palette: { h: '#4a3020', s: '#e3b088', b: '#8d97a3', B: '#4f5863', a: '#c23b32', l: '#5f6873', f: '#2a2f36' }, accessory: 'helmet', defender: true },
  { key: 'healer', name: 'Healer', defaults: { level: 8, maxHp: 90, speed: 1, behavior: 'stationary', workStart: 6, workEnd: 22, interactionRadius: 3, hasShop: true }, palette: { h: '#f5e6a8', s: '#f2c9a5', b: '#ece6dc', B: '#b9b1a3', a: '#d23a3a', l: '#cfc7b8', f: '#6a5b4a' }, accessory: 'hood' },
  { key: 'banker', name: 'Banker', defaults: { level: 6, maxHp: 70, speed: 1, behavior: 'stationary', workStart: 9, workEnd: 17, interactionRadius: 2, hasShop: false }, palette: { h: '#1d1d24', s: '#f0c8a0', b: '#3a2d6a', B: '#211845', a: '#f2c14e', l: '#26264a', f: '#111118' }, accessory: 'hat' },
  { key: 'trainer', name: 'Trainer', defaults: { level: 20, maxHp: 180, speed: 1.3, behavior: 'wander', workStart: 8, workEnd: 20, interactionRadius: 3, hasShop: false }, palette: { h: '#b8442a', s: '#d9a07a', b: '#a83232', B: '#5e1a1a', a: '#f2c14e', l: '#4a3022', f: '#20140c' }, accessory: 'headband' },
  { key: 'farmer', name: 'Farmer', defaults: { level: 2, maxHp: 60, speed: 1.1, behavior: 'wander', workStart: 5, workEnd: 19, interactionRadius: 2, hasShop: false }, palette: { h: '#8a5a2a', s: '#e0a87c', b: '#3c6ea8', B: '#25496f', a: '#e8d27a', l: '#3c6ea8', f: '#4a3020' }, accessory: 'strawhat' },
  { key: 'villager', name: 'Villager', defaults: { level: 1, maxHp: 50, speed: 1.2, behavior: 'wander', workStart: 7, workEnd: 21, interactionRadius: 2, hasShop: false }, palette: { h: '#5a3a1a', s: '#f0c39a', b: '#b3743a', B: '#6e4520', a: '#e8d27a', l: '#5a4a3a', f: '#2b1d12' } },
];

const BY = new Map(NPC_TYPES.map((t) => [t.key, t]));
export const getNpcType = (k: NpcType): NpcTypeDef => BY.get(k) ?? NPC_TYPES[NPC_TYPES.length - 1];

export const NPC_BEHAVIORS: { key: NpcBehavior; label: string; hint: string }[] = [
  { key: 'stationary', label: 'Stationary', hint: 'Stays at its post.' },
  { key: 'wander', label: 'Wander', hint: 'Walks around its home within the wander radius.' },
  { key: 'patrol', label: 'Patrol', hint: 'Walks a loop through its waypoints.' },
];

/** NPC combat stats derived from level (the item/stat system arrives in Phase 3). */
export function npcCombatStats(level: number) {
  return { damage: 3 + level * 2, defense: Math.floor(level * 0.8), attackRange: 1.3 };
}

const FIRST = ['Aldric', 'Bren', 'Cora', 'Dain', 'Elsa', 'Finn', 'Greta', 'Hale', 'Ivo', 'Jora', 'Kael', 'Lysa', 'Moss', 'Nell', 'Orin', 'Pia', 'Quill', 'Rhea', 'Sten', 'Tova', 'Ulric', 'Vera', 'Wren', 'Yara'];
const FIRST_UK = ['Остап', 'Богдана', 'Тарас', 'Оксана', 'Мирослав', 'Леся', 'Данило', 'Ярина', 'Святослав', 'Злата', 'Добромир', 'Олеся', 'Ярема', 'Мар\'яна', 'Северин', 'Христина', 'Зореслав', 'Ганна', 'Назар', 'Устина', 'Гордій', 'Віра', 'Любомир', 'Соломія'];

/** Random display name in the current language, e.g. "Aldric the Merchant" / "Остап, торговець". */
export function randomNpcName(type: NpcType, rand: () => number = Math.random): string {
  const role = t(getNpcType(type).name);
  if (getLang() === 'uk') return `${FIRST_UK[Math.floor(rand() * FIRST_UK.length)]}, ${role.toLowerCase()}`;
  return `${FIRST[Math.floor(rand() * FIRST.length)]} the ${role}`;
}
