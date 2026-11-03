import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { WorldRuntime } from '@/simulation/WorldRuntime';
import { SimulationEngine } from '@/simulation/SimulationEngine';
import { ClockSystem } from '@/simulation/systems/ClockSystem';
import { GAME_MINUTES_PER_TICK } from '@/simulation/time';
import { History } from '@/systems/editor/History';
import { TerrainPainter } from '@/systems/editor/TerrainPainter';
import { createWorldSave } from '@/systems/generation/createWorld';
import { WorldRepository } from '@/persistence/WorldRepository';
import { exportWorldJson, parseWorldJson } from '@/persistence/serializer';

const opts = { name: 'Test', width: 32, height: 32, worldType: 'flat' as const, difficulty: 'normal' as const, seed: 1, startingGold: 100, initialNpcCount: 1, initialPlayerCount: 2 };

describe('painter + history', () => {
  it('paints a stroke as one undo step', () => {
    const rt = new WorldRuntime(createWorldSave(opts));
    const p = new TerrainPainter(() => rt, new History());
    p.beginStroke(4);
    p.strokeTo(0, 0, 1, 'square');
    p.strokeTo(5, 0, 1, 'square');
    expect(p.endStroke()).toBe(6);
    expect(rt.grid.get(3, 0)).toBe(4);
    p.history.undo(rt);
    expect(rt.grid.get(3, 0)).toBe(0);
    p.history.redo(rt);
    expect(rt.grid.get(3, 0)).toBe(4);
  });
  it('undoes map resize', () => {
    const rt = new WorldRuntime(createWorldSave(opts));
    const p = new TerrainPainter(() => rt, new History());
    p.replaceMap(rt.grid.resized(40, 20, 0, 0, 2), 'Resize');
    expect(rt.grid.width).toBe(40);
    p.history.undo(rt);
    expect(rt.grid.width).toBe(32);
  });
});

describe('simulation', () => {
  it('advances the clock with fixed ticks', () => {
    const rt = new WorldRuntime(createWorldSave(opts));
    const engine = new SimulationEngine(rt);
    engine.addSystem(new ClockSystem(engine.events));
    const start = rt.clock.totalMinutes;
    for (let i = 0; i < 40; i++) engine.step();
    expect(rt.clock.totalMinutes).toBeCloseTo(start + 40 * GAME_MINUTES_PER_TICK);
  });
});

describe('persistence', () => {
  it('saves, lists, loads slots and deletes', async () => {
    const save = createWorldSave(opts);
    await WorldRepository.save(save, 'slot1');
    await WorldRepository.save({ ...save, updatedAt: save.updatedAt + 10, name: 'Newer' }, 'auto');
    expect((await WorldRepository.listWorlds()).some((w) => w.id === save.id)).toBe(true);
    expect(await WorldRepository.listSlots(save.id)).toHaveLength(2);
    expect((await WorldRepository.load(save.id))!.slot).toBe('auto');
    expect((await WorldRepository.load(save.id, 'slot1'))!.save.name).toBe('Test');
    await WorldRepository.renameWorld(save.id, 'Renamed');
    expect((await WorldRepository.getMeta(save.id))!.name).toBe('Renamed');
    await WorldRepository.deleteWorld(save.id);
    expect(await WorldRepository.load(save.id)).toBeNull();
  });
  it('round-trips JSON export/import', async () => {
    const save = createWorldSave({ ...opts, worldType: 'islands' });
    const parsed = parseWorldJson(exportWorldJson(save));
    expect(parsed.map.tilesRle).toBe(save.map.tilesRle);
    expect(() => parseWorldJson('{"nope":1}')).toThrow();
    const imported = await WorldRepository.importWorld(parsed);
    const again = await WorldRepository.importWorld(parsed);
    expect(again.id).not.toBe(imported.id);
  });
});
