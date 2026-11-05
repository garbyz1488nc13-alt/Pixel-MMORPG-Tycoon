import { createId, type EntityId } from '@/core/ids';
import { t as tr } from '@/i18n';
import { GATHER_SOURCES, itemKeyIndex } from '@/data/rpgDefaults';
import { getRegionType } from '@/data/regionTypes';
import type { CreatureTemplate, NpcDef } from '@/models/entities';
import type { ObjectiveType, QuestDef } from '@/models/rpg';
import type { WorldRuntime } from '@/simulation/WorldRuntime';
import { xpToNext } from './progression';
import { autoRewards } from './questRewards';

/**
 * Ready-made quest blueprints for lazy designers: each one fills itself with this
 * world's real content (givers, monsters that actually spawn, their loot, regions,
 * boss lairs) and level-appropriate rewards.
 */
export type QuestTemplateKey = 'hunt' | 'trophies' | 'gather' | 'delivery' | 'explore' | 'meet' | 'bounty' | 'raid' | 'chain';

export const QUEST_TEMPLATES: { key: QuestTemplateKey; name: string; hint: string }[] = [
  { key: 'hunt', name: 'Pest control', hint: 'Kill monsters that fit the level.' },
  { key: 'trophies', name: 'Trophy hunter', hint: 'Collect loot dropped by a monster of that level.' },
  { key: 'gather', name: 'Supplies for the town', hint: 'Gather wood, stone, herbs… from the map.' },
  { key: 'delivery', name: 'Special delivery', hint: 'Bring goods to another NPC.' },
  { key: 'explore', name: 'Scout the land', hint: 'Visit a region suited to the level.' },
  { key: 'meet', name: 'Meet the locals', hint: 'Talk to a shopkeeper or trainer. Easy XP for newcomers.' },
  { key: 'bounty', name: 'Daily bounty', hint: 'Repeatable monster hunt — keeps grinders busy.' },
  { key: 'raid', name: 'Raid quest', hint: 'Defeat a boss from a lair. Big rewards, needs a raid.' },
  { key: 'chain', name: 'Story chain (3 quests)', hint: 'Talk → hunt → trophies, unlocking one after another.' },
];

export interface TemplateResult { quests: QuestDef[]; error?: string }

interface Ctx {
  world: WorldRuntime;
  level: number;
  giver: NpcDef;
  npcs: NpcDef[];
  rand: () => number;
}

const pick = <T>(arr: T[], rand: () => number): T => arr[Math.floor(rand() * arr.length)];

/** Level-appropriate rewards: a share of the XP needed for the next level. */
function rewards(ctx: Ctx, weight: number): QuestDef['rewards'] {
  const need = xpToNext(ctx.level, ctx.world.rpg.progression) || 500;
  return { xp: Math.round(need * 0.3 * weight), currency: Math.round((10 + ctx.level * 8) * weight), items: [] };
}

function quest(ctx: Ctx, name: string, description: string, objectives: { type: ObjectiveType; targetId: EntityId; count: number; receiverId?: EntityId }[], weight: number, extra: Partial<QuestDef> = {}): QuestDef {
  return {
    id: createId('quest'), name, description, giverId: ctx.giver.id, requiredLevel: Math.max(1, ctx.level),
    objectives: objectives.map((o) => ({ id: createId('obj'), ...o })), rewards: rewards(ctx, weight), prerequisiteId: null, repeatable: false, autoRewards: true, ...extra,
  };
}

