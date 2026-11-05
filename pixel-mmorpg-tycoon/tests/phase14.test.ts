import { describe, expect, it } from 'vitest';
import { buildWorld } from './bench';
import { serviceBuilding, temples } from '@/data/buildings';
import { doorTile } from '@/data/furniture';
import { kill } from '@/simulation/actors/combat';

describe('buildings that matter', () => {
  it('generated service NPCs live by their building', () => {
    const w = buildWorld({ size: 128, npcs: 30, seed: 3 });
    for (const n of w.rt.entities.list('npcs')) {
      if (n.type === 'healer' || n.type === 'blacksmith') expect(serviceBuilding(w.rt, n), n.type).toBeTruthy();
    }
  });

  it('dead players come back at the nearest temple', () => {
    const w = buildWorld({ size: 128, npcs: 30, seed: 3 });
    const ts = temples(w.rt);
    expect(ts.length).toBeGreaterThan(0);
    const p = w.players.join()!;
    const a = w.actors.actors.get(p.id)!;
    kill(w.actors, a, null);
    for (let i = 0; i < 40 && a.state === 'dead'; i++) w.engine.step();
    expect(a.state).not.toBe('dead');
    const near = Math.min(...ts.map((t) => Math.hypot(t.x - a.x, t.y - a.y)));
    expect(near).toBeLessThan(4);
  });

  it('temple healers heal hurt players walking past', () => {
    const w = buildWorld({ size: 128, npcs: 30, seed: 3 });
    const healer = w.rt.entities.list('npcs').find((n) => n.type === 'healer' && serviceBuilding(w.rt, n))!;
    const h = w.actors.actors.get(healer.id)!;
    const p = w.players.join()!;
    const a = w.actors.actors.get(p.id)!;
    let heals = 0;
    w.actors.events.on('heal', ({ target, amount }) => { if (target === a && amount > 0) heals++; });
    for (let i = 0; i < 60 && !heals; i++) { w.actors.teleport(a, Math.floor(h.x), Math.floor(h.y) + 1); a.hp = Math.floor(a.maxHp / 3); a.targetId = null; w.engine.step(); }
    expect(heals).toBeGreaterThan(0);
  });

  it('merchants with a shop restock faster than street stalls', () => {
    const w = buildWorld({ size: 128, npcs: 30, seed: 3 });
    const merchants = w.econ.merchants().filter((m) => m.type === 'merchant' || m.type === 'blacksmith');
    const housed = merchants.find((m) => serviceBuilding(w.rt, m))!;
    expect(housed).toBeTruthy();
    // Move the same merchant away from its building: it becomes a street stall.
    const empty = (id: string) => { const n = w.rt.entities.get('npcs', id)!; w.rt.entities.update('npcs', id, { gold: 100000, shop: { ...n.shop, items: n.shop.items.map((s) => ({ ...s, stock: 0 })) } }); };
    const stock = (id: string) => w.rt.entities.get('npcs', id)!.shop.items.reduce((n, s) => n + s.stock, 0);
    empty(housed.id);
    w.econ.restock(60 * 3);
    const fast = stock(housed.id);
    w.rt.entities.update('npcs', housed.id, { x: 2, y: 2 });
    empty(housed.id);
    w.econ.restock(60 * 3);
    const slow = stock(housed.id);
    expect(fast).toBeGreaterThan(slow);
  });

  it('banks take deposits only with a bank building, and pay interest from the treasury', () => {
    const w = buildWorld({ size: 128, npcs: 30, seed: 3 });
    const p = w.players.join()!;
    p.bank = 1000;
    const treasury = w.rt.rpg.economy.treasury;
    const hasBank = w.rt.entities.list('objects').some((o) => o.kind === 'bank');
    w.players.hourly();
    if (hasBank) {
      expect(p.bank).toBeGreaterThan(1000);
      expect(w.rt.rpg.economy.treasury).toBeLessThan(treasury);
    } else expect(p.bank).toBe(1000);
    // Remove banks: no interest.
    for (const o of w.rt.entities.list('objects').filter((x) => x.kind === 'bank')) w.rt.entities.remove('objects', o.id);
    const b = p.bank!;
    w.players.hourly();
    expect(p.bank).toBe(b);
    expect(doorTile).toBeTruthy();
  });
});
