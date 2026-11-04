import { describe, expect, it } from 'vitest';
import { WorldRuntime } from '@/simulation/WorldRuntime';
import { SimulationEngine } from '@/simulation/SimulationEngine';
import { ClockSystem } from '@/simulation/systems/ClockSystem';
import { NpcSystem } from '@/simulation/systems/NpcSystem';
import { CreatureSystem } from '@/simulation/systems/CreatureSystem';
import { EconomySystem } from '@/simulation/systems/EconomySystem';
import { PlayerSystem } from '@/simulation/systems/PlayerSystem';
import { HourlySystem } from '@/simulation/systems/HourlySystem';
import { ActorManager } from '@/simulation/actors/ActorManager';
import { EconomyService } from '@/simulation/economy/EconomyService';
import { PlayerManager } from '@/simulation/players/PlayerManager';
import { PlayerBrain } from '@/simulation/players/PlayerBrain';
import { StudioService } from '@/simulation/studio/StudioService';
import { CommunityService } from '@/simulation/community/CommunityService';
import { AnalyticsService } from '@/simulation/analytics/AnalyticsService';
import { EventService } from '@/simulation/events/EventService';
import { createWorldSave } from '@/systems/generation/createWorld';
import { generateStarterContent } from '@/systems/generation/Populate';
import { migrate } from '@/persistence/serializer';
import { WORLD_SCHEMA_VERSION } from '@/models/world';
import type { EventDef } from '@/models/events';

function build(mode: 'sandbox' | 'standard' = 'sandbox', seed = 99) {
  const save = createWorldSave({ name: 'P6', width: 96, height: 96, worldType: 'continent', difficulty: 'normal', seed: 21, startingGold: 10000, initialNpcCount: 20, initialPlayerCount: 0, gameMode: mode });
  const rt = new WorldRuntime(save);
  generateStarterContent(rt, 20, 21);
  for (const ev of EventService.starterEvents(rt)) rt.entities.add('events', ev);
  const actors = new ActorManager(rt, seed);
  const econ = new EconomyService(rt, actors);
  actors.errandHandler = (a) => econ.completeErrand(a);
  const studio = new StudioService(rt);
  const players = new PlayerManager(rt, actors, econ);
  const community = new CommunityService(rt, actors, players);
  const analytics = new AnalyticsService(rt, actors, players, econ);
  const events = new EventService(rt, actors, players, studio);
  const brain = new PlayerBrain(rt, actors, players, econ);
  brain.events = events;
  players.xpMultiplier = () => events.xpMultiplier();
  const ps = new PlayerSystem(actors, players, brain, econ, () => rt);
  ps.eventKill = (areaId, killer) => events.onEventKill(areaId, killer);
  const engine = new SimulationEngine(rt);
  engine.addSystem(new ClockSystem(engine.events));
  engine.addSystem(new NpcSystem(actors));
  engine.addSystem(new CreatureSystem(actors));
  engine.addSystem(new EconomySystem(econ, actors));
  engine.addSystem(ps);
  engine.addSystem(new HourlySystem(players, studio, () => undefined, community, analytics, events));
  return { rt, actors, players, events, analytics, engine, studio };
}

const byType = (rt: WorldRuntime, type: EventDef['type']) => rt.entities.list('events').find((e) => e.type === type)!;

