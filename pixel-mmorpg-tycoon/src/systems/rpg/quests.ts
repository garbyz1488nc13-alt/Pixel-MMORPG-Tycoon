import type { EntityId } from '@/core/ids';
import { GATHER_SOURCES } from '@/data/rpgDefaults';
import type { ObjectiveType, QuestDef, QuestObjective } from '@/models/rpg';
import type { EntityStore } from '@/simulation/EntityStore';
import type { RpgConfig } from '@/models/rpg';

export interface QuestIssue {
  level: 'error' | 'warn';
  /** English source text for t(); params fill placeholders. */
  text: string;
  params?: Record<string, string | number>;
  objectiveId?: EntityId;
}

/** What kind of entity an objective type targets. */
export function targetKind(type: ObjectiveType): 'creatureTemplates' | 'items' | 'regions' | 'npcs' {
  switch (type) {
    case 'kill':
    case 'boss':
      return 'creatureTemplates';
    case 'collect':
    case 'gather':
    case 'deliver':
      return 'items';
    case 'explore':
      return 'regions';
    case 'talk':
      return 'npcs';
  }
}

/**
 * Checks that a quest can actually be completed in this world:
 * every target exists and is obtainable, the chain has no cycles, rewards are payable.
 */
export function validateQuest(q: QuestDef, store: EntityStore, rpg: RpgConfig): QuestIssue[] {
  const issues: QuestIssue[] = [];
  const err = (text: string, params?: QuestIssue['params'], objectiveId?: EntityId) => issues.push({ level: 'error', text, params, objectiveId });
  const warn = (text: string, params?: QuestIssue['params'], objectiveId?: EntityId) => issues.push({ level: 'warn', text, params, objectiveId });

  if (!q.giverId) err('No quest giver selected.');
  else if (!store.get('npcs', q.giverId)) err('The quest giver no longer exists.');
  if (!q.objectives.length) err('Add at least one objective.');
  if (q.requiredLevel > rpg.progression.maxLevel) err('Required level is above the max level ({n}).', { n: rpg.progression.maxLevel });

  const loot = new Set(store.list('creatureTemplates').flatMap((c) => c.loot.map((l) => l.itemId)));
  const sold = new Set(store.list('npcs').flatMap((n) => (n.shop.enabled ? n.shop.items.map((s) => s.itemId) : [])));
  const areas = store.list('spawnAreas');
  const objects = store.list('objects');

  for (const o of q.objectives) {
    const kind = targetKind(o.type);
    const target = o.targetId ? store.get(kind, o.targetId) : undefined;
    if (!o.targetId || !target) { err('Objective has no valid target.', undefined, o.id); continue; }
    if (o.count < 1) err('Objective count must be at least 1.', undefined, o.id);
    switch (o.type) {
      case 'kill':
      case 'boss': {
        const spawned = areas.filter((a) => a.templateId === o.targetId).reduce((n, a) => n + a.maxCount, 0);
        if (!spawned) warn('"{name}" has no spawn area, so it can never be killed.', { name: (target as { name: string }).name }, o.id);
        if (o.type === 'boss' && !(target as { boss: boolean }).boss) warn('"{name}" is not marked as a boss.', { name: (target as { name: string }).name }, o.id);
        break;
      }
      case 'collect':
      case 'deliver':
        if (!loot.has(o.targetId) && !sold.has(o.targetId)) warn('"{name}" drops from no monster and no shop sells it.', { name: (target as { name: string }).name }, o.id);
        if (o.type === 'deliver') {
          if (!o.receiverId) err('Choose who receives the delivery.', undefined, o.id);
          else if (!store.get('npcs', o.receiverId)) err('The delivery receiver no longer exists.', undefined, o.id);
        }
        break;
      case 'gather': {
        const key = (target as { key?: string }).key;
        const sources = Object.entries(GATHER_SOURCES).filter(([, k]) => k === key).map(([kind]) => kind);
        if (!sources.length) err('"{name}" cannot be gathered from map objects.', { name: (target as { name: string }).name }, o.id);
        else if (!objects.some((ob) => sources.includes(ob.kind))) warn('There is nothing on the map to gather "{name}" from.', { name: (target as { name: string }).name }, o.id);
        break;
      }
    }
  }

  // Chain: prerequisite exists and no cycles.
  if (q.prerequisiteId) {
    if (!store.get('quests', q.prerequisiteId)) err('The previous quest in the chain no longer exists.');
    const seen = new Set<EntityId>([q.id]);
    let cur = q.prerequisiteId ? store.get('quests', q.prerequisiteId) : undefined;
    while (cur) {
      if (seen.has(cur.id)) { err('The quest chain loops back on itself.'); break; }
      seen.add(cur.id);
      cur = cur.prerequisiteId ? store.get('quests', cur.prerequisiteId) : undefined;
    }
  }

  if (q.rewards.currency > rpg.economy.treasury) warn('The reward is larger than the current treasury.');
  for (const s of q.rewards.items) if (!store.get('items', s.itemId)) err('A reward item no longer exists.');
  return issues;
}

