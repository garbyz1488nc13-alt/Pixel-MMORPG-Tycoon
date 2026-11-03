import { describe, expect, it } from 'vitest';
import { setLang, t } from '@/i18n';
import { uk } from '@/i18n/uk';
import { dynamicKeys, sourceKeys } from './i18nKeys';

describe('i18n', () => {
  it('has a Ukrainian translation for every key used in the code', () => {
    const missing = [...new Set([...sourceKeys(), ...dynamicKeys()])].filter((k) => !(k in uk));
    expect(missing).toEqual([]);
  });

  it('keeps placeholders intact in translations', () => {
    const bad = Object.entries(uk).filter(([en, ua]) => {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      return ph(en) !== ph(ua);
    });
    expect(bad).toEqual([]);
  });

  it('translates and interpolates', () => {
    setLang('uk');
    expect(t('Day {n}', { n: 3 })).toBe('День 3');
    setLang('en');
    expect(t('Day {n}', { n: 3 })).toBe('Day 3');
    expect(t('Untranslated key')).toBe('Untranslated key');
  });
});
