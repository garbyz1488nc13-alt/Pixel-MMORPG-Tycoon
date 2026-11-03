import type { Attribute, ClassDef, ItemDef, ItemStats, ProgressionConfig } from '@/models/rpg';

export const ATTRIBUTES: Attribute[] = ['str', 'agi', 'int', 'vit'];

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number, cfg: ProgressionConfig): number {
  if (level >= cfg.maxLevel) return 0;
  return Math.max(1, Math.round(cfg.xpBase * Math.pow(level, cfg.xpExponent)));
}

/** Total XP needed to reach `level` from level 1. */
export function totalXpFor(level: number, cfg: ProgressionConfig): number {
  let sum = 0;
  for (let l = 1; l < Math.min(level, cfg.maxLevel); l++) sum += xpToNext(l, cfg);
  return sum;
}

/** Level reached with a given total XP. */
export function levelForXp(xp: number, cfg: ProgressionConfig): number {
  let level = 1;
  let need = xpToNext(1, cfg);
  while (level < cfg.maxLevel && xp >= need) {
    xp -= need;
    level++;
    need = xpToNext(level, cfg);
  }
  return level;
}

export interface CharacterStats {
  level: number;
  str: number;
  agi: number;
  int: number;
  vit: number;
  maxHp: number;
  maxMana: number;
  attack: number;
  defense: number;
}

/** Derived stats for a class at a level, with equipped items (level requirements enforced). */
export function characterStats(cls: ClassDef, level: number, cfg: ProgressionConfig, equipment: (ItemDef | undefined)[] = []): CharacterStats {
  const lv = Math.max(1, Math.min(cfg.maxLevel, Math.round(level)));
  const attr = Object.fromEntries(ATTRIBUTES.map((a) => [a, Math.round(cls.base[a] + cls.growth[a] * (lv - 1))])) as Record<Attribute, number>;
  const bonus: Required<Pick<ItemStats, 'attack' | 'defense' | 'hp' | 'mana'>> = { attack: 0, defense: 0, hp: 0, mana: 0 };
  for (const item of equipment) {
    if (!item || item.slot === 'none' || item.levelReq > lv) continue;
    for (const a of ATTRIBUTES) attr[a] += item.stats[a] ?? 0;
    bonus.attack += item.stats.attack ?? 0;
    bonus.defense += item.stats.defense ?? 0;
    bonus.hp += item.stats.hp ?? 0;
    bonus.mana += item.stats.mana ?? 0;
  }
  return {
    level: lv,
    ...attr,
    maxHp: Math.round(cfg.baseHp + attr.vit * cfg.hpPerVit + bonus.hp),
    maxMana: Math.round(cfg.baseMana + attr.int * cfg.manaPerInt + bonus.mana),
    attack: Math.round(attr[cls.primary] * cfg.attackPerPrimary + bonus.attack),
    defense: Math.round(attr.vit * cfg.defensePerVit + bonus.defense),
  };
}

/** Skills available at a level. */
export function unlockedSkills(cls: ClassDef, level: number) {
  return cls.skills.filter((s) => s.unlockLevel <= level).sort((a, b) => a.unlockLevel - b.unlockLevel);
}
