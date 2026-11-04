import { describe, expect, it } from 'vitest';
import { WorldRuntime } from '@/simulation/WorldRuntime';
import { SimulationEngine } from '@/simulation/SimulationEngine';
import { ClockSystem } from '@/simulation/systems/ClockSystem';
import { NpcSystem } from '@/simulation/systems/NpcSystem';
import { CreatureSystem } from '@/simulation/systems/CreatureSystem';
import { EconomySystem } from '@/simulation/systems/EconomySystem';
import { ActorManager } from '@/simulation/actors/ActorManager';
import { EconomyService } from '@/simulation/economy/EconomyService';
import { History } from '@/systems/editor/History';
import { EntityEditor } from '@/systems/editor/EntityEditor';
import { createWorldSave } from '@/systems/generation/createWorld';
import { addItem, countItem, removeItem } from '@/systems/rpg/inventory';
import { buyPrice, demandFactor, sellPrice } from '@/systems/rpg/pricing';
import { rollLoot } from '@/systems/rpg/loot';
import { characterStats, levelForXp, totalXpFor, xpToNext } from '@/systems/rpg/progression';
import { QuestTracker, validateQuest } from '@/systems/rpg/quests';
import { migrate } from '@/persistence/serializer';
import { WORLD_SCHEMA_VERSION } from '@/models/world';
import { itemKeyIndex } from '@/data/rpgDefaults';
import type { QuestDef } from '@/models/rpg';

const opts = { name: 'T', width: 48, height: 48, worldType: 'flat' as const, difficulty: 'normal' as const, seed: 3, startingGold: 5000, initialNpcCount: 0, initialPlayerCount: 0 };

function setup() {
  const rt = new WorldRuntime(createWorldSave(opts));
  const history = new History();
  const ed = new EntityEditor(() => rt, history);
  const actors = new ActorManager(rt);
  const econ = new EconomyService(rt, actors);
  actors.errandHandler = (a) => econ.completeErrand(a);
  const engine = new SimulationEngine(rt);
  engine.addSystem(new ClockSystem(engine.events));
  engine.addSystem(new NpcSystem(actors));
  engine.addSystem(new CreatureSystem(actors));
  engine.addSystem(new EconomySystem(econ, actors));
  const key = itemKeyIndex(rt.entities.list('items'));
  return { rt, ed, actors, econ, engine, key, item: (k: string) => rt.entities.get('items', key.get(k)!)! };
}

describe('inventory', () => {
  it('stacks up to stack size and spills into new slots', () => {
    const { rt, key } = setup();
    const lookup = (id: string) => rt.entities.get('items', id);
    const potion = key.get('health_potion')!; // stack 20
    const r = addItem([], potion, 45, lookup);
    expect(r.inv.map((s) => s.qty)).toEqual([20, 20, 5]);
    expect(countItem(r.inv, potion)).toBe(45);
    const sword = key.get('iron_sword')!; // stack 1
    const full = addItem([], sword, 30, lookup, 24);
    expect(full.leftover).toBe(6);
    const rem = removeItem(r.inv, potion, 25);
    expect(rem.removed).toBe(25);
    expect(countItem(rem.inv, potion)).toBe(20);
  });
});

describe('pricing', () => {
  it('scarce stock raises prices, surplus lowers them, within floor/ceiling', () => {
    const { rt, item } = setup();
    const eco = rt.rpg.economy;
    const bread = item('bread');
    const balanced = sellPrice(bread, { itemId: bread.id, stock: 10, maxStock: 10 }, eco);
    const empty = sellPrice(bread, { itemId: bread.id, stock: 0, maxStock: 10 }, eco);
    const glut = sellPrice(bread, { itemId: bread.id, stock: 30, maxStock: 10 }, eco);
    expect(empty).toBeGreaterThan(balanced);
    expect(glut).toBeLessThan(balanced);
    expect(demandFactor({ stock: -100, maxStock: 1 }, eco)).toBe(eco.priceCeiling);
    expect(buyPrice(bread, null, eco)).toBeLessThan(sellPrice(bread, null, eco));
  });
});

