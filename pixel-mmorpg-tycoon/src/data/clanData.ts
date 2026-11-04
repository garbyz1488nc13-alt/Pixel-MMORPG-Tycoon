import type { ClanStyle, PlayerBehavior } from '@/models/sim';
import type { Lang } from '@/i18n';

/** Clan name parts. Names are generated once in the current language and kept (proper nouns). */
const NAMES: Record<Lang, { adj: string[]; noun: string[]; special: string[] }> = {
  en: {
    adj: ['Dark', 'Eternal', 'Holy', 'Crimson', 'Lazy', 'Toxic', 'Casual', 'Mighty', 'Forgotten', 'Drunken', 'Elite', 'Salty', 'Laggy', 'Golden', 'Midnight', 'Sleepy'],
    noun: ['Knights', 'Legion', 'Wolves', 'Dragons', 'Goblins', 'Order', 'Raiders', 'Potatoes', 'Dads', 'Noobs', 'Pandas', 'Wipers', 'Tryhards', 'Owls', 'Ravens', 'Cossacks'],
    special: ['Mom Said One More Raid', 'AFK in Town', 'Lag Survivors', 'Not Today Boss', 'Free Loot Society', 'The Wipe Club', 'Need Before Greed', 'Pull Without Tank', 'We Have Cookies', 'Officially Casual'],
  },
  uk: {
    adj: ['Темні', 'Вічні', 'Святі', 'Багряні', 'Ліниві', 'Токсичні', 'Казуальні', 'Могутні', 'Забуті', 'Хмільні', 'Елітні', 'Солоні', 'Лагучі', 'Золоті', 'Нічні', 'Сонні'],
    noun: ['Лицарі', 'Вовки', 'Дракони', 'Гобліни', 'Рейдери', 'Картоплини', 'Батьки', 'Нуби', 'Панди', 'Вайпери', 'Тріхардери', 'Сови', 'Круки', 'Козаки', 'Мольфари', 'Характерники'],
    special: ['Мама сказала ще один рейд', 'АФК у таверні', 'Ті, що пережили лаг', 'Не сьогодні, босе', 'Товариство вільного луту', 'Клуб вайпів', 'Борщ і лут', 'Пул без танка', 'У нас є печиво', 'Офіційно казуальні'],
  },
};

export const CLAN_COLORS = ['#e2574c', '#5aa9e6', '#6cc551', '#f2a03a', '#b56cff', '#ffd23f', '#3ad6c5', '#ff7eb6', '#9b7b5a', '#ffffff', '#7f8cff', '#c3e86a'];

export function clanName(rand: () => number, lang: Lang): string {
  const p = NAMES[lang] ?? NAMES.en;
  const pick = (a: string[]) => a[Math.floor(rand() * a.length)];
  return rand() < 0.3 ? pick(p.special) : `${pick(p.adj)} ${pick(p.noun)}`;
}

/** 2–4 letter tag from the name's initials. */
export function clanTag(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  let tag = words.map((w) => w[0]).join('').slice(0, 4);
  if (tag.length < 2) tag = name.replace(/\s+/g, '').slice(0, 3);
  return tag.toUpperCase();
}

export function styleFor(b: PlayerBehavior): ClanStyle {
  switch (b) {
    case 'fighter': case 'grinder': return 'hardcore';
    case 'pvp': return 'pvp';
    case 'trader': return 'traders';
    default: return 'casual';
  }
}

export const CLAN_STYLES: Record<ClanStyle, { label: string; hint: string; raidChance: number }> = {
  hardcore: { label: 'Hardcore raiders', hint: 'Raid every evening, wipe a lot, argue about DPS.', raidChance: 0.85 },
  casual: { label: 'Casual friends', hint: 'Mostly chat in town; raid when enough people show up.', raidChance: 0.35 },
  pvp: { label: 'PvP guild', hint: 'Prefer fighting players, but bosses are fun too.', raidChance: 0.5 },
  traders: { label: 'Merchant guild', hint: 'Care about gold. Raid for the loot to sell.', raidChance: 0.4 },
};

export const MAX_CLAN_SIZE = 30;
/** Drama at which a clan splits or falls apart. */
export const DRAMA_LIMIT = 80;
