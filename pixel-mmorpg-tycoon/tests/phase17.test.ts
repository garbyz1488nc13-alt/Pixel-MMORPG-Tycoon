import { describe, expect, it } from 'vitest';
import { buildWorld } from './bench';
import { dungeonLayout, ROOMS } from '@/simulation/social/DungeonService';
import { FEATURES } from '@/data/progression';

describe('rooms in ordinary houses', () => {
  it('players rent rooms in houses and keep gold in their storage', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    // Only houses: remove hotels and taverns.
    for (const o of w.rt.entities.list('objects')) if (o.kind === 'hotel' || o.kind === 'tavern') w.rt.entities.remove('objects', o.id);
    const houses = w.players.rooms();
    expect(houses.length).toBeGreaterThan(3);
    expect(houses.every((r) => r.building.kind.startsWith('house') || r.building.kind === 'hut')).toBe(true);
    const ps = Array.from({ length: 20 }, () => { const p = w.players.join()!; p.playMinutes = 500; p.gold = 500; p.satisfaction = 80; return p; });
    for (let h = 0; h < 40 && !ps.some((p) => p.home); h++) w.players.hourly();
    const tenant = ps.find((p) => p.home)!;
    expect(tenant).toBeTruthy();
    const door = w.players.homeDoor(tenant)!;
    expect(door).toBeTruthy();
    // Resting at home moves gold into the personal storage.
    const a = w.actors.actors.get(tenant.id)!;
    w.actors.teleport(a, door.x, door.y + 1);
    a.hp = 1;
    const m = w.ps.mind(tenant.id);
    m.act = { kind: 'rest', x: door.x, y: door.y + 1 } as never;
    const bank = tenant.bank ?? 0;
    for (let i = 0; i < 20; i++) w.engine.step();
    expect(tenant.bank ?? 0).toBeGreaterThan(bank);
  });
});

describe('dungeon locations', () => {
  it('every dungeon has its own walled map with rooms and a boss room', () => {
    const l = dungeonLayout('obj_test', false);
    expect(l.rooms.length).toBe(ROOMS);
    // Borders are walls.
    for (let x = 0; x < l.w; x++) { expect(l.floor[x]).toBe(0); expect(l.floor[(l.h - 1) * l.w + x]).toBe(0); }
    // Rooms are floor and connected along the path.
    for (const p of l.path) expect(l.floor[p.y * l.w + p.x]).toBe(1);
    // Same entrance → same map.
    expect(dungeonLayout('obj_test', false).floor).toEqual(l.floor);
    expect(dungeonLayout('obj_other', true).floor).not.toEqual(l.floor);
  });
});

describe('gradual progression (standard mode)', () => {
  it('features start locked, research unlocks them, hype brings players', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3, mode: 'standard', progression: true });
    expect(w.rt.feature('clans')).toBe(false);
    expect(w.dungeons.form()).toBeNull();
    w.rt.studio.funds = 100000;
    expect(w.studio.startResearch('auction')).toBeTruthy(); // needs clans first
    expect(w.studio.startResearch('clans')).toBeNull();
    w.studio.hire('dev', 3);
    let released = '';
    w.rt.events.on('studio:released', ({ key }) => (released = key));
    const work = FEATURES.find((f) => f.key === 'clans')!.work;
    for (let h = 0; h < Math.ceil((work / 3.5) * 24) + 2; h++) w.studio.hourly([]);
    expect(released).toBe('clans');
    expect(w.rt.feature('clans')).toBe(true);
    // Marketing raises hype, which multiplies newcomers.
    const before = w.studio.arrivalMult();
    expect(w.studio.campaign('trailer')).toBeNull();
    expect(w.studio.arrivalMult()).toBeGreaterThan(before);
    // Sandbox is never gated.
    expect(buildWorld({ size: 64, npcs: 5 }).rt.feature('clans')).toBe(true);
  });
});
