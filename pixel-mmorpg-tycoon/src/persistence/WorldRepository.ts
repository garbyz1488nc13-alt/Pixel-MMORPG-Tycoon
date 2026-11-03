import { openDb, requestToPromise, STORE_SAVES, STORE_WORLDS, txDone } from './db';
import { migrate, toMeta } from './serializer';
import { createId } from '@/core/ids';
import type { EntityId } from '@/core/ids';
import { SAVE_SLOTS, type SaveSlotKey, type SaveSlotRecord, type WorldMeta, type WorldSave } from '@/models/world';

/**
 * All world persistence goes through here. Each world has a metadata record
 * (for fast listing) and up to 4 save slots (autosave + 3 manual).
 */
export const WorldRepository = {
  async listWorlds(): Promise<WorldMeta[]> {
    const db = await openDb();
    const all = await requestToPromise(db.transaction(STORE_WORLDS).objectStore(STORE_WORLDS).getAll() as IDBRequest<WorldMeta[]>);
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async getMeta(id: EntityId): Promise<WorldMeta | undefined> {
    const db = await openDb();
    return requestToPromise(db.transaction(STORE_WORLDS).objectStore(STORE_WORLDS).get(id) as IDBRequest<WorldMeta | undefined>);
  },

  async save(save: WorldSave, slot: SaveSlotKey, thumbnail?: string): Promise<SaveSlotRecord> {
    const db = await openDb();
    const tx = db.transaction([STORE_WORLDS, STORE_SAVES], 'readwrite');
    const record: SaveSlotRecord = {
      key: `${save.id}:${slot}`,
      worldId: save.id,
      slot,
      savedAt: save.updatedAt,
      label: SAVE_SLOTS.find((s) => s.key === slot)?.label ?? slot,
      data: save,
    };
    tx.objectStore(STORE_SAVES).put(record);
    tx.objectStore(STORE_WORLDS).put(toMeta(save, thumbnail));
    await txDone(tx);
    return record;
  },

  async listSlots(worldId: EntityId): Promise<Omit<SaveSlotRecord, 'data'>[]> {
    const db = await openDb();
    const idx = db.transaction(STORE_SAVES).objectStore(STORE_SAVES).index('worldId');
    const recs = await requestToPromise(idx.getAll(worldId) as IDBRequest<SaveSlotRecord[]>);
    return recs.map(({ data: _d, ...rest }) => rest).sort((a, b) => b.savedAt - a.savedAt);
  },

  /** Load a slot, or the most recent slot of the world when `slot` is omitted. */
  async load(worldId: EntityId, slot?: SaveSlotKey): Promise<{ save: WorldSave; slot: SaveSlotKey } | null> {
    const db = await openDb();
    const store = db.transaction(STORE_SAVES).objectStore(STORE_SAVES);
    let rec: SaveSlotRecord | undefined;
    if (slot) {
      rec = await requestToPromise(store.get(`${worldId}:${slot}`) as IDBRequest<SaveSlotRecord | undefined>);
    } else {
      const recs = await requestToPromise(store.index('worldId').getAll(worldId) as IDBRequest<SaveSlotRecord[]>);
      rec = recs.sort((a, b) => b.savedAt - a.savedAt)[0];
    }
    return rec ? { save: migrate(rec.data), slot: rec.slot } : null;
  },

  async deleteWorld(worldId: EntityId): Promise<void> {
    const db = await openDb();
    const tx = db.transaction([STORE_WORLDS, STORE_SAVES], 'readwrite');
    tx.objectStore(STORE_WORLDS).delete(worldId);
    for (const s of SAVE_SLOTS) tx.objectStore(STORE_SAVES).delete(`${worldId}:${s.key}`);
    await txDone(tx);
  },

  async renameWorld(worldId: EntityId, name: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction([STORE_WORLDS, STORE_SAVES], 'readwrite');
    const worlds = tx.objectStore(STORE_WORLDS);
    const saves = tx.objectStore(STORE_SAVES);
    const meta = await requestToPromise(worlds.get(worldId) as IDBRequest<WorldMeta | undefined>);
    if (meta) worlds.put({ ...meta, name });
    const recs = await requestToPromise(saves.index('worldId').getAll(worldId) as IDBRequest<SaveSlotRecord[]>);
    for (const r of recs) saves.put({ ...r, data: { ...r.data, name } });
    await txDone(tx);
  },

  /** Copy the latest save of a world into a brand new world. */
  async duplicateWorld(worldId: EntityId): Promise<WorldMeta | null> {
    const latest = await this.load(worldId);
    if (!latest) return null;
    const meta = await this.getMeta(worldId);
    const now = Date.now();
    const copy: WorldSave = { ...latest.save, id: createId('world'), name: `${latest.save.name} (copy)`, createdAt: now, updatedAt: now };
    await this.save(copy, 'slot1', meta?.thumbnail);
    return toMeta(copy, meta?.thumbnail);
  },

  /** Store an imported world. Re-ids it if a world with the same id already exists. */
  async importWorld(save: WorldSave, thumbnail?: string): Promise<WorldSave> {
    const existing = await this.getMeta(save.id);
    const final: WorldSave = existing ? { ...save, id: createId('world'), name: `${save.name} (imported)` } : save;
    await this.save({ ...final, updatedAt: Date.now() }, 'slot1', thumbnail);
    return final;
  },
};
