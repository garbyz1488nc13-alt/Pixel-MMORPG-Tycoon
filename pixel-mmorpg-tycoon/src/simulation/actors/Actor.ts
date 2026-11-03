import type { EntityId } from '@/core/ids';

export type ActorKind = 'npc' | 'creature';
export type ActorState = 'idle' | 'walk' | 'chase' | 'attack' | 'flee' | 'return' | 'rest' | 'dead';

/** Live, simulated state of an NPC or creature. Never saved; rebuilt from definitions on load. */
export interface Actor {
  id: string;
  kind: ActorKind;
  /** NpcDef id or CreatureTemplate id. */
  defId: EntityId;
  spawnAreaId?: EntityId;
  /** Position in tile units (tile centre = x + 0.5). */
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  hp: number;
  maxHp: number;
  state: ActorState;
  path: number[] | null;
  pathIdx: number;
  pathRev: number;
  goalX: number;
  goalY: number;
  targetId: string | null;
  lastAttackerId: string | null;
  attackCd: number;
  idleUntil: number;
  nextThink: number;
  respawnAt: number;
  waypointIdx: number;
  facing: 1 | -1;
  moving: boolean;
  /** Ticks left on the white "got hit" flash. */
  hitFlash: number;
}

export function newActor(id: string, kind: ActorKind, defId: EntityId, x: number, y: number, maxHp: number): Actor {
  return {
    id, kind, defId, x: x + 0.5, y: y + 0.5, homeX: x, homeY: y, hp: maxHp, maxHp,
    state: 'idle', path: null, pathIdx: 0, pathRev: -1, goalX: x, goalY: y,
    targetId: null, lastAttackerId: null, attackCd: 0, idleUntil: 0, nextThink: 0, respawnAt: 0,
    waypointIdx: 0, facing: 1, moving: false, hitFlash: 0,
  };
}

export const isAlive = (a: Actor) => a.state !== 'dead';
export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