describe('loot & progression', () => {
  it('rolls loot by chance', () => {
    let i = 0;
    const seq = [0.1, 0.0, 0.99];
    const drops = rollLoot([{ itemId: 'a', chance: 50, min: 1, max: 3 }, { itemId: 'b', chance: 50, min: 1, max: 1 }], () => seq[i++ % seq.length]);
    expect(drops).toEqual([{ itemId: 'a', qty: 1 }]);
  });

  it('computes XP curve and stats with equipment level requirements', () => {
    const { rt, item } = setup();
    const p = rt.rpg.progression;
    expect(xpToNext(1, p)).toBe(100);
    expect(xpToNext(4, p)).toBe(800);
    expect(levelForXp(totalXpFor(10, p), p)).toBe(10);
    const warrior = p.classes.find((c) => c.key === 'warrior')!;
    const bare = characterStats(warrior, 10, p);
    const armed = characterStats(warrior, 10, p, [item('iron_sword'), item('plate_armor')]);
    expect(armed.attack).toBe(bare.attack + 10 + Math.round(1 * p.attackPerPrimary)); // sword +10 atk, +1 STR; plate needs Lv 20
    expect(armed.defense).toBe(bare.defense);
    expect(armed.maxHp).toBeGreaterThan(p.baseHp);
  });
});

describe('quests', () => {
  it('validates targets and tracks progress through a chain', () => {
    const { rt, ed, item } = setup();
    const giver = ed.addNpc('questgiver', 10, 10)!;
    const slime = ed.addTemplate('slime');
    const q1: QuestDef = { id: 'q1', name: 'Slimes', description: '', giverId: giver.id, requiredLevel: 1, objectives: [{ id: 'o1', type: 'kill', targetId: slime.id, count: 2 }], rewards: { xp: 50, currency: 10, items: [] }, prerequisiteId: null, repeatable: false };
    rt.entities.add('quests', q1);
    expect(validateQuest(q1, rt.entities, rt.rpg).some((i) => i.text.includes('no spawn area'))).toBe(true);
    ed.addSpawnArea(slime.id, { x: 20, y: 20, w: 4, h: 4 });
    expect(validateQuest(q1, rt.entities, rt.rpg)).toEqual([]);

    const gel = item('slime_gel');
    const q2: QuestDef = { ...q1, id: 'q2', prerequisiteId: 'q1', objectives: [{ id: 'o2', type: 'collect', targetId: gel.id, count: 3 }] };
    rt.entities.add('quests', q2);
    const loop = { ...q1, prerequisiteId: 'q2' };
    rt.entities.update('quests', 'q1', loop);
    expect(validateQuest(loop, rt.entities, rt.rpg).some((i) => i.text.includes('loops'))).toBe(true);
    rt.entities.update('quests', 'q1', { prerequisiteId: null });

    const tracker = new QuestTracker((id) => rt.entities.get('quests', id));
    expect(tracker.accept(q2, 5)).toBe(false); // chain locked
    expect(tracker.accept(rt.entities.get('quests', 'q1')!, 1)).toBe(true);
    tracker.handle({ type: 'kill', templateId: slime.id });
    expect(tracker.handle({ type: 'kill', templateId: slime.id })).toEqual(['q1']);
    expect(tracker.turnIn('q1')?.xp).toBe(50);
    expect(tracker.accept(q2, 5)).toBe(true);
    tracker.handle({ type: 'collect', itemId: gel.id, qty: 5 });
    expect(tracker.progress.get('q2')!.counts).toEqual([3]);
  });
});

