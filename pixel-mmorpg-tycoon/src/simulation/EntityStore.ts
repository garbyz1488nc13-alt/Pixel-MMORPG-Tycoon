import { EventBus } from '@/core/EventBus';
import type { EntityId } from '@/core/ids';
import { emptyEntities, type EntityCollection, type WorldEntities } from '@/models/entities';

type Item<C extends EntityCollection> = WorldEntities[C][number];

/** A reversible change to one entity. `before`/`after` null = absent. */
export interface EntityChange<C extends EntityCollection = EntityCollection> {
  col: C;
  id: EntityId;
  before: Item<C> | null;
  after: Item<C> | null;
}

export type EntityEvents = {
  changed: { col: EntityCollection; ids: EntityId[] };
};

const clone = <T>(v: T): T => (v === null ? v : structuredClone(v));

/**
 * Holds every authored entity (objects, regions, NPCs, creature templates, spawn areas).
 * All mutations return EntityChange records so callers can push them to undo history.
 */
export class EntityStore {
  readonly events = new EventBus<EntityEvents>();
  private maps: { [C in EntityCollection]: Map<EntityId, Item<C>> };
  /** Bumped on every change; cheap "did anything change" check for renderers. */
  version = 0;

  constructor(data: WorldEntities = emptyEntities()) {
    this.maps = {
      objects: new Map(data.objects.map((e) => [e.id, clone(e)])),
      regions: new Map(data.regions.map((e) => [e.id, clone(e)])),
      npcs: new Map(data.npcs.map((e) => [e.id, clone(e)])),
      creatureTemplates: new Map(data.creatureTemplates.map((e) => [e.id, clone(e)])),
      spawnAreas: new Map(data.spawnAreas.map((e) => [e.id, clone(e)])),
      items: new Map(data.items.map((e) => [e.id, clone(e)])),
      quests: new Map(data.quests.map((e) => [e.id, clone(e)])),
    } as EntityStore['maps'];
  }

  get<C extends EntityCollection>(col: C, id: EntityId): Item<C> | undefined {
    return this.maps[col].get(id) as Item<C> | undefined;
  }

  list<C extends EntityCollection>(col: C): Item<C>[] {
    return [...this.maps[col].values()] as Item<C>[];
  }

  count(col: EntityCollection): number {
    return this.maps[col].size;
  }

  add<C extends EntityCollection>(col: C, entity: Item<C>): EntityChange<C> {
    return this.set(col, entity.id, entity);
  }

  update<C extends EntityCollection>(col: C, id: EntityId, patch: Partial<Item<C>>): EntityChange<C> | null {
    const cur = this.get(col, id);
    if (!cur) return null;
    return this.set(col, id, { ...cur, ...patch } as Item<C>);
  }

  remove<C extends EntityCollection>(col: C, id: EntityId): EntityChange<C> | null {
    if (!this.maps[col].has(id)) return null;
    return this.set(col, id, null);
  }

  /** Low-level set; emits one change event. */
  private set<C extends EntityCollection>(col: C, id: EntityId, value: Item<C> | null, emit = true): EntityChange<C> {
    const map = this.maps[col] as Map<EntityId, Item<C>>;
    const before = map.has(id) ? clone(map.get(id)!) : null;
    if (value === null) map.delete(id);
    else map.set(id, clone(value));
    this.version++;
    if (emit) this.events.emit('changed', { col, ids: [id] });
    return { col, id, before, after: clone(value) };
  }

  /** Re-apply a batch of changes forward (redo) or backward (undo), with one event per collection. */
  applyChanges(changes: EntityChange[], direction: 'forward' | 'backward'): void {
    const touched = new Map<EntityCollection, EntityId[]>();
    const list = direction === 'forward' ? changes : [...changes].reverse();
    for (const c of list) {
      this.set(c.col, c.id, direction === 'forward' ? c.after : c.before, false);
      if (!touched.has(c.col)) touched.set(c.col, []);
      touched.get(c.col)!.push(c.id);
    }
    touched.forEach((ids, col) => this.events.emit('changed', { col, ids }));
  }

  /** Apply many new values at once (bulk generators) with a single event per collection. */
  bulk(changes: { col: EntityCollection; id: EntityId; value: any }[]): EntityChange[] {
    const out: EntityChange[] = [];
    const touched = new Map<EntityCollection, EntityId[]>();
    for (const c of changes) {
      out.push(this.set(c.col, c.id, c.value, false));
      if (!touched.has(c.col)) touched.set(c.col, []);
      touched.get(c.col)!.push(c.id);
    }
    touched.forEach((ids, col) => this.events.emit('changed', { col, ids }));
    return out;
  }

  toJSON(): WorldEntities {
    return {
      objects: this.list('objects').map(clone),
      regions: this.list('regions').map(clone),
      npcs: this.list('npcs').map(clone),
      creatureTemplates: this.list('creatureTemplates').map(clone),
      spawnAreas: this.list('spawnAreas').map(clone),
      items: this.list('items').map(clone),
      quests: this.list('quests').map(clone),
    };
  }
}
