import { describe, expect, it } from 'vitest';
import { buildWorld } from './bench';
import { BOSS_ENRAGE_AT, getBossPreset } from '@/data/bossTypes';
import { LAIR_BASE_COST, LAIR_COST_PER_RAIDER } from '@/data/studio';
import { WORLD_SCHEMA_VERSION } from '@/models/world';
import type { PlayerState } from '@/models/sim';
import { migrate } from '@/persistence/serializer';
import { attack } from '@/simulation/actors/combat';
import { EntityEditor } from '@/systems/editor/EntityEditor';
import { EntityCommand, History } from '@/systems/editor/History';
import { createWorldSave } from '@/systems/generation/createWorld';

function world(opts: { mode?: 'sandbox' | 'standard'; seed?: number } = {}) {
  const w = buildWorld({ size: 96, npcs: 10, seed: opts.seed ?? 7, mode: opts.mode });
  const history = new History(100, () => undefined);
  const ed = new EntityEditor(() => w.rt, history);
  return { ...w, ed, history };
}

/** A lair a few tiles from the player spawn, plus `n` players at `level`. */
function raidSetup(n: number, level: number, preset = 'goblin_king', seed = 7) {
  const w = world({ seed });
  const sp = w.players.spawnPoint();
  const lair = w.ed.addLair(preset, sp.x + 12, sp.y)!;
  const tpl = w.rt.entities.get('creatureTemplates', lair.templateId)!;
  const ps: PlayerState[] = [];
  for (let i = 0; i < n; i++) {
    const p = w.players.join()!;
    p.level = level;
    p.behavior = 'fighter';
    p.sessionLeft = 99999;
    ps.push(p);
  }
  w.engine.step();
  return { ...w, lair, tpl, ps };
}

describe('boss lairs', () => {
  it('places a lair as one undo step: boss template + 1-boss area with raid settings', () => {
    const w = world();
    const sp = w.players.spawnPoint();
    const before = w.rt.entities.count('creatureTemplates');
    const area = w.ed.addLair('broodmother', sp.x + 10, sp.y)!;
    expect(area).toBeTruthy();
    const tpl = w.rt.entities.get('creatureTemplates', area.templateId)!;
    const preset = getBossPreset('broodmother');
    expect(tpl.boss).toBe(true);
    expect(tpl.level).toBe(preset.level);
    expect(tpl.loot.length).toBeGreaterThan(0);
    expect(area.maxCount).toBe(1);
    expect(area.lair).toEqual({ respawnHours: preset.respawnHours, minRaid: preset.minRaid });
    expect(w.clans.bossOf(area.id)).toBeTruthy();
    w.history.undo(w.rt);
    expect(w.rt.entities.get('spawnAreas', area.id)).toBeUndefined();
    expect(w.rt.entities.count('creatureTemplates')).toBe(before);
  });

  it('costs money in standard mode and is refused without funds', () => {
    const w = world({ mode: 'standard' });
    w.ed.budget = w.studio;
    EntityCommand.budget = w.studio;
    const sp = w.players.spawnPoint();
    w.rt.studio.funds = 5000;
    const area = w.ed.addLair('goblin_king', sp.x + 10, sp.y)!;
    expect(area).toBeTruthy();
    expect(w.rt.studio.funds).toBe(5000 - (LAIR_BASE_COST + 4 * LAIR_COST_PER_RAIDER));
    w.rt.studio.funds = 100;
    expect(w.ed.addLair('lich', sp.x - 10, sp.y)).toBeNull();
    expect(w.ed.lastError).toBeTruthy();
    EntityCommand.budget = null;
  });

  it('players never solo a lair', () => {
    const { brain, ps, lair } = raidSetup(3, 8);
    for (const p of ps) expect(brain.huntingAreas(p).some((a) => a.areaId === lair.id)).toBe(false);
  });

  it('boss slams everyone nearby, enrages at low health and resets when the raid is gone', () => {
    const { actors, clans, lair, ps, engine } = raidSetup(3, 6);
    const boss = clans.bossOf(lair.id)!;
    const victims = ps.map((p) => actors.actors.get(p.id)!);
    // Put everyone next to the boss.
    for (const v of victims) actors.teleport(v, Math.floor(boss.x), Math.floor(boss.y) + 1);
    let slams = 0;
    let enraged = 0;
    let resets = 0;
    actors.events.on('slam', ({ victims: n }) => { if (n > 0) slams++; });
    actors.events.on('enrage', () => enraged++);
    actors.events.on('bossReset', () => resets++);
    attack(actors, victims[0], boss);
    boss.hp = Math.floor(boss.maxHp * BOSS_ENRAGE_AT) - 1;
    for (let i = 0; i < 200 && slams === 0; i++) {
      // Stand in melee range (their AI would otherwise wander off).
      for (const v of victims) if (v.state !== 'dead') { actors.teleport(v, Math.floor(boss.x), Math.floor(boss.y) + 1); v.targetId = boss.id; v.hp = v.maxHp; }
      engine.step();
    }
    expect(slams).toBeGreaterThan(0);
    expect(enraged).toBe(1);
    expect(boss.enraged).toBe(true);
    // Everyone runs far away: the boss resets to full health.
    const far = actors.randomWalkableNear(boss.x + 30, boss.y + 30, 6) ?? { x: 2, y: 2 };
    for (const v of victims) { actors.teleport(v, far.x, far.y); v.targetId = null; }
    // Everyone (guards and other players included) leaves the lair.
    const everyone = () => [...actors.actors.values()].filter((o) => o.kind !== 'creature');
    for (let i = 0; i < 80 && resets === 0; i++) { for (const v of everyone()) { actors.teleport(v, far.x, far.y); v.targetId = null; } engine.step(); }
    expect(resets).toBeGreaterThan(0);
    expect(boss.hp).toBe(boss.maxHp);
    expect(boss.enraged).toBe(false);
  });

  it('respawns after the lair respawn time, not the template time', () => {
    const { actors, clans, lair, ps, rt } = raidSetup(1, 6);
    const boss = clans.bossOf(lair.id)!;
    boss.hp = 1;
    attack(actors, actors.actors.get(ps[0].id)!, boss, 100);
    expect(boss.state).toBe('dead');
    expect(boss.respawnAt - rt.clock.totalMinutes).toBe(lair.lair!.respawnHours * 60);
  });
});

