import { useEffect, useReducer } from 'react';
import type { GameSession } from '@/session/GameSession';

/** Re-render when economy/progression rules change, and every `pollMs` for live economy stats. */
export function useRpg(session: GameSession, pollMs = 0) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const off = session.runtime.events.on('rpg:changed', bump);
    const id = pollMs ? window.setInterval(bump, pollMs) : 0;
    return () => { off(); if (id) window.clearInterval(id); };
  }, [session, pollMs]);
  return session.runtime.rpg;
}
