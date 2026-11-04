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
import { createWorldSave } from '@/systems/generation/createWorld';
import { generateStarterContent } from '@/systems/generation/Populate';
import { migrate } from '@/persistence/serializer';

function build(seed = 777) {
  const save = createWorldSave({ name: 'P5', width: 96, height: 96, worldType: 'continent', difficulty: 'normal', seed: 21, startingGold: 10000, initialNpcCount: 20, initialPlayerCount: 0, gameMode: 'sandbox' });
  const rt = new WorldRuntime(save);
  generateStarterContent(rt, 20, 21);
  const actors = new ActorManager(rt, seed);
  const econ = new EconomyService(rt, actors);
  actors.errandHandler = (a) => econ.completeErrand(a);
  const studio = new StudioService(rt);
  const players = new PlayerManager(rt, actors, econ);
  const community = new CommunityService(rt, actors, players);
  const engine = new SimulationEngine(rt);
  engine.addSystem(new ClockSystem(engine.events));
  engine.addSystem(new NpcSystem(actors));
  engine.addSystem(new CreatureSystem(actors));
  engine.addSystem(new EconomySystem(econ, actors));
  engine.addSystem(new PlayerSystem(actors, players, new PlayerBrain(rt, actors, players, econ), econ, () => rt));
  engine.addSystem(new HourlySystem(players, studio, () => undefined, community));
  return { rt, actors, players, community, engine };
}

describe('reviews & rating', () => {
  it('writes reviews from what players felt and averages them', () => {
    const w = build();
    const p = w.players.join()!;
    p.satisfaction = 10;
    w.players.feel(p, 'crowded', 5);
    const r = w.community.composeReview(p);
    expect(r.stars).toBe(1);
    expect(r.reason).toBe('crowded');
    expect(r.lines.length).toBeGreaterThanOrEqual(2);
    w.community.addReview(r);
    w.community.addReview({ ...r, id: 'b', stars: 5, weight: 1 });
    expect(w.rt.sim.rating).toBeGreaterThan(1);
    expect(w.rt.sim.rating).toBeLessThan(5);
    // A happy streamer counts triple.
    w.community.addReview({ ...r, id: 'c', stars: 5, weight: 3, streamer: true });
    expect(w.rt.sim.rating).toBeGreaterThan(3);
  });
});

describe('bans', () => {
  it('banning a cheater pleases the community, banning an innocent backfires', () => {
    const w = build();
    const cheater = w.players.join()!;
    cheater.cheat = 'speed';
    cheater.reports = 5;
    const honest = w.players.join()!;
    const pop0 = w.rt.sim.popularity;
    w.community.ban(cheater.id);
    expect(w.players.get(cheater.id)).toBeUndefined();
    expect(w.rt.sim.bans.cheaters).toBe(1);
    expect(w.rt.sim.popularity).toBeGreaterThan(pop0);
    expect(honest.factors.justice).toBeGreaterThan(0);
    const pop1 = w.rt.sim.popularity;
    w.community.ban(honest.id);
    expect(w.rt.sim.bans.innocent).toBe(1);
    expect(w.rt.sim.popularity).toBeLessThan(pop1);
    expect(w.rt.sim.reviews.at(-1)!.stars).toBe(1);
    expect([...w.actors.actors.values()].some((a) => a.defId === honest.id)).toBe(false);
  });
});

describe('cheaters', () => {
  it('hurt nearby players, get reported, and cheat the economy', () => {
    const w = build();
    const c = w.players.join()!;
    c.cheat = 'gold';
    const victims = [w.players.join()!, w.players.join()!];
    // Put everyone on the same spot.
    const a = w.actors.actors.get(c.id)!;
    for (const v of victims) { const va = w.actors.actors.get(v.id)!; w.actors.teleport(va, Math.floor(a.x), Math.floor(a.y)); }
    const gold0 = c.gold;
    for (let i = 0; i < 10; i++) w.community.hourly();
    expect(c.gold).toBeGreaterThanOrEqual(gold0 + 800);
    expect(c.reports).toBeGreaterThan(0);
    expect(victims.every((v) => (v.factors.cheaters ?? 0) < 0)).toBe(true);
    expect(w.community.suspicion(c)).toBeGreaterThan(w.community.suspicion(victims[0]));
  });

  it('kernel anti-cheat catches cheaters on its own', () => {
    const w = build();
    const c = w.players.join()!;
    c.cheat = 'damage';
    w.rt.sim.antiCheat = 3;
    for (let i = 0; i < 30 && w.players.get(c.id); i++) w.community.hourly();
    expect(w.players.get(c.id)).toBeUndefined();
    expect(w.rt.sim.bans.auto).toBeGreaterThanOrEqual(1);
  });

  it('damage and speed hacks change combat stats', () => {
    const w = build();
    const p = w.players.join()!;
    const a = w.actors.actors.get(p.id)!;
    const base = w.actors.playerStats!(a)!;
    p.cheat = 'damage';
    expect(w.actors.playerStats!(a)!.damage).toBe(base.damage * 3);
    p.cheat = 'speed';
    expect(w.actors.playerStats!(a)!.speed).toBeCloseTo(base.speed * 2.5);
  });
});

describe('streamers', () => {
  it('happy streams bring players, bored streams cost popularity', () => {
    const w = build();
    const s = w.players.join()!;
    s.streamer = { viewers: 5000, streamedMinutes: 0 };
    s.satisfaction = 95;
    const carry0 = w.rt.sim.arrivalCarry;
    const pop0 = w.rt.sim.popularity;
    w.community.hourly();
    expect(w.rt.sim.arrivalCarry).toBeGreaterThan(carry0 + 3);
    expect(w.rt.sim.popularity).toBeGreaterThan(pop0);
    s.satisfaction = 5;
    const pop1 = w.rt.sim.popularity;
    w.community.hourly();
    expect(w.rt.sim.popularity).toBeLessThan(pop1);
  });
});

describe('long run', () => {
  it('produces reviews and a rating from real play', () => {
    const w = build();
    w.players.seedInitial(25);
    for (let i = 0; i < 9000; i++) w.engine.step(); // ~37 game hours
    const sim = w.rt.sim;
    console.log({ reviews: sim.reviews.length, rating: sim.rating, popularity: Math.round(sim.popularity), cheaters: sim.players.filter((p) => p.cheat).length, streamers: sim.players.filter((p) => p.streamer).length, history: sim.ratingHistory });
    expect(sim.reviews.length).toBeGreaterThan(3);
    expect(sim.rating).toBeGreaterThanOrEqual(1);
    expect(sim.rating).toBeLessThanOrEqual(5);
  });
});

describe('save migration v4 → v5', () => {
  it('adds community state', () => {
    const s = createWorldSave({ name: 'M', width: 32, height: 32, worldType: 'flat', difficulty: 'normal', seed: 1, startingGold: 0, initialNpcCount: 0, initialPlayerCount: 0 }) as any;
    s.schemaVersion = 4;
    delete s.sim.reviews; delete s.sim.rating; delete s.sim.bans; delete s.sim.antiCheat; delete s.sim.ratingHistory;
    s.sim.players = [{ id: 'p', name: 'Old' }];
    const m = migrate(s);
    expect(m.schemaVersion).toBe(5);
    expect(m.sim.reviews).toEqual([]);
    expect(m.sim.bans.cheaters).toBe(0);
    expect(m.sim.players[0].reports).toBe(0);
  });
});