/** Monsters that really spawn (outside lairs), closest to the level. */
function monsterFor(ctx: Ctx, needLoot = false): CreatureTemplate | undefined {
  const s = ctx.world.entities;
  const pop = new Map<string, number>();
  for (const a of s.list('spawnAreas')) if (!a.lair && !a.eventId && a.maxCount > 0) pop.set(a.templateId, (pop.get(a.templateId) ?? 0) + a.maxCount);
  const list = s.list('creatureTemplates').filter((c) => pop.has(c.id) && !c.boss && (!needLoot || c.loot.length));
  if (!list.length) return undefined;
  // Close to the level, and plenty of them alive (a pond of 6 slimes can't feed a whole server).
  const score = (c: CreatureTemplate) => Math.abs(c.level - ctx.level) + (c.level > ctx.level + 2 ? 5 : 0) + 6 / Math.max(1, pop.get(c.id)!) + ctx.rand() * 0.5;
  return [...list].sort((a, b) => score(a) - score(b))[0];
}

function build(key: QuestTemplateKey, ctx: Ctx): TemplateResult {
  const s = ctx.world.entities;
  const items = s.list('items');
  const lv = ctx.level;
  switch (key) {
    case 'hunt':
    case 'bounty': {
      const m = monsterFor(ctx);
      if (!m) return { quests: [], error: tr('No monster spawn areas yet. Draw a spawn area first.') };
      const count = 5 + Math.min(10, Math.round(lv / 2));
      return key === 'hunt'
        ? { quests: [quest(ctx, tr('Pest control: {name}', { name: m.name }), tr('{name} are getting out of hand. Thin their numbers.', { name: m.name }), [{ type: 'kill', targetId: m.id, count }], 1)] }
        : { quests: [quest(ctx, tr('Daily bounty: {name}', { name: m.name }), tr('The guard pays for every {name} slain. Come back tomorrow for more.', { name: m.name }), [{ type: 'kill', targetId: m.id, count: count + 4 }], 0.7, { repeatable: true })] };
    }
    case 'trophies': {
      const m = monsterFor(ctx, true);
      const drop = m && [...m.loot].sort((a, b) => b.chance - a.chance)[0];
      const item = drop && s.get('items', drop.itemId);
      if (!m || !item) return { quests: [], error: tr('No monster with loot spawns in this world yet.') };
      const count = Math.max(2, Math.round(3 + lv / 3));
      return { quests: [quest(ctx, tr('Trophy hunter: {item}', { item: item.name }), tr('Bring me {n}× {item}. You will find them on {name}.', { n: count, item: item.name, name: m.name }), [{ type: 'collect', targetId: item.id, count }], 1.1)] };
    }
    case 'gather': {
      const kinds = new Set(s.list('objects').map((o) => GATHER_SOURCES[o.kind]).filter(Boolean));
      const idx = itemKeyIndex(items);
      const keys = [...kinds].filter((k) => idx.has(k));
      if (!keys.length) return { quests: [], error: tr('Nothing to gather on the map. Place trees, rocks or bushes.') };
      const item = s.get('items', idx.get(pick(keys, ctx.rand))!)!;
      return { quests: [quest(ctx, tr('Supplies: {item}', { item: item.name }), tr('The town needs {item}. Gather some and bring them over.', { item: item.name }), [{ type: 'gather', targetId: item.id, count: 8 + lv }], 0.8)] };
    }
    case 'delivery': {
      const receiver = ctx.npcs.find((n) => n.id !== ctx.giver.id && ['merchant', 'blacksmith', 'healer', 'banker'].includes(n.type)) ?? ctx.npcs.find((n) => n.id !== ctx.giver.id);
      const idx = itemKeyIndex(items);
      const goods = ['bread', 'iron_ingot', 'herb', 'cloth', 'wood'].map((k) => idx.get(k)).filter((x): x is string => !!x);
      if (!receiver || !goods.length) return { quests: [], error: tr('Needs a second NPC to deliver to.') };
      const item = s.get('items', pick(goods, ctx.rand))!;
      return { quests: [quest(ctx, tr('Special delivery for {name}', { name: receiver.name }), tr('{name} is waiting for {item}. Get some and deliver them.', { name: receiver.name, item: item.name }), [{ type: 'deliver', targetId: item.id, count: 3, receiverId: receiver.id }], 0.9)] };
    }
    case 'explore': {
      const regions = s.list('regions').filter((r) => !getRegionType(r.type).safe);
      const all = regions.length ? regions : s.list('regions');
      if (!all.length) return { quests: [], error: tr('Draw some regions first.') };
      const best = [...all].sort((a, b) => Math.abs((a.minLevel + a.maxLevel) / 2 - lv) - Math.abs((b.minLevel + b.maxLevel) / 2 - lv) + (ctx.rand() - 0.5))[0];
      return { quests: [quest(ctx, tr('Scout: {name}', { name: best.name }), tr('Strange things happen in {name}. Go and take a look.', { name: best.name }), [{ type: 'explore', targetId: best.id, count: 1 }], 0.7)] };
    }
    case 'meet': {
      const locals = ctx.npcs.filter((n) => n.id !== ctx.giver.id && ['merchant', 'blacksmith', 'healer', 'trainer', 'banker'].includes(n.type));
      if (!locals.length) return { quests: [], error: tr('Needs a shopkeeper or trainer NPC.') };
      const n = pick(locals, ctx.rand);
      return { quests: [quest(ctx, tr('Meet {name}', { name: n.name }), tr('Introduce yourself to {name}. Good friends make good prices.', { name: n.name }), [{ type: 'talk', targetId: n.id, count: 1 }], 0.4)] };
    }
    case 'raid': {
      const lairs = s.list('spawnAreas').filter((a) => a.lair);
      const bosses = lairs.map((a) => s.get('creatureTemplates', a.templateId)).filter((x): x is CreatureTemplate => !!x);
      if (!bosses.length) return { quests: [], error: tr('No boss lairs yet. Place one in Map → Creatures → Boss lairs.') };
      const b = [...bosses].sort((x, y) => Math.abs(x.level - lv) - Math.abs(y.level - lv))[0];
      const q = quest({ ...ctx, level: b.level }, tr('Raid: {name}', { name: b.name }), tr('Gather your clan and defeat {name}. Legends are written in raids.', { name: b.name }), [{ type: 'boss', targetId: b.id, count: 1 }], 3, { repeatable: true });
      return { quests: [q] };
    }
    case 'chain': {
      const a = build('meet', ctx), b = build('hunt', ctx), c = build('trophies', ctx);
      const parts = [a, b, c].filter((r) => r.quests.length).map((r) => r.quests[0]);
      if (parts.length < 2) return { quests: [], error: a.error ?? b.error ?? c.error };
      for (let i = 1; i < parts.length; i++) parts[i].prerequisiteId = parts[i - 1].id;
      parts[parts.length - 1].rewards.currency = Math.round(parts[parts.length - 1].rewards.currency * 1.5);
      return { quests: parts };
    }
  }
}

