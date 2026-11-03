import { describe, expect, it } from 'vitest';
import { WorldRuntime } from '@/simulation/WorldRuntime';
import { SimulationEngine } from '@/simulation/SimulationEngine';
import { ClockSystem } from '@/simulation/systems/ClockSystem';
import { NpcSystem, isWorkingHour } from '@/simulation/systems/NpcSystem';
import { CreatureSystem } from '@/simulation/systems/CreatureSystem';
import { ActorManager } from '@/simulation/actors/ActorManager';
import { History } from '@/systems/editor/History';
import { EntityEditor } from '@/systems/editor/EntityEditor';
import { createWorldSave } from '@/systems/generation/createWorld';
import { populateRegion, generateStarterContent } from '@/systems/generation/Populate';
import { migrate } from '@/persistence/serializer';
import { TerrainId } from '@/data/terrain';
import { Pathfinder } from '@/simulation/nav/Pathfinder';
import { getObjectDef } from '@/data/objects';

const opts = { name: 'T', width: 48, height: 48, worldType: 'flat' as const, difficulty: 'normal' as const, seed: 7, startingGold: 0, initialNpcCount: 0, initialPlayerCount: 0 };

function setup() {
  const rt = new WorldRuntime(createWorldSave(opts));
  const history = new History();
  const ed = new EntityEditor(() => rt, history);
  const actors = new ActorManager(rt);
  const engine = new SimulationEngine(rt);
  engine.addSystem(new ClockSystem(engine.events));
  engine.addSystem(new NpcSystem(actors));
  engine.addSystem(new CreatureSystem(actors));
  return { rt, history, ed, actors, engine };
}

describe('objects', () => {
  it('validates footprints, moves, undoes', () => {
    const { rt, history, ed } = setup();
    const house = ed.placeObject('house_small', 5, 5)!;
    expect(house).toBeTruthy();
    expect(ed.placeObject('tree_oak', 6, 6)).toBeNull(); // overlaps the house
    expect(ed.placeObject('road', 6, 6)).toBeNull(); // no road under a house
    expect(rt.nav.isWalkable(5, 5)).toBe(false);
    expect(ed.moveObjects([house.id], 3, 0)).toBe(true);
    expect(rt.entities.get('objects', house.id)!.x).toBe(8);
    history.undo(rt);
    expect(rt.entities.get('objects', house.id)!.x).toBe(5);
    history.undo(rt);
    expect(rt.entities.count('objects')).toBe(0);
  });

  it('bridges make water walkable', () => {
    const { rt, ed } = setup();
    rt.setTiles([rt.grid.index(10, 10)], [TerrainId.Water]);
    expect(rt.nav.isWalkable(10, 10)).toBe(false);
    ed.placeObject('bridge', 10, 10);
    expect(rt.nav.isWalkable(10, 10)).toBe(true);
  });
});

describe('pathfinding', () => {
  it('routes around walls and fails when sealed', () => {
    const { rt, ed } = setup();
    for (let y = 0; y < 40; y++) ed.placeObject('wall', 20, y);
    const pf = new Pathfinder(rt.nav);
    const path = pf.find(10, 10, 30, 10, 20000)!;
    expect(path).not.toBeNull();
    expect(path.length).toBeGreaterThan(20);
    for (let y = 40; y < 48; y++) ed.placeObject('wall', 20, y);
    expect(pf.find(10, 10, 30, 10, 20000)).toBeNull();
  });
});

