import { useEffect, useReducer } from 'react';
import { onLangChange, t } from './index';

/** Re-renders the component when the language changes; returns the translator. */
export function useT(): typeof t {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => onLangChange(bump), []);
  return t;
}
