import { getNpcType, npcCombatStats } from '@/data/npcTypes';
import { BOSS_ENRAGE_MULT } from '@/data/bossTypes';
import type { ActorManager } from './ActorManager';
import { dist, type Actor } from './Actor';

export const ATTACK_COOLDOWN_TICKS = 12;
export const NPC_RESPAWN_MINUTES = 60;
export const PLAYER_RESPAWN_MINUTES = 5;

export interface CombatStats { damage: number; defense: number; attackRange: number; speed: number }

export function combatStats(mgr: ActorManager, a: Actor): CombatStats | null {
  if (a.kind === 'player') return mgr.playerStats?.(a) ?? null;
  if (a.kind === 'npc') {
    const d = mgr.npcDef(a);
    if (!d) return null;
    return { ...npcCombatStats(d.level), speed: d.speed };
  }
  const t = mgr.template(a);
  if (!t) return null;
  return { damage: a.enraged ? t.damage * BOSS_ENRAGE_MULT : t.damage, defense: t.defense, attackRange: t.attackRange, speed: t.speed };
}

export function displayName(mgr: ActorManager, a: Actor): string {
  if (a.kind === 'player') return mgr.playerName?.(a) ?? 'Player';
  if (a.kind === 'npc') return mgr.npcDef(a)?.name ?? 'NPC';
  return mgr.template(a)?.name ?? 'Creature';
}

/** Resolve one attack. Returns true if the target died. */
export function attack(mgr: ActorManager, attacker: Actor, target: Actor, multiplier = 1): boolean {
  const as = combatStats(mgr, attacker);
  const ts = combatStats(mgr, target);
  if (!as || !ts) return false;
  attacker.attackCd = ATTACK_COOLDOWN_TICKS;
  const roll = 0.85 + mgr.rand() * 0.3;
  const amount = Math.max(1, Math.round((as.damage * multiplier - ts.defense) * roll));
  target.hp -= amount;
  target.hitFlash = 3;
  target.lastAttackerId = attacker.id;
  (target.damagers ??= new Map()).set(attacker.id, mgr.tick);
  attacker.facing = target.x >= attacker.x ? 1 : -1;
  mgr.stats.hits++;
  mgr.events.emit('hit', { target, attacker, amount });
  if (target.hp <= 0) {
    kill(mgr, target, attacker);
    return true;
  }
  return false;
}

export function kill(mgr: ActorManager, victim: Actor, killer: Actor | null): void {
  victim.hp = 0;
  victim.state = 'dead';
  victim.path = null;
  victim.moving = false;
  victim.targetId = null;
  victim.lastAttackerId = null;
  const lair = victim.kind === 'creature' ? mgr.area(victim)?.lair : undefined;
  const minutes = victim.kind === 'npc' ? NPC_RESPAWN_MINUTES : victim.kind === 'player' ? PLAYER_RESPAWN_MINUTES
    : lair ? lair.respawnHours * 60 : mgr.template(victim)?.respawnMinutes ?? 30;
  victim.respawnAt = mgr.gameMinutes + minutes;
  if (victim.kind === 'creature') mgr.stats.creatureKills++;
  else if (victim.kind === 'npc') mgr.stats.npcDeaths++;
  if (killer) {
    killer.targetId = null;
    if (killer.lastAttackerId === victim.id) killer.lastAttackerId = null;
  }
  mgr.events.emit('died', { victim, killer });
}

export function respawn(mgr: ActorManager, a: Actor, x: number, y: number): void {
  a.hp = a.maxHp;
  a.damagers = null;
  a.enraged = false;
  a.state = 'idle';
  a.lastAttackerId = null;
  a.attackCd = 0;
  mgr.teleport(a, x, y);
  mgr.events.emit('respawned', { actor: a });
}

/** Chase the target and attack when in range. */
export function engage(mgr: ActorManager, a: Actor, target: Actor, stats: CombatStats, onAttack?: () => number): void {
  const d = dist(a, target);
  if (d <= stats.attackRange) {
    a.state = 'attack';
    a.moving = false;
    a.path = null;
    if (a.attackCd <= 0) attack(mgr, a, target, onAttack ? onAttack() : 1);
    return;
  }
  a.state = 'chase';
  const tx = Math.floor(target.x);
  const ty = Math.floor(target.y);
  if (d < 2.2) {
    mgr.stepToward(a, target.x, target.y, stats.speed * 1.1, stats.attackRange * 0.8);
    return;
  }
  const needPath = !a.path || Math.hypot(a.goalX - tx, a.goalY - ty) > 1.5;
  if (needPath && mgr.tick >= a.nextThink) {
    a.nextThink = mgr.tick + 6;
    if (!mgr.goTo(a, tx, ty, 1500)) {
      mgr.stepToward(a, target.x, target.y, stats.speed, stats.attackRange * 0.8);
      return;
    }
  }
  if (a.path) mgr.step(a, stats.speed * 1.1);
  else mgr.stepToward(a, target.x, target.y, stats.speed, stats.attackRange * 0.8);
}

export function fightsBack(mgr: ActorManager, a: Actor): boolean {
  if (a.kind === 'player') return true;
  if (a.kind === 'creature') return (mgr.template(a)?.aggression ?? 'passive') !== 'passive';
  const d = mgr.npcDef(a);
  if (!d) return false;
  return !!getNpcType(d.type).defender || d.type === 'blacksmith' || d.type === 'trainer';
}