describe('simulation', () => {
  it('guards kill aggressive monsters that come close', () => {
    const { rt, ed, actors, engine } = setup();
    const tpl = ed.addTemplate('slime');
    ed.update('creatureTemplates', tpl.id, { aggression: 'aggressive', aggroRange: 8, maxHp: 20, respawnMinutes: 10000 });
    const guard = ed.addNpc('guard', 20, 20)!;
    ed.update('npcs', guard.id, { behavior: 'stationary', interactionRadius: 10 });
    ed.addSpawnArea(tpl.id, { x: 23, y: 18, w: 4, h: 4 });
    const slimes = () => [...actors.actors.values()].filter((a) => a.kind === 'creature');
    expect(slimes().length).toBeGreaterThan(0);
    for (let i = 0; i < 1500 && slimes().some((s) => s.state !== 'dead'); i++) engine.step();
    expect(slimes().every((s) => s.state === 'dead')).toBe(true);
    expect(actors.stats.creatureKills).toBe(slimes().length);
    expect(actors.actors.get(guard.id)!.state).not.toBe('dead');
    void rt;
  });

  it('wandering NPCs move and stay near home', () => {
    const { ed, actors, engine } = setup();
    const v = ed.addNpc('villager', 24, 24)!;
    ed.update('npcs', v.id, { behavior: 'wander', wanderRadius: 4, workStart: 0, workEnd: 24 });
    const a = actors.actors.get(v.id)!;
    let moved = false;
    for (let i = 0; i < 400; i++) {
      engine.step();
      if (Math.abs(a.x - 24.5) + Math.abs(a.y - 24.5) > 0.5) moved = true;
      expect(Math.abs(a.x - 24.5)).toBeLessThanOrEqual(5.5);
    }
    expect(moved).toBe(true);
  });

  it('working hours wrap around midnight', () => {
    expect(isWorkingHour(23, 22, 6)).toBe(true);
    expect(isWorkingHour(12, 22, 6)).toBe(false);
    expect(isWorkingHour(5, 0, 24)).toBe(true);
  });
});

describe('generators', () => {
  it('populates a town and is undoable as one step', () => {
    const { rt, history, ed } = setup();
    const reg = ed.addRegion('town', { x: 4, y: 4, w: 30, h: 30 });
    const summary = populateRegion(rt, history, reg, 1);
    expect(summary).toMatch(/objects/);
    expect(rt.entities.count('npcs')).toBeGreaterThan(5);
    expect(rt.entities.count('objects')).toBeGreaterThan(30);
    history.undo(rt);
    expect(rt.entities.count('npcs')).toBe(0);
    expect(rt.entities.count('objects')).toBe(0);
  });

  it('creates exactly the requested starter NPCs', () => {
    const rt = new WorldRuntime(createWorldSave({ ...opts, width: 96, height: 96 }));
    generateStarterContent(rt, 20, 3);
    expect(rt.entities.count('npcs')).toBe(20);
    expect(rt.entities.count('spawnAreas')).toBeGreaterThan(0);
  });
});

describe('save migration', () => {
  it('upgrades v1 saves', () => {
    const s = createWorldSave(opts) as any;
    delete s.entities;
    s.schemaVersion = 1;
    const m = migrate(s);
    expect(m.schemaVersion).toBe(2);
    expect(m.entities.objects).toEqual([]);
  });
});

describe('all generators', () => {
  it.each(['village', 'city', 'forest', 'dungeon', 'cave'] as const)('populates %s without overlaps', (type) => {
    const rt = new WorldRuntime(createWorldSave({ ...opts, width: 64, height: 64 }));
    const history = new History();
    const ed = new EntityEditor(() => rt, history);
    const reg = ed.addRegion(type, { x: 6, y: 6, w: 36, h: 36 });
    populateRegion(rt, history, reg, 5);
    expect(rt.entities.count('objects')).toBeGreaterThan(5);
    // No two objects share a tile.
    const seen = new Set<string>();
    for (const o of rt.entities.list('objects')) {
      const d = getObjectDef(o.kind)!;
      for (let y = o.y; y < o.y + d.h; y++) for (let x = o.x; x < o.x + d.w; x++) {
        const k = `${x},${y}`;
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
    // Every NPC stands on a walkable tile.
    for (const n of rt.entities.list('npcs')) expect(rt.nav.isWalkable(n.x, n.y)).toBe(true);
  });
});
