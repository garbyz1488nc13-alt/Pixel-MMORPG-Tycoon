import { describe, expect, it } from 'vitest';
import { buildWorld } from './bench';
import { EntityEditor } from '@/systems/editor/EntityEditor';
import { History } from '@/systems/editor/History';
import { autoRewards } from '@/systems/rpg/questRewards';
import type { QuestDef } from '@/models/rpg';

describe('meetups', () => {
  it('players gather at a spot, talk, and settle something', () => {
    const w = buildWorld({ size: 128, npcs: 30, seed: 3 });
    w.players.seedInitial(40);
    for (let i = 0; i < 60; i++) w.engine.step();
    let ended = 0;
    let m: ReturnType<typeof w.meetups.start> = null;
    w.meetups.events.on('ended', ({ meetup }) => { if (meetup.id === m?.id) ended++; });
    for (let k = 0; k < 40 && !m; k++) { m = w.meetups.start(true); if (!m) w.engine.step(); }
    expect(m).toBeTruthy();
    expect(m!.members.length).toBeGreaterThanOrEqual(3);
    for (const id of m!.members) expect(w.ps.activityOf(id)?.kind).toBe('meetup');
    const said0 = w.chat.said;
    for (let i = 0; i < 600 && !ended; i++) w.engine.step();
    expect(ended).toBe(1);
    expect(w.chat.said).toBeGreaterThan(said0);
    // Released afterwards.
    for (const id of m!.members) { const act = w.ps.activityOf(id); expect(act?.kind === 'meetup' && act.meetupId === m!.id).toBe(false); }
  });
});

describe('auto quest rewards', () => {
  it('prices quests by the work they take and recalculates all in one undo step', () => {
    const w = buildWorld({ size: 128, npcs: 30, seed: 3 });
    const tpl = w.rt.entities.list('creatureTemplates').find((c) => !c.boss)!;
    const base: QuestDef = { id: 'q', name: 'q', description: '', giverId: null, requiredLevel: 1, objectives: [{ id: 'o', type: 'kill', targetId: tpl.id, count: 5 }], rewards: { xp: 1, currency: 1, items: [] }, prerequisiteId: null, repeatable: false };
    const small = autoRewards(base, w.rt);
    const big = autoRewards({ ...base, objectives: [{ ...base.objectives[0], count: 20 }] }, w.rt);
    expect(big.xp).toBeGreaterThan(small.xp);
    expect(big.currency).toBeGreaterThan(small.currency);
    const history = new History(20, () => undefined);
    const ed = new EntityEditor(() => w.rt, history);
    const before = w.rt.entities.list('quests').map((q) => q.rewards.xp);
    ed.recalcQuestRewards();
    expect(w.rt.entities.list('quests').every((q) => q.autoRewards)).toBe(true);
    history.undo(w.rt);
    expect(w.rt.entities.list('quests').map((q) => q.rewards.xp)).toEqual(before);
  });
});

describe('quest giver statistics', () => {
  it('counts quests taken and completed', () => {
    const w = buildWorld({ size: 128, npcs: 30, seed: 3 });
    w.players.seedInitial(30);
    for (let i = 0; i < 4 * 60 * 6; i++) w.engine.step();
    const stats = Object.values(w.rt.sim.questStats ?? {});
    expect(stats.reduce((n, s) => n + s.taken, 0)).toBeGreaterThan(0);
    expect(stats.reduce((n, s) => n + s.done, 0)).toBeGreaterThan(0);
  }, 60000);
});

describe('clans and fishing', () => {
  it('clans come in different styles', () => {
    const w = buildWorld({ size: 96, npcs: 10, seed: 3 });
    const styles = new Set<string>();
    for (let i = 0; i < 30; i++) { const p = w.players.join()!; p.behavior = 'casual'; styles.add(w.clans.found(p).style); }
    expect(styles.size).toBeGreaterThan(1);
  });

  it('players go fishing when there is water nearby', () => {
    const w = buildWorld({ size: 128, npcs: 30, seed: 3 });
    w.players.seedInitial(40);
    let fishing = 0;
    for (let i = 0; i < 4 * 60 * 24 && !fishing; i++) { w.engine.step(); if (i % 20 === 0) for (const p of w.players.online()) { const a = w.ps.activityOf(p.id); if (a?.kind === 'leisure' && a.action === 'fish' && a.ticks > 0) fishing++; } }
    expect(fishing).toBeGreaterThan(0);
  }, 60000);
});