describe('raids', () => {
  it('a full raid gathers, pulls and kills the boss; everyone shares XP, gold and loot', () => {
    const w = raidSetup(7, 7);
    const clan = w.clans.found(w.ps[0]);
    for (const p of w.ps.slice(1)) w.clans.join(p, clan);
    const gold = w.ps.map((p) => p.gold);
    const levels = w.ps.map((p) => p.level * 1e6 + p.xp);
    const raid = w.clans.startRaid(clan, w.ps, { area: w.lair, tpl: w.tpl });
    let pulled = false;
    w.clans.events.on('raidPulled', () => { pulled = true; });
    for (let i = 0; i < 6000 && w.rt.sim.raidHistory.every((r) => r.result !== 'win'); i++) w.engine.step();
    expect(pulled).toBe(true);
    const win = w.rt.sim.raidHistory.find((r) => r.result === 'win')!;
    expect(win).toBeTruthy();
    expect(win.clanName).toBe(clan.name);
    expect(win.worldFirst).toBe(true);
    expect(w.clans.raid(raid.id)).toBeUndefined();
    const stats = w.clans.lairStats(w.lair.id);
    expect(stats.kills).toBe(1);
    expect(stats.firstKill?.clanName).toBe(clan.name);
    expect(clan.raidWins).toBe(1);
    expect(clan.fame).toBeGreaterThan(0);
    expect(clan.bossKills[w.tpl.id]).toBe(1);
    // Several raiders (not only the killer) got gold + XP and enjoyed the raid.
    const rewarded = w.ps.filter((p, i) => p.gold > gold[i] && p.level * 1e6 + p.xp > levels[i] && (p.factors.raid ?? 0) > 0);
    expect(rewarded.length).toBeGreaterThanOrEqual(3);
  });

  it('a tiny group wipes, the clan gets drama and the raid gives up after 3 attempts', () => {
    const w = raidSetup(2, 4);
    const clan = w.clans.found(w.ps[0]);
    w.clans.join(w.ps[1], clan);
    // Two players are fewer than 0.75 × 4 needed: force a pull by starting next to the boss.
    w.rt.entities.update('spawnAreas', w.lair.id, { lair: { ...w.lair.lair!, minRaid: 2 } });
    w.clans.startRaid(clan, w.ps, { area: w.rt.entities.get('spawnAreas', w.lair.id)!, tpl: w.tpl });
    for (let i = 0; i < 8000 && w.rt.sim.raids.length; i++) w.engine.step();
    const wipes = w.rt.sim.raidHistory.filter((r) => r.result === 'wipe');
    expect(wipes.length).toBeGreaterThanOrEqual(1);
    expect(w.rt.sim.raidHistory.some((r) => r.result === 'win')).toBe(false);
    expect(clan.raidWipes).toBe(wipes.length);
    expect(clan.drama).toBeGreaterThan(0);
    expect(w.clans.lairStats(w.lair.id).wipes).toBeGreaterThanOrEqual(1);
  });
});

