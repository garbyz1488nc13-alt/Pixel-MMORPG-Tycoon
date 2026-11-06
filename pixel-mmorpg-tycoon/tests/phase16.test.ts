import { describe, expect, it } from 'vitest';
import { buildWorld } from './bench';
import { ACTIVITY_BY_HOUR } from '@/simulation/players/PlayerManager';
import { doorTile } from '@/data/furniture';
import { EntityEditor } from '@/systems/editor/EntityEditor';
import { History } from '@/systems/editor/History';

describe('peak hours', () => {
  it('evenings are busier than early mornings', () => {
    expect(Math.max(...ACTIVITY_BY_HOUR.slice(18, 22))).toBeGreaterThan(Math.max(...ACTIVITY_BY_HOUR.slice(2, 6)) * 3);
    const w = buildWorld({ size: 96, npcs: 10, seed: 3 });
    w.rt.clock.totalMinutes = 4 * 60; const night = w.players.activity();
    w.rt.clock.totalMinutes = 20 * 60; const evening = w.players.activity();
    expect(evening).toBeGreaterThan(night);
  });
});

describe('bots and gold sellers', () => {
  it('gold sellers spam the chat, bots dump loot cheaply', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    const seller = w.players.join()!; seller.cheat = 'goldseller';
    const bot = w.players.join()!; bot.cheat = 'bot';
    for (let i = 0; i < 20; i++) w.players.join();
    const gel = w.rt.entities.list('items').find((i) => i.key === 'slime_gel')!;
    w.players.giveItem(bot, gel.id, 10);
    const said0 = w.chat.said;
    for (let i = 0; i < 200; i++) w.engine.step();
    expect(w.chat.log.some((l) => l.name === seller.name && /gold|GOLD|power/i.test(l.key))).toBe(true);
    expect(w.chat.said).toBeGreaterThan(said0);
    w.players.giveItem(bot, gel.id, 10);
    const market = w.auction.marketPrice(gel);
    const prices: number[] = [];
    w.auction.events.on('sale', ({ sale }) => { if (sale.seller === bot.name) prices.push(sale.price); });
    w.auction.hourly();
    for (const l of w.rt.sim.auction.listings) if (l.sellerId === bot.id) prices.push(l.price);
    expect(prices.length).toBeGreaterThan(0);
    expect(Math.min(...prices)).toBeLessThanOrEqual(market * 0.6);
  });
});

describe('friends', () => {
  it('playing together makes friends, friends cheer you up and keep you around', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    w.players.seedInitial(40);
    for (let i = 0; i < 4 * 60 * 12; i++) w.engine.step();
    const withFriends = w.rt.sim.players.filter((p) => (p.friends?.length ?? 0) > 0);
    expect(withFriends.length).toBeGreaterThan(0);
    // Friendship is mutual.
    const p = withFriends[0];
    const f = w.players.get(p.friends![0]);
    if (f) expect(f.friends).toContain(p.id);
  }, 90000);
});

describe('group dungeons', () => {
  it('a party forms, goes inside, and comes out with a result', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    const ed = new EntityEditor(() => w.rt, new History(20, () => undefined));
    if (!w.dungeons.entrances().length) {
      // Near where players appear, so the party can walk there in time.
      const sp = w.players.spawnPoint();
      let placed = null;
      for (let r = 3; r < 40 && !placed; r++) for (let k = 0; k < 16 && !placed; k++) placed = ed.placeObject('dungeon_entrance', sp.x + Math.round(Math.cos(k) * r), sp.y + Math.round(Math.sin(k) * r));
    }
    const doors = w.dungeons.entrances();
    expect(doors.length).toBeGreaterThan(0);
    const door = doors[0];
    const lv = w.dungeons.levelOf(door);
    for (let i = 0; i < 8; i++) { const p = w.players.join()!; p.level = lv; p.classKey = (['warrior', 'paladin', 'mage', 'archer', 'rogue'] as const)[i % 5]; }
    let finished = 0;
    w.dungeons.events.on('finished', () => finished++);
    let run = null;
    for (let k = 0; k < 20 && !run; k++) { run = w.dungeons.form(); if (!run) w.engine.step(); }
    expect(run).toBeTruthy();
    let inside = false;
    for (let i = 0; i < 2000 && !finished; i++) { w.engine.step(); if (w.dungeons.inside().size) inside = true; }
    expect(inside).toBe(true);
    expect(finished).toBeGreaterThan(0);
    const st = w.rt.sim.dungeonStats![run!.entranceId];
    expect(st.runs).toBe(1);
    expect(st.clears + st.wipes).toBe(1);
  });
});

describe('hotels and rooms', () => {
  it('players rent rooms, log in at their hotel and pay rent', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    const ed = new EntityEditor(() => w.rt, new History(20, () => undefined));
    const sp = w.players.spawnPoint();
    let hotel = w.rt.entities.list('objects').find((o) => o.kind === 'hotel') ?? null;
    for (let y = 5; y < 120 && !hotel; y += 3) for (let x = 5; x < 120 && !hotel; x += 3) hotel = ed.placeObject('hotel', x, y);
    void sp;
    expect(hotel?.interior?.furniture.filter((f) => f.kind === 'bed').length).toBeGreaterThan(5);
    const ps = Array.from({ length: 20 }, () => { const p = w.players.join()!; p.playMinutes = 500; p.gold = 500; p.satisfaction = 80; return p; });
    for (let h = 0; h < 40 && !ps.some((p) => p.home); h++) w.players.hourly();
    const tenant = ps.find((p) => p.home)!;
    expect(tenant).toBeTruthy();
    expect(w.players.homeDoor(tenant)).toBeTruthy();
    // Rent at midnight goes to the treasury.
    const gold = tenant.gold, treasury = w.rt.rpg.economy.treasury;
    w.rt.clock.totalMinutes = Math.ceil(w.rt.clock.totalMinutes / 1440) * 1440;
    w.players.hourly();
    expect(tenant.gold).toBeLessThan(gold);
    expect(w.rt.rpg.economy.treasury).toBeGreaterThan(treasury);
    // Logging in again: at the hotel door.
    const door = doorTile(w.rt.entities.get('objects', tenant.home!.objectId)!);
    w.players.logout(tenant);
    if (w.players.get(tenant.id)) {
      tenant.returnAt = 0;
      (w.players as unknown as { startSession(p: unknown): void }).startSession(tenant);
      const a = w.actors.actors.get(tenant.id)!;
      expect(Math.hypot(a.x - door.x, a.y - door.y)).toBeLessThan(4);
    }
  });
});
