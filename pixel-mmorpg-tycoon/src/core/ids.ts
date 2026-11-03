/** Unique, sortable-ish IDs for every entity (worlds, saves, future NPCs/monsters/items). */
export type EntityId = string;

let counter = 0;

export function createId(prefix = 'id'): EntityId {
  counter = (counter + 1) % 0xffff;
  const time = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0xffffff).toString(36).padStart(5, '0');
  return `${prefix}_${time}${counter.toString(36)}${rand}`;
}
