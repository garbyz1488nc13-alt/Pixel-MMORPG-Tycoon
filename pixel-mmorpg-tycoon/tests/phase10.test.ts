import { describe, expect, it } from 'vitest';
import { buildWorld } from './bench';
import { EMPTY_START_FUNDS_MULT, STARTING_FUNDS, createDefaultStudio } from '@/data/studio';
import { doorTile, getFurniture } from '@/data/furniture';
import { WorldRuntime } from '@/simulation/WorldRuntime';
import { ActorManager } from '@/simulation/actors/ActorManager';
import { EconomyService } from '@/simulation/economy/EconomyService';
import { PlayerManager } from '@/simulation/players/PlayerManager';
import { createWorldSave } from '@/systems/generation/createWorld';
import { EntityEditor } from '@/systems/editor/EntityEditor';
import { EntityCommand, History } from '@/systems/editor/History';
import { StudioService } from '@/simulation/studio/StudioService';

describe('empty start', () => {
  it('gives more money and keeps servers closed until a spawn point exists', () => {
    expect(createDefaultStudio('standard', 'normal', 'empty').funds).toBe(STARTING_FUNDS.normal * EMPTY_START_FUNDS_MULT);
    const save = createWorldSave({ name: 'E', width: 64, height: 64, worldType: 'continent', difficulty: 'normal', seed: 5, startingGold: 100, initialNpcCount: 20, initialPlayerCount: 15, gameMode: 'standard', startMode: 'empty' });
    expect(save.config.launched).toBe(false);
    const rt = new WorldRuntime(save);
    const actors = new ActorManager(rt, 1);
    const pm = new PlayerManager(rt, actors, new EconomyService(rt, actors));
    expect(rt.entities.count('objects')).toBe(0);
    expect(pm.join()).toBeNull();
    pm.hourly();
    expect(rt.sim.players.length).toBe(0);
    // Build a spawn point: the queue logs in.
    let launched = 0;
    pm.events.on('launched', ({ count }) => { launched = count; });
    const ed = new EntityEditor(() => rt, new History(10, () => undefined));
    for (let i = 0; i < 400 && !rt.entities.list('objects').length; i++) ed.placeObject('player_spawn', 10 + (i % 40), 10 + Math.floor(i / 40));
    pm.hourly();
    expect(rt.config.launched).toBe(true);
    expect(launched).toBeGreaterThan(0);
    expect(pm.online().length).toBe(launched);
  });
});

describe('building interiors', () => {
  it('a spawn point inside a tavern makes players walk out of its door', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    const tavern = w.rt.entities.list('objects').find((o) => o.kind === 'tavern')!;
    expect(tavern.interior?.furniture.some((f) => f.kind === 'bed')).toBe(true); // generated taverns are furnished
    for (const o of w.rt.entities.list('objects').filter((x) => x.kind === 'player_spawn')) w.rt.entities.remove('objects', o.id);
    w.rt.entities.update('objects', tavern.id, { interior: { furniture: [...tavern.interior!.furniture, { kind: 'spawn', x: 2, y: 2 }] } });
    const door = doorTile(tavern);
    for (let i = 0; i < 10; i++) {
      const p = w.players.spawnPoint();
      expect(Math.hypot(p.x - door.x, p.y - door.y)).toBeLessThanOrEqual(2);
    }
  });

  it('furniture costs money in standard mode (undo refunds)', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3, mode: 'standard' });
    const history = new History(20, () => undefined);
    const ed = new EntityEditor(() => w.rt, history);
    const studio = new StudioService(w.rt);
    ed.budget = studio;
    EntityCommand.budget = studio;
    const house = w.rt.entities.list('objects').find((o) => o.kind === 'house_small')!;
    const funds = w.rt.studio.funds;
    ed.update('objects', house.id, { interior: { furniture: [{ kind: 'spawn', x: 1, y: 1 }, { kind: 'bed', x: 2, y: 1 }] } }, 'furnish');
    expect(w.rt.studio.funds).toBe(funds - getFurniture('spawn').cost - getFurniture('bed').cost);
    history.undo(w.rt);
    expect(w.rt.studio.funds).toBe(funds);
    EntityCommand.budget = null;
  });

  it('players go inside taverns to rest and hang out', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    w.players.seedInitial(30);
    let inside = 0;
    for (let i = 0; i < 4 * 60 * 24 && !inside; i++) {
      w.engine.step();
      if (i % 40 === 0) for (const o of w.rt.entities.list('objects')) if (o.interior) {
        const d = doorTile(o);
        inside += w.players.online().filter((p) => { const a = w.actors.actors.get(p.id); const k = a && w.ps.activityOf(a.id)?.kind; return a && (k === 'rest' || k === 'social') && Math.hypot(a.x - d.x - 0.5, a.y - d.y - 0.5) < 3.5; }).length;
      }
    }
    expect(inside).toBeGreaterThan(0);
  }, 60000);
});

describe('player chat', () => {
  it('players talk to each other, react to events and show bubbles', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    w.players.seedInitial(40);
    for (let i = 0; i < 4 * 60 * 3; i++) w.engine.step();
    expect(w.chat.log.length).toBeGreaterThan(5);
    const p = w.players.online()[0];
    w.chat.say(p.id, 'hi!');
    expect(w.chat.bubbles.get(p.id)?.key).toBe('hi!');
    for (let i = 0; i < 60; i++) w.engine.step();
    expect(w.chat.bubbles.get(p.id)?.key === 'hi!').toBe(false);
    // Level-ups get a "Ding!".
    const before = w.chat.said;
    for (let i = 0; i < 6; i++) w.players.gainXp(p, 100000);
    expect(w.chat.said).toBeGreaterThan(before);
  });
});
