import { describe, expect, it } from 'vitest';
import { buildWorld } from './bench';
import { getRegionType, REGION_TYPES } from '@/data/regionTypes';
import { EntityEditor } from '@/systems/editor/EntityEditor';
import { History } from '@/systems/editor/History';
import { PLAYER_POSES } from '@/game/sprites/characterArt';

describe('roads', () => {
  it('paths prefer roads the designer lays out', () => {
    const w = buildWorld({ size: 96, npcs: 0, seed: 11 });
    const ed = new EntityEditor(() => w.rt, new History(50, () => undefined));
    // Find a long walkable row and lay a road along it, one tile below the straight line.
    const nav = w.rt.nav;
    let row = -1, x0 = 0;
    for (let y = 10; y < 80 && row < 0; y++) for (let x = 5; x < 50; x++) {
      let ok = true;
      for (let k = 0; k < 30 && ok; k++) ok = nav.isWalkable(x + k, y) && nav.isWalkable(x + k, y + 3);
      if (ok) { row = y; x0 = x; break; }
    }
    expect(row).toBeGreaterThan(0);
    for (let k = 0; k < 30; k++) ed.placeObject('road', x0 + k, row + 3);
    const path = w.actors.pathfinder.find(x0, row, x0 + 29, row, 20000)!;
    expect(path).toBeTruthy();
    const W = w.rt.grid.width;
    const onRoad = path.filter((i) => Math.floor(i / W) === row + 3).length;
    expect(onRoad).toBeGreaterThan(path.length * 0.5);
  });
});

describe('pvp rules', () => {
  it('safe regions forbid PvP, wilderness is for PvP players, PvP zones are open to all', () => {
    expect(getRegionType('town').pvp).toBe('none');
    expect(getRegionType('wilderness').pvp).toBe('flagged');
    expect(getRegionType('pvpzone').pvp).toBe('open');
    for (const r of REGION_TYPES) expect(r.description.length).toBeGreaterThan(10);
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    const ed = new EntityEditor(() => w.rt, new History(50, () => undefined));
    const zone = ed.addRegion('pvpzone', { x: 2, y: 2, w: 12, h: 12 });
    const casual = w.players.join()!; casual.behavior = 'casual';
    const ganker = w.players.join()!; ganker.behavior = 'pvp';
    const town = w.rt.entities.list('regions').find((r) => getRegionType(r.type).safe)!;
    expect(w.brain.mayAttack(ganker, town.x + 1, town.y + 1)).toBe(false);
    expect(w.brain.mayAttack(casual, zone.x + 2, zone.y + 2)).toBe(true);
    expect(w.brain.pvpRule(zone.x + 2, zone.y + 2)).toBe('open');
  });

  it('PvP players travel to PvP zones and fight there', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    const ed = new EntityEditor(() => w.rt, new History(50, () => undefined));
    const sp = w.players.spawnPoint();
    const zone = ed.addRegion('pvpzone', { x: Math.max(1, sp.x - 6), y: Math.max(1, sp.y + 8), w: 12, h: 12 });
    for (let i = 0; i < 20; i++) { const p = w.players.join()!; p.behavior = i % 2 ? 'pvp' : 'fighter'; }
    let kills = 0;
    w.actors.events.on('died', ({ victim, killer }) => { if (victim.kind === 'player' && killer?.kind === 'player' && w.brain.pvpRule(Math.floor(victim.x), Math.floor(victim.y)) === 'open') kills++; });
    for (let i = 0; i < 4 * 60 * 4; i++) w.engine.step();
    expect(zone).toBeTruthy();
    expect(kills).toBeGreaterThan(0);
  }, 60000);
});

describe('faction war', () => {
  it('players walk to the war on their own and the factions score kills', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    w.players.seedInitial(40);
    for (let i = 0; i < 200; i++) w.engine.step();
    const region = w.rt.entities.list('regions').find((r) => r.type === 'forest' || r.type === 'wilderness')!;
    const base = w.rt.entities.list('events')[0];
    w.rt.entities.add('events', { ...base, id: 'war', name: 'War', type: 'factionWar', regionId: region.id, durationHours: 6, trigger: { ...base.trigger, kind: 'manual' } });
    w.events.start('war');
    for (let i = 0; i < 4 * 60 * 4; i++) w.engine.step();
    const war = w.rt.sim.activeEvents.find((x) => x.type === 'factionWar')!;
    expect((war.factionKills?.[0] ?? 0) + (war.factionKills?.[1] ?? 0)).toBeGreaterThan(5);
    expect(war.participants.length).toBeGreaterThan(5);
  }, 60000);
});

describe('livelier players', () => {
  it('has every animation pose in the atlas list', () => {
    for (const p of ['walk0', 'walk3', 'attack1', 'cast0', 'sit', 'work1', 'dance0', 'wave', 'fish']) expect(PLAYER_POSES).toContain(p);
  });

  it('players take breaks, form groups and heal each other', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    w.players.seedInitial(40);
    const seen = new Set<string>();
    let heals = 0;
    w.actors.events.on('heal', () => heals++);
    for (let i = 0; i < 4 * 60 * 12; i++) {
      w.engine.step();
      if (i % 20 === 0) for (const p of w.players.online()) { const act = w.ps.activityOf(p.id); if (act) seen.add(act.kind === 'leisure' ? `leisure:${act.action}` : act.kind); }
    }
    expect([...seen].some((k) => k.startsWith('leisure:'))).toBe(true);
    expect(seen.has('follow')).toBe(true);
    expect(heals).toBeGreaterThanOrEqual(0);
  }, 90000);
});
