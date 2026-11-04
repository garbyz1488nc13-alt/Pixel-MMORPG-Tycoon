import { describe, expect, it } from 'vitest';
import { buildWorld } from './bench';
import { createWorldSave } from '@/systems/generation/createWorld';
import { migrate } from '@/persistence/serializer';
import { WORLD_SCHEMA_VERSION } from '@/models/world';
import type { ShopModel } from '@/models/sim';
import { EntityEditor } from '@/systems/editor/EntityEditor';
import { History } from '@/systems/editor/History';
import { QUEST_TEMPLATES, questPack, questsFromTemplate } from '@/systems/rpg/questTemplates';
import { validateQuest } from '@/systems/rpg/quests';

function day(model: ShopModel) {
  const w = buildWorld({ size: 128, npcs: 20, mode: 'standard', seed: 3 });
  w.rt.studio.shopModel = model;
  w.players.seedInitial(30);
  for (let i = 0; i < 4 * 60 * 30; i++) w.engine.step(); // 30 game hours
  const row = w.rt.studio.ledger.find((r) => r.day === 2)!;
  const mood = w.players.online().reduce((n, p) => n + p.satisfaction, 0) / w.players.online().length;
  return { w, row, mood };
}

describe('studio economy', () => {
  it('a small game makes a profit from subscriptions alone', () => {
    const { row } = day('none');
    expect(row.sources?.subs ?? 0).toBeGreaterThan(150);
    expect(row.income).toBeGreaterThan(row.expenses);
  }, 30000);

  it('greedier cash shops earn more but players like them less', () => {
    const cosm = day('cosmetic');
    const p2w = day('p2w');
    expect(cosm.row.sources?.shop ?? 0).toBeGreaterThan(30);
    expect(p2w.row.sources?.shop ?? 0).toBeGreaterThan((cosm.row.sources?.shop ?? 0) * 2);
    expect(p2w.mood).toBeLessThan(cosm.mood);
    expect(p2w.w.players.online().some((p) => (p.factors.p2w ?? 0) < 0)).toBe(true);
  }, 30000);

  it('migrates v7 saves: monthly price becomes daily, cosmetic shop', () => {
    const save = createWorldSave({ name: 'Old', width: 32, height: 32, worldType: 'continent', difficulty: 'normal', seed: 1, startingGold: 100, initialNpcCount: 0, initialPlayerCount: 0, gameMode: 'standard' });
    const old = structuredClone(save) as unknown as { schemaVersion: number; studio: Record<string, unknown> };
    old.schemaVersion = 7;
    old.studio.subscriptionPrice = 10;
    delete old.studio.shopModel;
    const m = migrate(old as never);
    expect(m.schemaVersion).toBe(WORLD_SCHEMA_VERSION);
    expect(m.studio.subscriptionPrice).toBe(3);
    expect(m.studio.shopModel).toBe('cosmetic');
  });
});

describe('quest templates', () => {
  it('every template builds valid quests from this world (or explains why not)', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    const ed = new EntityEditor(() => w.rt, new History(50, () => undefined));
    const sp = w.players.spawnPoint();
    ed.addLair('goblin_king', sp.x + 12, sp.y);
    for (const tpl of QUEST_TEMPLATES) {
      const res = questsFromTemplate(w.rt, tpl.key, 5);
      expect(res.quests.length || res.error, tpl.key).toBeTruthy();
      for (const q of res.quests) {
        // A chain's earlier quests are not in the world yet (they are added together).
        const inBatch = res.quests.some((x) => x.id === q.prerequisiteId);
        const errors = validateQuest(q, w.rt.entities, w.rt.rpg).filter((i) => i.level === 'error' && !(inBatch && i.text.includes('previous quest')));
        expect(errors, `${tpl.key}: ${errors.map((e) => e.text).join(', ')}`).toEqual([]);
        expect(q.rewards.xp).toBeGreaterThan(0);
      }
    }
    expect(questsFromTemplate(w.rt, 'raid', 5).quests[0].objectives[0].type).toBe('boss');
    const chain = questsFromTemplate(w.rt, 'chain', 3).quests;
    expect(chain.length).toBeGreaterThanOrEqual(2);
    expect(chain[1].prerequisiteId).toBe(chain[0].id);
  });

  it('a quest pack adds several quests in one undo step and players take them', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    const history = new History(50, () => undefined);
    const ed = new EntityEditor(() => w.rt, history);
    const before = w.rt.entities.count('quests');
    const pack = questPack(w.rt, 2);
    expect(pack.quests.length).toBeGreaterThanOrEqual(4);
    ed.addQuests(pack.quests, 'pack');
    expect(w.rt.entities.count('quests')).toBe(before + pack.quests.length);
    w.players.seedInitial(20);
    for (let i = 0; i < 4 * 60 * 6; i++) w.engine.step();
    const ids = new Set(pack.quests.map((q) => q.id));
    const taken = w.rt.sim.players.some((p) => p.quests.some((q) => ids.has(q.questId)) || p.completedQuests.some((id) => ids.has(id)));
    expect(taken).toBe(true);
    history.undo(w.rt);
    expect(w.rt.entities.count('quests')).toBe(before);
  }, 30000);

  it('explains what is missing in an empty world', () => {
    const w = buildWorld({ size: 64, npcs: 0, seed: 1 });
    for (const q of w.rt.entities.list('quests')) w.rt.entities.remove('quests', q.id);
    for (const n of w.rt.entities.list('npcs')) w.rt.entities.remove('npcs', n.id);
    expect(questsFromTemplate(w.rt, 'hunt', 1).error).toBeTruthy();
  });
});
