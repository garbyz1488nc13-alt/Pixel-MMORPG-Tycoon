import { uk } from './uk';

export type Lang = 'en' | 'uk';
export const LANGUAGES: { key: Lang; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'uk', label: 'Українська' },
];

const DICTS: Record<Lang, Record<string, string> | null> = { en: null, uk };
let current: Lang = 'en';
const listeners = new Set<() => void>();

export function detectLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  return nav.some((l) => /^(uk|ru|be)/i.test(l)) ? 'uk' : 'en';
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

export function onLangChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Translate an English source string. Keys ARE the English text, so missing
 * translations fall back to readable English. `{name}` placeholders are filled from params.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = DICTS[current];
  let s = (dict && dict[key]) || key;
  if (params) s = s.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
  return s;
}

/** Font used inside the Phaser canvas for the current language (VT323 has no Cyrillic). */
export function canvasFont(): { family: string; scale: number } {
  return current === 'uk' ? { family: 'Handjet, monospace', scale: 1 } : { family: 'VT323, monospace', scale: 1 };
}
