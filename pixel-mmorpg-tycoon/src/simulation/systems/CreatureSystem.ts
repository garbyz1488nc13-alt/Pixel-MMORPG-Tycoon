import { dist, isAlive, type Actor } from '../actors/Actor';
import type { ActorManager } from '../actors/ActorManager';
import { combatStats, engage, respawn } from '../actors/combat';
import type { SimContext, SimulationSystem } from '../types';

/** Monster behaviour: respawning, wandering their spawn area, aggro, chasing, leashing. */
export class CreatureSystem implements SimulationSystem {
  readonly id = 'creatures';
  private near: Actor[] = [];

  constructor(private mgr: ActorManager) {}

  update(ctx: SimContext): void {
    const mgr = this.mgr;
    mgr.tick = ctx.tick;
    for (const a of mgr.actors.values()) {
      if (a.kind !== 'creature') continue;
      const tpl = mgr.template(a);
      const area = mgr.area(a);
      const stats = combatStats(mgr, a);
      if (!tpl || !area || !stats) continue;

      if (a.state === 'dead') {
        if (mgr.gameMinutes >= a.respawnAt) {
          const p = mgr.randomTileInArea(area);
          if (p) respawn(mgr, a, p.x, p.y);
        }
        continue;
      }
      if (a.attackCd > 0) a.attackCd--;
      if (a.hitFlash > 0) a.hitFlash--;

      let target = a.targetId ? mgr.actors.get(a.targetId) : undefined;
      if (target && !isAlive(target)) target = undefined;
      if (!target) a.targetId = null;
      const attacker = a.lastAttackerId ? mgr.actors.get(a.lastAttackerId) : undefined;

      if (!target && tpl.aggression === 'aggressive' && ctx.tick >= a.nextThink) {
        a.nextThink = ctx.tick + 4 + Math.floor(mgr.rand() * 4);
        target = this.findPrey(a, tpl.aggroRange);
        if (target) a.targetId = target.id;
      }
      if (!target && tpl.aggression === 'defensive' && attacker && isAlive(attacker)) {
        target = attacker;
        a.targetId = attacker.id;
      }

      const cx = area.x + area.w / 2;
      const cy = area.y + area.h / 2;
      const leash = Math.max(area.w, area.h) / 2 + tpl.aggroRange + 4;

      if (target) {
        if (Math.hypot(a.x - cx, a.y - cy) > leash) {
          // Too far from home: give up and go back.
          a.targetId = null;
          a.lastAttackerId = null;
          a.state = 'return';
          const p = mgr.randomTileInArea(area);
          if (p) mgr.goTo(a, p.x, p.y);
        } else {
          engage(mgr, a, target, stats);
          continue;
        }
      }

      if (tpl.aggression === 'passive' && attacker && isAlive(attacker) && dist(a, attacker) < 5) {
        if (!a.path) {
          const away = mgr.randomWalkableNear(a.x + (a.x - attacker.x) * 2, a.y + (a.y - attacker.y) * 2, 2);
          if (away) mgr.goTo(a, away.x, away.y, 800);
        }
        a.state = 'flee';
        mgr.step(a, stats.speed * 1.2);
        continue;
      }

      // Out of combat: slowly regenerate, wander inside the area.
      if (a.hp < a.maxHp && ctx.tick % 10 === 0) a.hp = Math.min(a.maxHp, a.hp + Math.ceil(a.maxHp * 0.02));
      if (a.path) {
        a.state = a.state === 'return' ? 'return' : 'walk';
        if (mgr.step(a, stats.speed * (a.state === 'return' ? 1.2 : 0.7))) {
          a.state = 'idle';
          a.idleUntil = ctx.tick + 15 + Math.floor(mgr.rand() * 60);
        }
        continue;
      }
      a.state = 'idle';
      a.moving = false;
      if (ctx.tick >= a.idleUntil) {
        const p = mgr.randomTileInArea(area);
        if (!p || !mgr.goTo(a, p.x, p.y, 1200)) a.idleUntil = ctx.tick + 25;
      }
    }
  }

  private findPrey(a: Actor, range: number): Actor | undefined {
    this.near.length = 0;
    this.mgr.spatial.query(a.x, a.y, range, this.near);
    let best: Actor | undefined;
    let bestD = Infinity;
    for (const o of this.near) {
      if (o.kind !== 'npc' || !isAlive(o)) continue;
      const d = dist(a, o);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }
}