/** Quest chain depth (1 = no prerequisite). */
export function chainPosition(q: QuestDef, store: EntityStore): number {
  let n = 1;
  const seen = new Set([q.id]);
  let cur = q.prerequisiteId ? store.get('quests', q.prerequisiteId) : undefined;
  while (cur && !seen.has(cur.id)) { seen.add(cur.id); n++; cur = cur.prerequisiteId ? store.get('quests', cur.prerequisiteId) : undefined; }
  return n;
}

// ---------------------------------------------------------------- tracking

export type QuestEvent =
  | { type: 'kill'; templateId: EntityId; boss?: boolean }
  | { type: 'collect'; itemId: EntityId; qty: number }
  | { type: 'gather'; itemId: EntityId; qty: number }
  | { type: 'explore'; regionId: EntityId }
  | { type: 'talk'; npcId: EntityId }
  | { type: 'deliver'; npcId: EntityId; itemId: EntityId; qty: number };

export interface QuestProgress { questId: EntityId; counts: number[]; status: 'active' | 'complete' | 'turnedIn' }

export function objectiveDelta(o: QuestObjective, e: QuestEvent): number {
  switch (e.type) {
    case 'kill':
      return (o.type === 'kill' || o.type === 'boss') && o.targetId === e.templateId ? 1 : 0;
    case 'collect':
      return o.type === 'collect' && o.targetId === e.itemId ? e.qty : 0;
    case 'gather':
      return (o.type === 'gather' || o.type === 'collect') && o.targetId === e.itemId ? e.qty : 0;
    case 'explore':
      return o.type === 'explore' && o.targetId === e.regionId ? 1 : 0;
    case 'talk':
      return o.type === 'talk' && o.targetId === e.npcId ? 1 : 0;
    case 'deliver':
      return o.type === 'deliver' && o.targetId === e.itemId && o.receiverId === e.npcId ? e.qty : 0;
  }
}

/**
 * Tracks one character's quests. Pure logic: the player simulation (Phase 4)
 * feeds it events; the editor uses it in tests and previews.
 */
export class QuestTracker {
  readonly progress = new Map<EntityId, QuestProgress>();
  readonly completed = new Set<EntityId>();

  constructor(private quests: (id: EntityId) => QuestDef | undefined) {}

  canAccept(q: QuestDef, level: number): boolean {
    if (level < q.requiredLevel) return false;
    if (this.progress.has(q.id)) return false;
    if (this.completed.has(q.id) && !q.repeatable) return false;
    if (q.prerequisiteId && !this.completed.has(q.prerequisiteId)) return false;
    return true;
  }

  accept(q: QuestDef, level: number): boolean {
    if (!this.canAccept(q, level)) return false;
    this.progress.set(q.id, { questId: q.id, counts: q.objectives.map(() => 0), status: 'active' });
    return true;
  }

  /** Apply an event to all active quests; returns ids of quests that became complete. */
  handle(e: QuestEvent): EntityId[] {
    const done: EntityId[] = [];
    for (const p of this.progress.values()) {
      if (p.status !== 'active') continue;
      const q = this.quests(p.questId);
      if (!q) continue;
      q.objectives.forEach((o, i) => {
        p.counts[i] = Math.min(o.count, p.counts[i] + objectiveDelta(o, e));
      });
      if (q.objectives.every((o, i) => p.counts[i] >= o.count)) {
        p.status = 'complete';
        done.push(q.id);
      }
    }
    return done;
  }

  /** Hand in a completed quest; returns its rewards. */
  turnIn(questId: EntityId): QuestDef['rewards'] | null {
    const p = this.progress.get(questId);
    const q = this.quests(questId);
    if (!p || !q || p.status !== 'complete') return null;
    this.progress.delete(questId);
    this.completed.add(questId);
    return q.rewards;
  }
}