describe('clans', () => {
  it('players found and join clans on their own and bond with clan mates', () => {
    const w = world();
    for (let i = 0; i < 60; i++) { const p = w.players.join()!; p.level = 5 + (i % 6); p.sessionLeft = 99999; }
    for (let h = 0; h < 6; h++) w.clans.hourly();
    const clans = w.clans.clans();
    expect(clans.length).toBeGreaterThan(0);
    const members = w.rt.sim.players.filter((p) => p.clanId);
    expect(members.length).toBeGreaterThan(3);
    for (const c of clans) {
      expect(c.members).toContain(c.leaderId);
      expect(c.tag.length).toBeGreaterThanOrEqual(2);
      for (const id of c.members) expect(w.players.get(id)!.clanId).toBe(c.id);
    }
    expect(members.some((p) => (p.factors.clan ?? 0) > 0)).toBe(true);
  });

  it('too much drama splits a big clan; a small one falls apart', () => {
    const w = world();
    const ps = Array.from({ length: 14 }, () => { const p = w.players.join()!; p.level = 6; p.sessionLeft = 99999; return p; });
    const big = w.clans.found(ps[0]);
    for (const p of ps.slice(1, 12)) w.clans.join(p, big);
    const small = w.clans.found(ps[12]);
    w.clans.join(ps[13], small);
    big.drama = 95;
    small.drama = 95;
    let splits = 0;
    w.clans.events.on('split', () => splits++);
    w.clans.hourly();
    expect(w.clans.get(small.id)).toBeUndefined();
    expect(ps[12].clanId).not.toBe(small.id);
    if (w.clans.get(big.id)) {
      expect(splits).toBe(1);
      expect(big.drama).toBeLessThan(80);
    }
    expect(ps.slice(0, 12).some((p) => (p.factors.drama ?? 0) < 0)).toBe(true);
  });

  it('a quitting leader hands the clan to the next member; an empty clan disbands', () => {
    const w = world();
    const [a, b] = [w.players.join()!, w.players.join()!];
    a.level = 3; b.level = 9;
    const clan = w.clans.found(a);
    w.clans.join(b, clan);
    w.clans.leave(a);
    expect(clan.leaderId).toBe(b.id);
    w.clans.leave(b);
    expect(w.clans.get(clan.id)).toBeUndefined();
  });
});

describe('save format', () => {
  it('migrates v6 saves to v7 with empty clans, raids and lair stats', () => {
    const save = createWorldSave({ name: 'Old', width: 32, height: 32, worldType: 'continent', difficulty: 'normal', seed: 1, startingGold: 100, initialNpcCount: 0, initialPlayerCount: 0, gameMode: 'sandbox' });
    const old = structuredClone(save) as unknown as { schemaVersion: number; sim: Record<string, unknown> };
    old.schemaVersion = 6;
    delete old.sim.clans; delete old.sim.raids; delete old.sim.raidHistory; delete old.sim.lairStats;
    const m = migrate(old as never);
    expect(m.schemaVersion).toBe(WORLD_SCHEMA_VERSION);
    expect(m.sim.clans).toEqual([]);
    expect(m.sim.raids).toEqual([]);
    expect(m.sim.raidHistory).toEqual([]);
    expect(m.sim.lairStats).toEqual({});
  });
});

describe('performance', () => {
  it('runs 300 online players comfortably (< 5 ms per tick)', () => {
    const w = buildWorld({ size: 160, npcs: 60 });
    const fill = () => { while (w.players.online().length < 300 && w.players.join()); };
    fill();
    for (let i = 0; i < 100; i++) w.engine.step();
    const t0 = performance.now();
    for (let i = 0; i < 400; i++) { if (i % 50 === 0) fill(); w.engine.step(); }
    const ms = (performance.now() - t0) / 400;
    expect(w.players.online().length).toBeGreaterThan(250);
    // Shared CI runners are several times slower than a desktop; keep a generous ceiling there.
    expect(ms).toBeLessThan(process.env.CI ? 25 : 5);
  });
});