describe('economy simulation', () => {
  it('trades conserve money: purse changes equal tax paid to the treasury', () => {
    const { rt, ed, econ, item } = setup();
    const merchant = ed.addNpc('merchant', 10, 10)!;
    const villager = ed.addNpc('villager', 12, 10)!;
    const bread = item('bread');
    rt.entities.update('npcs', villager.id, { gold: 100 });
    const total0 = econ.moneySupply();
    const bought = econ.buyFromMerchant(villager.id, merchant.id, bread.id, 3);
    expect(bought).toBe(3);
    expect(countItem(rt.entities.get('npcs', villager.id)!.inventory, bread.id)).toBe(3);
    expect(econ.moneySupply()).toBe(total0); // tax moved from purses to treasury, nothing created
    expect(econ.totals.taxes).toBeGreaterThan(0);
    const got = econ.sellToMerchant(villager.id, merchant.id, bread.id, 3);
    expect(got).toBeGreaterThan(0);
    expect(econ.moneySupply()).toBe(total0);
  });

  it('farmers harvest wheat and walk to a merchant to sell it', () => {
    const { rt, ed, engine, econ, key } = setup();
    const m = ed.addNpc('merchant', 10, 10)!;
    const f = ed.addNpc('farmer', 30, 30)!;
    rt.entities.update('npcs', f.id, { workStart: 0, workEnd: 24, behavior: 'stationary' });
    rt.entities.update('npcs', m.id, { workStart: 0, workEnd: 24 });
    for (let i = 0; i < 4000 && !econ.trades.some((t) => t.kind === 'sale'); i++) engine.step();
    const sale = econ.trades.find((t) => t.kind === 'sale');
    expect(sale).toBeTruthy();
    expect(sale!.itemId).toBe(key.get('wheat'));
    expect(sale!.actorId).toBe(f.id);
    expect(sale!.total).toBeGreaterThan(0);
  });

  it('merchants restock missing stock with their own gold', () => {
    const { rt, ed, econ } = setup();
    const m = ed.addNpc('merchant', 10, 10)!;
    const entry = rt.entities.get('npcs', m.id)!.shop.items[0];
    rt.entities.update('npcs', m.id, { shop: { enabled: true, items: [{ ...entry, stock: 0 }] } });
    const gold0 = rt.entities.get('npcs', m.id)!.gold;
    for (let i = 0; i < 24; i++) econ.restock(60);
    const after = rt.entities.get('npcs', m.id)!;
    expect(after.shop.items[0].stock).toBeGreaterThan(0);
    expect(after.gold).toBeLessThan(gold0);
  });
});

describe('save migration v2 → v3', () => {
  it('turns item names into ids and adds defaults', () => {
    const s = createWorldSave(opts) as any;
    s.schemaVersion = 2;
    delete s.rpg;
    s.entities.items = [];
    s.entities.npcs = [{ id: 'n1', name: 'Bob', type: 'merchant', level: 1, maxHp: 10, x: 1, y: 1, speed: 1, behavior: 'stationary', wanderRadius: 3, waypoints: [], inventory: [{ name: 'Bread', qty: 2 }, { name: 'Magic Bean', qty: 1 }], shop: { enabled: true, items: [{ name: 'Health Potion', price: 25, stock: 5 }] }, workStart: 0, workEnd: 24, interactionRadius: 2 }];
    s.entities.creatureTemplates = [{ id: 'c1', name: 'Slime', type: 'slime', level: 1, maxHp: 10, damage: 1, defense: 0, speed: 1, aggression: 'passive', aggroRange: 1, attackRange: 1, respawnMinutes: 1, xpReward: 1, loot: [], boss: false }];
    const m = migrate(s);
    expect(m.schemaVersion).toBe(WORLD_SCHEMA_VERSION);
    expect(m.config.gameMode).toBe('sandbox');
    expect(m.sim.players).toEqual([]);
    const items = new Map(m.entities.items.map((i) => [i.id, i.name]));
    const n = m.entities.npcs[0];
    expect(n.inventory.map((x) => items.get(x.itemId))).toEqual(['Bread', 'Magic Bean']);
    expect(items.get(n.shop.items[0].itemId)).toBe('Health Potion');
    expect(n.gold).toBeGreaterThan(0);
    expect(m.entities.creatureTemplates[0].loot.length).toBeGreaterThan(0);
    expect(m.rpg.economy.treasury).toBe(5000);
  });
});

import { generateStarterContent } from '@/systems/generation/Populate';
describe('starter quests', () => {
  it('creates a chain of completable quests', () => {
    const rt = new WorldRuntime(createWorldSave({ ...opts, width: 96, height: 96, worldType: 'continent', seed: 11 }));
    generateStarterContent(rt, 15, 11);
    const quests = rt.entities.list('quests');
    expect(quests.length).toBeGreaterThanOrEqual(4);
    expect(quests.filter((q) => q.prerequisiteId).length).toBeGreaterThanOrEqual(1);
    for (const q of quests) expect(validateQuest(q, rt.entities, rt.rpg).filter((i) => i.level === 'error')).toEqual([]);
  });
});
