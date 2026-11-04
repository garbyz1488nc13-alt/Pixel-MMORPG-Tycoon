import { it } from 'vitest';
import { buildWorld } from './bench';
it('war', () => {
  const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
  w.players.seedInitial(40);
  for (let i = 0; i < 200; i++) w.engine.step();
  const region = w.rt.entities.list('regions').find((r) => r.type === 'forest' || r.type === 'wilderness')!;
  const base = w.rt.entities.list('events')[0];
  w.rt.entities.add('events', { ...base, id: 'war', name: 'War', type: 'factionWar', regionId: region.id, durationHours: 6, trigger: { ...base.trigger, kind: 'manual' } } as any);
  w.events.start('war');
  for (let i = 0; i < 4 * 60 * 4; i++) w.engine.step();
  const a = w.rt.sim.activeEvents.find((x) => x.type === 'factionWar');
  console.log('war', region.type, a?.factionKills, a?.participants.length);
}, 60000);
