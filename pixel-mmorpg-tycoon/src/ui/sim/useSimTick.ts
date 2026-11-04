import { useEffect, useReducer } from 'react';

/** Re-render every `ms` (live simulation views). */
export function useSimTick(ms = 1000): void {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = window.setInterval(bump, ms);
    return () => window.clearInterval(id);
  }, [ms]);
}
