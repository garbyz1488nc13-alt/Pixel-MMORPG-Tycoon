import { describe, expect, it } from 'vitest';
import { buildWorld } from './bench';
import { createWorldSave } from '@/systems/generation/createWorld';
import { migrate } from '@/persistence/serializer';
import { WORLD_SCHEMA_VERSION } from '@/models/world';
import { EntityEditor } from '@/systems/editor/EntityEditor';
import { History } from '@/systems/editor/History';
import { leagueFor } from '@/simulation/liveops/SeasonService';
import type { PatchDraft } from '@/simulation/liveops/PatchService';

const NONE: PatchDraft = { buff: null, nerf: null, levelCap: false, xp: 0, bugfix: false };

describe('auction house', () => {
  it('only monster-only loot is auctioned (not shop goods or gatherables)', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    const items = w.rt.entities.list('items');
    const byKey = (k: string) => items.find((i) => i.key === k)!;
    expect(w.auction.isDropOnly(byKey('slime_gel').id)).toBe(true);
    expect(w.auction.isDropOnly(byKey('wood').id)).toBe(false);
    expect(w.auction.isDropOnly(byKey('health_potion').id)).toBe(false);
  });

  it('players list rare loot, others buy it, the fee goes to the treasury', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    w.players.seedInitial(40);
    const gel = w.rt.entities.list('items').find((i) => i.key === 'slime_gel')!;
    const sellers = w.players.online().slice(0, 10);
    for (const p of sellers) w.players.giveItem(p, gel.id, 5);
    w.auction.hourly();
    const listed = w.rt.sim.auction.listings.filter((l) => l.itemId === gel.id);
    expect(listed.length).toBeGreaterThan(0);
    // A trader with gold spots underpriced lots / a quest needs them: make a cheap lot and a rich trader.
    listed[0].price = 1;
    const buyer = w.players.online().find((p) => !sellers.includes(p))!;
    buyer.behavior = 'trader';
    buyer.gold = 500;
    const treasury = w.rt.rpg.economy.treasury;
    w.rt.sim.auction.feePct = 20;
    w.rt.sim.auction.avgPrice[gel.id] = 20;
    w.auction.hourly();
    expect(w.rt.sim.auction.sales.length).toBeGreaterThan(0);
    expect(w.rt.sim.auction.volume).toBeGreaterThan(0);
    expect(w.rt.rpg.economy.treasury).toBeGreaterThanOrEqual(treasury);
  });

  it('a market forms during normal play', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    w.players.seedInitial(40);
    for (let i = 0; i < 4 * 60 * 24; i++) w.engine.step();
    expect(w.rt.sim.auction.listings.length + w.rt.sim.auction.sales.length).toBeGreaterThan(0);
  }, 60000);
});

describe('seasons', () => {
  it('ranks clans by boss kills, ends with rewards and titles, then resets', () => {
    const w = buildWorld({ size: 96, npcs: 10, seed: 7 });
    const ps = Array.from({ length: 6 }, () => w.players.join()!);
    const clan = w.clans.found(ps[0]);
    for (const p of ps.slice(1)) w.clans.join(p, clan);
    w.rt.sim.season.clanPoints[clan.id] = 700;
    w.rt.sim.season.playerPoints[ps[0].id] = 50;
    w.rt.sim.season.pvp[ps[1].id] = 4;
    expect(leagueFor(700).key).toBe('platinum');
    const fame = clan.fame;
    w.rt.sim.season.startedAt = w.rt.clock.totalMinutes - 8 * 24 * 60;
    w.seasons.hourly();
    expect(w.rt.sim.season.number).toBe(2);
    expect(w.rt.sim.season.history[0].topClans[0].name).toBe(clan.name);
    expect(clan.fame).toBeGreaterThan(fame);
    expect(ps[0].titles?.[0]).toMatch(/Champion/);
    expect(ps[1].titles?.[0]).toMatch(/Warlord/);
    expect(w.rt.sim.season.clanPoints).toEqual({});
  });

  it('players earn season points by playing', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    w.players.seedInitial(20);
    for (let i = 0; i < 4 * 60 * 4; i++) w.engine.step();
    expect(Object.keys(w.rt.sim.season.playerPoints).length).toBeGreaterThan(0);
  }, 30000);
});

describe('patches', () => {
  it('ships new content with hype, bugs and a version bump; bug fixes clear bugs', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    w.players.seedInitial(20);
    const ed = new EntityEditor(() => w.rt, new History(50, () => undefined));
    expect(w.patches.problem(NONE)).not.toBeNull();
    const sp = w.players.spawnPoint();
    ed.addLair('goblin_king', sp.x + 12, sp.y);
    ed.addRegion('forest', { x: 2, y: 2, w: 10, h: 10 });
    expect(w.patches.hype()).toBeGreaterThan(0);
    const pop = w.rt.sim.popularity;
    w.patches.rand = () => 0.99;
    const r = w.patches.release(NONE)!;
    expect(r.version).toBe('1.1');
    expect(r.notes.length).toBeGreaterThan(1);
    expect(w.rt.sim.popularity).toBeGreaterThan(pop);
    expect(w.rt.sim.patches.bugs).toBe(r.bugsIntroduced);
    expect(w.patches.hype()).toBe(0);
    // Cooldown, then a hotfix.
    expect(w.patches.problem({ ...NONE, bugfix: true })).not.toBeNull();
    w.rt.sim.patches.lastAt = -1e6;
    w.rt.sim.patches.bugs = 5;
    const fix = w.patches.release({ ...NONE, bugfix: true })!;
    expect(fix.bugsFixed).toBe(5);
    expect(w.rt.sim.patches.bugs).toBe(0);
  });

  it('nerfs anger that class, level cap raises the cap and the major version', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    w.players.seedInitial(30);
    const victim = w.players.online()[0];
    const cls = w.rt.rpg.progression.classes.find((c) => c.key === victim.classKey)!;
    const growth = cls.growth[cls.primary];
    const cap = w.rt.rpg.progression.maxLevel;
    const r = w.patches.release({ ...NONE, nerf: victim.classKey, levelCap: true })!;
    expect(cls.growth[cls.primary]).toBeLessThan(growth);
    expect(w.rt.rpg.progression.maxLevel).toBe(cap + 5);
    expect(r.version).toBe('2.0');
    expect(victim.factors.nerf ?? 0).toBeLessThan(0);
  });

  it('XP rate patches change levelling speed', () => {
    const w = buildWorld({ size: 96, npcs: 10, seed: 3 });
    const p = w.players.join()!;
    w.patches.release({ ...NONE, xp: 1 });
    expect(w.rt.sim.patches.xpRate).toBe(1.25);
    const xp0 = p.xp;
    w.players.gainXp(p, 4);
    expect(p.xp - xp0).toBe(5);
  });

  it('migrates v8 saves to v9', () => {
    const save = createWorldSave({ name: 'Old', width: 32, height: 32, worldType: 'continent', difficulty: 'normal', seed: 1, startingGold: 100, initialNpcCount: 0, initialPlayerCount: 0, gameMode: 'sandbox' });
    const old = structuredClone(save) as unknown as { schemaVersion: number; sim: Record<string, unknown> };
    old.schemaVersion = 8;
    delete old.sim.auction; delete old.sim.season; delete old.sim.patches;
    const m = migrate(old as never);
    expect(m.schemaVersion).toBe(WORLD_SCHEMA_VERSION);
    expect(m.sim.auction.feePct).toBe(5);
    expect(m.sim.season.number).toBe(1);
    expect(m.sim.patches.major).toBe(1);
  });
});
