import { useEffect, useRef, useState } from 'react';
import type { EntityId } from '@/core/ids';
import type { EntityCollection, WorldEntities } from '@/models/entities';
import type { GameSession } from '@/session/GameSession';

type Item<C extends EntityCollection> = WorldEntities[C][number];

/** Live list of one entity collection; re-renders when that collection changes. */
export function useEntityList<C extends EntityCollection>(session: GameSession, col: C): Item<C>[] {
  const [list, setList] = useState(() => session.runtime.entities.list(col));
  useEffect(() => {
    setList(session.runtime.entities.list(col));
    return session.runtime.entities.events.on('changed', (e) => {
      if (e.col === col) setList(session.runtime.entities.list(col));
    });
  }, [session, col]);
  return list;
}

/** Live single entity (undefined when deleted). */
export function useEntity<C extends EntityCollection>(session: GameSession, col: C, id: EntityId | undefined): Item<C> | undefined {
  const [item, setItem] = useState(() => (id ? session.runtime.entities.get(col, id) : undefined));
  useEffect(() => {
    setItem(id ? session.runtime.entities.get(col, id) : undefined);
    return session.runtime.entities.events.on('changed', (e) => {
      if (e.col === col && id && e.ids.includes(id)) setItem(session.runtime.entities.get(col, id));
    });
  }, [session, col, id]);
  return item;
}

export interface LiveCounts { npcsAlive: number; npcsTotal: number; creaturesAlive: number; creaturesTotal: number; kills: number; npcDeaths: number }

/** Polls the live simulation a few times per second (cheap counters, no per-tick React updates). */
export function useLiveCounts(session: GameSession, intervalMs = 500): LiveCounts {
  const read = (): LiveCounts => {
    let npcsAlive = 0, npcsTotal = 0, creaturesAlive = 0, creaturesTotal = 0;
    for (const a of session.actors.actors.values()) {
      if (a.kind === 'npc') { npcsTotal++; if (a.state !== 'dead') npcsAlive++; }
      else { creaturesTotal++; if (a.state !== 'dead') creaturesAlive++; }
    }
    return { npcsAlive, npcsTotal, creaturesAlive, creaturesTotal, kills: session.actors.stats.creatureKills, npcDeaths: session.actors.stats.npcDeaths };
  };
  const [c, setC] = useState(read);
  const last = useRef('');
  useEffect(() => {
    const id = window.setInterval(() => {
      const n = read();
      const key = JSON.stringify(n);
      if (key !== last.current) { last.current = key; setC(n); }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [session, intervalMs]);
  return c;
}
