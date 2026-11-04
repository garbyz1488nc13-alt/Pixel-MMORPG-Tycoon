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
import { History, EntityCommand } from '@/systems/editor/History';
import { EntityEditor } from '@/systems/editor/EntityEditor';
import { createWorldSave } from '@/systems/generation/createWorld';
import { generateStarterContent, populateRegion, BudgetError } from '@/systems/generation/Populate';
import { migrate } from '@/persistence/serializer';

function build(mode: 'sandbox' | 'standard', npcs = 20) {
  const save = createWorldSave({ name: 'P4', width: 96, height: 96, worldType: 'continent', difficulty: 'normal', seed: 21, startingGold: 10000, initialNpcCount: npcs, initialPlayerCount: 0, gameMode: mode });
  const rt = new WorldRuntime(save);
  if (npcs) generateStarterContent(rt, npcs, 21);
  const history = new History();
  const ed = new EntityEditor(() => rt, history);
  const actors = new ActorManager(rt, 12345);
  const econ = new EconomyService(rt, actors);
  actors.errandHandler = (a) => econ.completeErrand(a);
  const studio = new StudioService(rt);
  if (studio.standard) { ed.budget = studio; EntityCommand.budget = studio; } else EntityCommand.budget = null;
  const players = new PlayerManager(rt, actors, econ);
  const engine = new SimulationEngine(rt);
  engine.addSystem(new ClockSystem(engine.events));
  engine.addSystem(new NpcSystem(actors));
  engine.addSystem(new CreatureSystem(actors));
  engine.addSystem(new EconomySystem(econ, actors));
  const ps = new PlayerSystem(actors, players, new PlayerBrain(rt, actors, players, econ), econ, () => rt);
  engine.addSystem(ps);
  engine.addSystem(new HourlySystem(players, studio, () => undefined));
  return { rt, ed, history, actors, econ, studio, players, engine, ps };
}

describe('virtual players', () => {
  it('play the game: level up, kill monsters, complete quests, trade, come and go', () => {
    const w = build('sandbox');
    expect(w.players.seedInitial(20)).toBe(20);
    const t0 = performance.now();
    for (let i = 0; i < 6000; i++) w.engine.step(); // ~25 game hours
    const ms = performance.now() - t0;
    const all = w.rt.sim.players;
    const kills = all.reduce((n, p) => n + p.stats.kills, 0);
    const quests = all.reduce((n, p) => n + p.stats.questsDone, 0);
    const maxLevel = Math.max(...all.map((p) => p.level));
    const playerTrades = w.econ.trades.filter((t) => all.some((p) => p.id === t.actorId)).length;
    console.log({ ms: Math.round(ms), players: all.length, online: w.players.online().length, joined: w.rt.sim.totalJoined, left: w.rt.sim.totalLeft, kills, quests, maxLevel, playerTrades, popularity: Math.round(w.rt.sim.popularity), avgSat: Math.round(all.reduce((n, p) => n + p.satisfaction, 0) / Math.max(1, all.length)) });
    expect(kills).toBeGreaterThan(20);
    expect(maxLevel).toBeGreaterThanOrEqual(3);
    expect(quests).toBeGreaterThan(0);
    expect(playerTrades).toBeGreaterThan(0);
    expect(w.rt.sim.totalJoined).toBeGreaterThan(20);
    expect(all.every((p) => p.satisfaction >= 0 && p.satisfaction <= 100)).toBe(true);
  });

  it('saves and restores players', () => {
    const w = build('sandbox', 10);
    w.players.seedInitial(5);
    for (let i = 0; i < 300; i++) w.engine.step();
    w.players.flush();
    const save = migrate(JSON.parse(JSON.stringify(w.rt.toSave())));
    const rt2 = new WorldRuntime(save);
    expect(rt2.sim.players.length).toBe(w.rt.sim.players.length);
    const a2 = new ActorManager(rt2);
    const pm2 = new PlayerManager(rt2, a2, new EconomyService(rt2, a2));
    expect([...a2.actors.values()].filter((a) => a.kind === 'player').length).toBe(pm2.online().length);
  });
});

describe('standard mode budget', () => {
  it('charges for building, refuses when broke, refunds on undo and delete', () => {
    const w = build('standard', 0);
    const funds0 = w.rt.studio.funds;
    const house = w.ed.placeObject('house_small', 10, 10)!;
    expect(house).toBeTruthy();
    expect(w.rt.studio.funds).toBe(funds0 - 120 * 4);
    w.history.undo(w.rt);
    expect(w.rt.studio.funds).toBe(funds0);
    w.history.redo(w.rt);
    w.ed.remove('objects', [house.id]);
    expect(w.rt.studio.funds).toBe(funds0 - 480 + 240);
    w.rt.studio.funds = 100;
    let spot = { x: 0, y: 0 };
    for (let y = 5; y < 90 && !spot.x; y++) for (let x = 5; x < 90; x++) if (w.rt.nav.isWalkable(x, y)) { spot = { x, y }; break; }
    expect(w.ed.addNpc('guard', spot.x, spot.y)).toBeNull();
    expect(w.ed.lastError).toMatch(/Not enough money/);
    expect(w.rt.entities.count('npcs')).toBe(0);
  });

  it('enforces server caps and blocks expensive generators', () => {
    const w = build('standard', 0);
    w.rt.studio.funds = 1e9;
    const tpl = w.ed.addTemplate('slime');
    expect(w.ed.addSpawnArea(tpl.id, { x: 10, y: 10, w: 40, h: 40 })).toBeTruthy();
    const area = w.rt.entities.list('spawnAreas')[0];
    w.ed.update('spawnAreas', area.id, { maxCount: 41 });
    expect(w.rt.entities.get('spawnAreas', area.id)!.maxCount).toBeLessThanOrEqual(40);
    expect(w.ed.lastError).toMatch(/Server limit/);
    w.rt.studio.funds = 50;
    const reg = w.ed.addRegion('city', { x: 20, y: 20, w: 40, h: 40 });
    expect(() => populateRegion(w.rt, w.history, reg, 1, undefined, w.studio)).toThrow(BudgetError);
    expect(w.rt.entities.count('npcs')).toBe(0);
  });

  it('earns subscriptions and pays server upkeep hourly', () => {
    const w = build('standard', 0);
    const f0 = w.rt.studio.funds;
    const r = w.studio.hourly(30);
    expect(r.income).toBeCloseTo((30 * 10) / 30 / 24);
    expect(w.rt.studio.funds).toBeCloseTo(f0 + r.income - r.expenses);
  });
});
