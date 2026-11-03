import { getNpcType } from '@/data/npcTypes';
import { dist, isAlive, type Actor } from '../actors/Actor';
import type { ActorManager } from '../actors/ActorManager';
import { combatStats, engage, fightsBack, respawn } from '../actors/combat';
import { toGameTime } from '../time';
import type { SimContext, SimulationSystem } from '../types';

export function isWorkingHour(hour: number, start: number, end: number): boolean {
  if (end - start >= 24 || start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end; // overnight shift
}

/** NPC behaviour: schedules, wander/patrol/stationary, guards defending, civilians fleeing. */
export class NpcSystem implements SimulationSystem {
  readonly id = 'npcs';
  private near: Actor[] = [];

  constructor(private mgr: ActorManager) {}

  update(ctx: SimContext): void {
    const mgr = this.mgr;
    mgr.tick = ctx.tick;
    const hour = toGameTime(ctx.world.clock.totalMinutes).minuteOfDay / 60;
    for (const a of mgr.actors.values()) {
      if (a.kind !== 'npc') continue;
      if (a.state === 'dead') {
        if (mgr.gameMinutes >= a.respawnAt) respawn(mgr, a, a.homeX, a.homeY);
        continue;
      }
      const def = mgr.npcDef(a);
      const stats = combatStats(mgr, a);
      if (!def || !stats) continue;
      if (a.attackCd > 0) a.attackCd--;
      if (a.hitFlash > 0) a.hitFlash--;
      const type = getNpcType(def.type);

      // --- combat
      let target = a.targetId ? mgr.actors.get(a.targetId) : undefined;
      if (target && !isAlive(target)) target = undefined;
      if (!target) a.targetId = null;
      const attacker = a.lastAttackerId ? mgr.actors.get(a.lastAttackerId) : undefined;
      if (attacker && !isAlive(attacker)) a.lastAttackerId = null;

      if (type.defender && !target && ctx.tick >= a.nextThink) {
        a.nextThink = ctx.tick + 5;
        target = this.findHostile(a, def.interactionRadius);
        if (target) a.targetId = target.id;
      }
      if (!target && attacker && isAlive(attacker) && fightsBack(mgr, a)) {
        target = attacker;
        a.targetId = attacker.id;
      }
      if (target) {
        const home = { x: a.homeX + 0.5, y: a.homeY + 0.5 };
        if (dist(a, home) > def.interactionRadius * 2.5 + 4) {
          a.targetId = null;
          a.lastAttackerId = null;
          a.state = 'return';
          mgr.goTo(a, a.homeX, a.homeY);
        } else {
          engage(mgr, a, target, stats);
          continue;
        }
      }
      if (attacker && isAlive(attacker) && !fightsBack(mgr, a)) {
        if (dist(a, attacker) < 7) {
          if (a.state !== 'flee' || !a.path) {
            a.state = 'flee';
            if (!mgr.goTo(a, a.homeX, a.homeY) || dist(attacker, { x: a.homeX + 0.5, y: a.homeY + 0.5 }) < 3) {
              const away = mgr.randomWalkableNear(a.x + (a.x - attacker.x) * 3, a.y + (a.y - attacker.y) * 3, 2);
              if (away) mgr.goTo(a, away.x, away.y);
            }
          }
          mgr.step(a, def.speed * 1.3);
          continue;
        }
        a.lastAttackerId = null;
      }

      // --- schedule
      const atHome = Math.floor(a.x) === a.homeX && Math.floor(a.y) === a.homeY;
      if (!isWorkingHour(hour, def.workStart, def.workEnd)) {
        if (atHome && !a.path) { a.state = 'rest'; a.moving = false; continue; }
        if (!a.path && ctx.tick >= a.idleUntil && !mgr.goTo(a, a.homeX, a.homeY)) a.idleUntil = ctx.tick + 30;
        a.state = 'return';
        mgr.step(a, def.speed);
        continue;
      }

      // --- behaviour
      if (a.path) {
        a.state = 'walk';
        if (mgr.step(a, def.speed)) {
          a.state = 'idle';
          a.idleUntil = ctx.tick + 20 + Math.floor(mgr.rand() * 70);
        }
        continue;
      }
      a.state = 'idle';
      a.moving = false;
      if (ctx.tick < a.idleUntil) continue;
      switch (def.behavior) {
        case 'stationary':
          if (!atHome && !mgr.goTo(a, a.homeX, a.homeY)) a.idleUntil = ctx.tick + 50;
          else a.idleUntil = ctx.tick + 40;
          break;
        case 'wander': {
          const p = mgr.randomWalkableNear(a.homeX, a.homeY, Math.max(1, def.wanderRadius));
          if (!p || !mgr.goTo(a, p.x, p.y, 1500)) a.idleUntil = ctx.tick + 20;
          break;
        }
        case 'patrol': {
          const points = [{ x: a.homeX, y: a.homeY }, ...def.waypoints];
          if (points.length < 2) {
            const p = mgr.randomWalkableNear(a.homeX, a.homeY, 4);
            if (!p || !mgr.goTo(a, p.x, p.y, 1500)) a.idleUntil = ctx.tick + 20;
            break;
          }
          a.waypointIdx = (a.waypointIdx + 1) % points.length;
          const wp = points[a.waypointIdx];
          if (!mgr.goTo(a, wp.x, wp.y, 4000)) a.idleUntil = ctx.tick + 20;
          break;
        }
      }
    }
  }

  private findHostile(a: Actor, radius: number): Actor | undefined {
    this.near.length = 0;
    this.mgr.spatial.query(a.x, a.y, radius, this.near);
    let best: Actor | undefined;
    let bestD = Infinity;
    for (const o of this.near) {
      if (o.kind !== 'creature' || !isAlive(o)) continue;
      const d = dist(a, o);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }
}