describe('world events', () => {
  it('starter events exist for each kind of trigger', () => {
    const w = build();
    const kinds = new Set(w.rt.entities.list('events').map((e) => e.trigger.kind));
    expect(kinds).toEqual(new Set(['manual', 'schedule', 'condition']));
  });

  it('an invasion spawns monsters near town, players fight them, and everything is cleaned up', () => {
    const w = build();
    w.players.seedInitial(15);
    const def = byType(w.rt, 'invasion');
    const active = w.events.start(def.id)!;
    expect(active).toBeTruthy();
    expect(active.spawnAreaIds).toHaveLength(1);
    const areaId = active.spawnAreaIds[0];
    expect([...w.actors.actors.values()].filter((a) => a.spawnAreaId === areaId).length).toBe(def.count);
    for (let i = 0; i < 1200 && active.kills === 0; i++) w.engine.step();
    expect(active.kills).toBeGreaterThan(0);
    const rec = w.events.end(active.id)!;
    expect(rec.kills).toBeGreaterThan(0);
    expect(w.rt.entities.get('spawnAreas', areaId)).toBeUndefined();
    expect([...w.actors.actors.values()].some((a) => a.spawnAreaId === areaId)).toBe(false);
    expect(w.rt.sim.eventHistory).toHaveLength(1);
  });

  it('double XP multiplies experience', () => {
    const w = build();
    const p = w.players.join()!;
    w.players.gainXp(p, 10);
    const base = p.xp;
    w.events.start(byType(w.rt, 'doubleXp').id);
    w.players.gainXp(p, 10);
    expect(p.xp - base).toBe(20);
  });

  it('a rare merchant appears with rare goods and leaves', () => {
    const w = build();
    const a = w.events.start(byType(w.rt, 'rareMerchant').id)!;
    const npc = w.rt.entities.get('npcs', a.npcIds[0])!;
    expect(npc.shop.items.length).toBeGreaterThan(0);
    expect(npc.shop.items.every((s) => ['rare', 'epic', 'legendary'].includes(w.rt.entities.get('items', s.itemId)!.rarity))).toBe(true);
    w.events.end(a.id);
    expect(w.rt.entities.get('npcs', npc.id)).toBeUndefined();
  });

  it('schedule and condition triggers start events on their own and respect cooldowns', () => {
    const w = build();
    const fest = byType(w.rt, 'festival');
    w.rt.entities.update('events', fest.id, { trigger: { ...fest.trigger, metric: 'popularity', op: '<', value: 99, cooldownHours: 1000 } });
    const dx = byType(w.rt, 'doubleXp');
    w.rt.entities.update('events', dx.id, { trigger: { ...dx.trigger, everyDays: 1, hour: 10, cooldownHours: 1 } });
    const started: string[] = [];
    w.events.events.on('started', ({ active }) => started.push(active.type));
    for (let i = 0; i < 24 * 240 * 2; i++) w.engine.step(); // 2 days
    expect(started.filter((s) => s === 'festival')).toHaveLength(1); // cooldown holds
    expect(started.filter((s) => s === 'doubleXp').length).toBeGreaterThanOrEqual(2); // daily at 10:00
  });

  it('events cost money in standard mode and are refused when broke', () => {
    const w = build('standard');
    const def = byType(w.rt, 'festival');
    const f0 = w.rt.studio.funds;
    expect(w.events.start(def.id)).toBeTruthy();
    expect(w.rt.studio.funds).toBe(f0 - 500);
    w.rt.studio.funds = 10;
    expect(w.events.problem(byType(w.rt, 'doubleXp'))).toMatch(/Not enough money/);
  });

  it('a faction war makes players fight each other in the region', () => {
    const w = build();
    const region = w.rt.entities.list('regions').find((r) => r.type === 'wilderness' || r.type === 'forest')!;
    const def: EventDef = { ...byType(w.rt, 'festival'), id: 'war', name: 'War', type: 'factionWar', regionId: region.id, durationHours: 12, trigger: { ...byType(w.rt, 'festival').trigger, kind: 'manual' } };
    w.rt.entities.add('events', def);
    // Only fighters/PvP players, teleported into the war zone.
    for (let i = 0; i < 16; i++) {
      const p = w.players.join()!;
      p.behavior = i % 2 ? 'fighter' : 'pvp';
      const a = w.actors.actors.get(p.id)!;
      const spot = w.actors.randomTileInArea({ ...region, templateId: '', maxCount: 0 })!;
      w.actors.teleport(a, spot.x, spot.y);
    }
    w.events.start('war');
    const pvp0 = w.rt.sim.players.reduce((n, p) => n + p.stats.pvpKills, 0);
    for (let i = 0; i < 2400; i++) w.engine.step();
    const pvp1 = w.rt.sim.players.reduce((n, p) => n + p.stats.pvpKills, 0) + w.rt.sim.totals.pvpKills;
    expect(pvp1).toBeGreaterThan(pvp0);
  });
});

describe('analytics', () => {
  it('records hourly samples, lifetime totals and region visits', () => {
    const w = build();
    w.players.seedInitial(20);
    for (let i = 0; i < 240 * 10; i++) w.engine.step(); // 10 hours
    const sim = w.rt.sim;
    expect(sim.history.length).toBeGreaterThanOrEqual(9);
    expect(sim.history.at(-1)!.online).toBeGreaterThan(0);
    expect(sim.totals.kills).toBeGreaterThan(0);
    expect(sim.totals.kills).toBe(sim.history.reduce((n, h) => n + h.kills, 0));
    expect(Object.keys(sim.regionVisits).length).toBeGreaterThan(0);
  });
});

describe('save migration v5 → v6', () => {
  it('adds analytics & events', () => {
    const s = createWorldSave({ name: 'M', width: 32, height: 32, worldType: 'flat', difficulty: 'normal', seed: 1, startingGold: 0, initialNpcCount: 0, initialPlayerCount: 0 }) as any;
    s.schemaVersion = 5;
    delete s.sim.history; delete s.sim.totals; delete s.sim.activeEvents; delete s.entities.events;
    const m = migrate(s);
    expect(m.schemaVersion).toBe(WORLD_SCHEMA_VERSION);
    expect(m.sim.history).toEqual([]);
    expect(m.sim.totals.kills).toBe(0);
    expect(m.entities.events).toEqual([]);
  });
});
