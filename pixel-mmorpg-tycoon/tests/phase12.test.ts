import { describe, expect, it } from 'vitest';
import { buildWorld } from './bench';
import { getObjectDef } from '@/data/objects';
import { EntityEditor } from '@/systems/editor/EntityEditor';
import { History } from '@/systems/editor/History';
import { STARTING_PLAYER_GOLD } from '@/simulation/players/PlayerManager';

describe('portals', () => {
  it('players take a linked portal when it is a shortcut', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    const ed = new EntityEditor(() => w.rt, new History(50, () => undefined));
    const p = w.players.join()!;
    const a = w.actors.actors.get(p.id)!;
    // Portal A next to the player, portal B next to a far destination.
    const near = w.actors.randomWalkableNear(a.x + 2, a.y, 2)!;
    let far: { x: number; y: number } | null = null;
    for (let r = 50; r < 120 && !far; r += 5) far = w.actors.randomWalkableNear(a.x + (a.x < 64 ? r : -r), a.y, 6);
    expect(far).toBeTruthy();
    const pa = ed.placeObject('portal', near.x, near.y)!;
    const pb = ed.placeObject('portal', far!.x, far!.y)!;
    ed.update('objects', pa.id, { linkId: pb.id });
    ed.update('objects', pb.id, { linkId: pa.id });
    let used = 0;
    w.actors.events.on('portal', () => used++);
    const m = w.ps.mind(a.id);
    const dest = w.actors.randomWalkableNear(far!.x, far!.y + 3, 3)!;
    m.act = { kind: 'explore', regionId: '', x: dest.x, y: dest.y };
    m.nextPlan = 1e9;
    for (let i = 0; i < 400 && !used; i++) w.engine.step();
    expect(used).toBe(1);
    expect(Math.hypot(a.x - far!.x, a.y - far!.y)).toBeLessThan(6);
  });
});

describe('gear', () => {
  it('new players can afford armour and most players wear some after a day', () => {
    expect(STARTING_PLAYER_GOLD).toBeGreaterThanOrEqual(60);
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    w.players.seedInitial(40);
    for (let i = 0; i < 4 * 60 * 24; i++) w.engine.step();
    const ps = w.rt.sim.players;
    const armoured = ps.filter((p) => p.equipment.chest || p.equipment.head || p.equipment.feet).length;
    expect(armoured / ps.length).toBeGreaterThan(0.4);
  }, 90000);
});

describe('decorations', () => {
  it('has new camp and town decorations with art, used by the generator', () => {
    for (const k of ['palisade', 'log_wall', 'hut', 'tent', 'banner', 'torch', 'hay', 'cart', 'stall', 'bench', 'gravestone', 'bones', 'stump', 'mushrooms', 'totem', 'spikes']) expect(getObjectDef(k), k).toBeTruthy();
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    const kinds = new Set(w.rt.entities.list('objects').map((o) => o.kind));
    expect(kinds.has('palisade') || kinds.has('totem')).toBe(true);
  });
});