/** Build quests from a template for a level (does not add them to the world). */
export function questsFromTemplate(world: WorldRuntime, key: QuestTemplateKey, level: number, giverId?: EntityId | null, rand: () => number = Math.random): TemplateResult {
  const npcs = world.entities.list('npcs');
  const giver = (giverId && world.entities.get('npcs', giverId)) || npcs.find((n) => n.type === 'questgiver') || npcs[0];
  if (!giver) return { quests: [], error: tr('Place an NPC first — quests need a quest giver.') };
  const res = build(key, { world, level: Math.max(1, Math.round(level)), giver, npcs, rand });
  for (const q of res.quests) q.rewards = autoRewards(q, world);
  return res;
}

/** A starter pack for a level: one quest of every kind that fits this world. */
export function questPack(world: WorldRuntime, level: number, giverId?: EntityId | null, rand: () => number = Math.random): TemplateResult {
  const out: QuestDef[] = [];
  for (const k of ['meet', 'hunt', 'trophies', 'gather', 'explore', 'delivery', 'bounty'] as QuestTemplateKey[]) {
    const r = questsFromTemplate(world, k, level, giverId, rand);
    out.push(...r.quests);
  }
  return out.length ? { quests: out } : { quests: [], error: tr('Place an NPC first — quests need a quest giver.') };
}
