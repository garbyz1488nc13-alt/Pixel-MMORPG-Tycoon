import { describe, expect, it } from 'vitest';
import { buildWorld } from './bench';
import { EntityEditor } from '@/systems/editor/EntityEditor';
import { History } from '@/systems/editor/History';
import { attack } from '@/simulation/actors/combat';
import { questsFromTemplate } from '@/systems/rpg/questTemplates';
import { doorTile } from '@/data/furniture';

describe('audit fixes', () => {
  it('players drink mana potions in fights and use buff skills', () => {
    const w = buildWorld({ size: 96, npcs: 10, seed: 3 });
    const p = w.players.join()!;
    p.classKey = 'warrior';
    p.level = 6; p.trainedLevel = 6;
    const pot = w.rt.entities.list('items').find((i) => i.key === 'mana_potion')!;
    w.players.giveItem(p, pot.id, 2);
    const a = w.actors.actors.get(p.id)!;
    const goblin = [...w.actors.actors.values()].find((x) => x.kind === 'creature' && x.state !== 'dead')!;
    p.mana = 1;
    w.actors.teleport(a, Math.floor(goblin.x), Math.floor(goblin.y));
    attack(w.actors, goblin, a);
    a.targetId = goblin.id;
    for (let i = 0; i < 40; i++) { a.hp = a.maxHp; w.engine.step(); }
    expect(w.players.countItem(p, pot.id)).toBeLessThan(2);
    // With mana, War Cry (buff) kicks in during the fight.
    p.mana = 100;
    for (let i = 0; i < 80 && !p.buffUntil; i++) { a.hp = a.maxHp; a.targetId = goblin.id; if (goblin.state === 'dead') break; w.engine.step(); }
    expect(p.buffUntil ?? 0).toBeGreaterThan(0);
  });

  it('bankers keep gold safe and trainers teach new skills', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    const ed = new EntityEditor(() => w.rt, new History(20, () => undefined));
    const sp = w.players.spawnPoint();
    // A banker needs a bank building nearby.
    let bank = null;
    for (let r = 2; r < 30 && !bank; r++) for (let k = 0; k < 8 && !bank; k++) bank = ed.placeObject('bank', sp.x + Math.round(Math.cos(k) * r), sp.y + Math.round(Math.sin(k) * r));
    expect(bank).toBeTruthy();
    const door = doorTile(bank!);
    let banker = null;
    for (let r = 0; r < 6 && !banker; r++) for (const [dx, dy] of [[0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0], [0, 2]]) { banker = banker ?? ed.addNpc('banker', door.x + dx * (r + 1), door.y + dy * (r + 1)); }
    expect(banker).toBeTruthy();
    const p = w.players.join()!;
    p.gold = 800; p.level = 6; p.trainedLevel = 1;
    expect(w.players.hasTrainers()).toBe(w.rt.entities.list('npcs').some((n) => n.type === 'trainer'));
    if (!w.players.hasTrainers()) ed.addNpc('trainer', sp.x - 1, sp.y);
    expect(w.players.skillLevel(p)).toBe(1);
    const m = w.ps.mind(p.id);
    for (let i = 0; i < 3000 && (!(p.bank ?? 0) || (p.trainedLevel ?? 1) < 6); i++) { if (!m.act) m.nextPlan = 0; w.engine.step(); p.sessionLeft = 999; }
    expect(p.bank ?? 0).toBeGreaterThan(0);
    expect(p.trainedLevel).toBe(6);
  }, 60000);

  it('region level ranges steer where players hunt', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    const p = w.players.join()!;
    p.level = 1;
    const before = w.brain.huntingAreas(p);
    const target = before[0];
    const area = w.rt.entities.get('spawnAreas', target.areaId)!;
    const ed = new EntityEditor(() => w.rt, new History(20, () => undefined));
    const r = ed.addRegion('wilderness', { x: area.x, y: area.y, w: area.w, h: area.h });
    ed.update('regions', r.id, { minLevel: 20, maxLevel: 30 });
    const after = w.brain.huntingAreas(p).find((x) => x.areaId === target.areaId)!;
    expect(after.score).toBeLessThan(target.score);
  });

  it('difficulty changes how harsh players are', () => {
    const w = buildWorld({ size: 96, npcs: 10, seed: 3 });
    const p = w.players.join()!;
    w.rt.config.difficulty = 'relaxed';
    const s0 = p.satisfaction; w.players.feel(p, 'death'); const relaxed = s0 - p.satisfaction;
    w.rt.config.difficulty = 'brutal';
    const s1 = p.satisfaction; w.players.feel(p, 'death'); const brutal = s1 - p.satisfaction;
    expect(brutal).toBeGreaterThan(relaxed);
  });

  it('quest templates pick monsters that exist in numbers', () => {
    const w = buildWorld({ size: 128, npcs: 20, seed: 3 });
    const q = questsFromTemplate(w.rt, 'hunt', 1).quests[0];
    const pop = w.rt.entities.list('spawnAreas').filter((a) => a.templateId === q.objectives[0].targetId).reduce((n, a) => n + a.maxCount, 0);
    expect(pop).toBeGreaterThanOrEqual(5);
  });
});
