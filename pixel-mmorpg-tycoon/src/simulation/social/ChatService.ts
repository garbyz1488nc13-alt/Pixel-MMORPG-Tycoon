import { CHAT, EMOTES } from '@/data/chatLines';
import type { PlayerState } from '@/models/sim';
import { isAlive, type Actor } from '../actors/Actor';
import type { ActorManager } from '../actors/ActorManager';
import type { ClanService } from '../clans/ClanService';
import type { AuctionService } from '../liveops/AuctionService';
import type { PatchService } from '../liveops/PatchService';
import type { PlayerManager } from '../players/PlayerManager';
import type { SimContext, SimulationSystem } from '../types';
import type { WorldRuntime } from '../WorldRuntime';

/** A speech bubble / chat line: an English source key (or emote) + params. */
export interface ChatLine { actorId: string; name: string; key: string; params?: Record<string, string | number>; at: number }

/** Ticks a bubble stays above a head. */
export const BUBBLE_TICKS = 45;

/**
 * Players talk: small talk and trade calls with whoever is nearby (with replies),
 * emotes, and reactions to what happens to them (level-ups, deaths, raids, sales).
 */
export class ChatService implements SimulationSystem {
  readonly id = 'chat';
  readonly interval = 5;
  /** Current bubble per actor. */
  readonly bubbles = new Map<string, ChatLine & { until: number }>();
  /** Recent server chat (newest last). */
  readonly log: ChatLine[] = [];
  private pending: { at: number; actorId: string; key: string; params?: Record<string, string | number> }[] = [];
  private near: Actor[] = [];
  private unsubs: (() => void)[] = [];

  constructor(private world: WorldRuntime, private actors: ActorManager, private pm: PlayerManager, clans?: ClanService, auction?: AuctionService, patches?: PatchService) {
    const say = (playerId: string, cat: string, params?: Record<string, string | number>, chance = 1) => {
      if (this.actors.rand() < chance) this.say(playerId, this.pick(cat), params);
    };
    this.unsubs.push(
      pm.events.on('levelUp', ({ player, level }) => {
        say(player.id, 'levelUp', { n: level }, 0.8);
        const a = actors.actors.get(player.id);
        if (a) for (const o of this.neighbours(a, 6).slice(0, 2)) this.later(o.id, 'levelUpReply', 10 + Math.floor(actors.rand() * 15));
      }),
      pm.events.on('questDone', ({ player }) => say(player.id, 'quest', undefined, 0.3)),
      actors.events.on('died', ({ victim, killer }) => {
        if (victim.kind === 'player') say(victim.defId, 'death', undefined, 0.6);
        if (victim.kind === 'player' && killer?.kind === 'player') say(killer.defId, 'pvpWin', undefined, 0.7);
      }),
    );
    if (clans) this.unsubs.push(
      clans.events.on('raidPulled', ({ raid }) => raid.members.slice(0, 3).forEach((id, i) => this.later(id, 'raidPull', i * 4))),
      clans.events.on('raidEnded', ({ record }) => {
        if (record.result === 'abandoned') return;
        const cat = record.result === 'win' ? 'raidWin' : 'wipe';
        // Everyone near the lair shouts.
        const area = world.entities.get('spawnAreas', record.lairId);
        if (!area) return;
        for (const o of actors.spatial.query(area.x + area.w / 2, area.y + area.h / 2, 14)) if (o.kind === 'player' && actors.rand() < 0.6) this.later(o.defId, cat, Math.floor(actors.rand() * 12));
      }),
      clans.events.on('founded', ({ founder }) => say(founder.id, 'clan')),
    );
    if (auction) this.unsubs.push(auction.events.on('sale', ({ sale }) => {
      const seller = pm.online().find((p) => p.name === sale.seller);
      if (seller) say(seller.id, 'sold', undefined, 0.25);
    }));
    if (patches) this.unsubs.push(patches.events.on('released', () => {
      for (const p of pm.online()) if (actors.rand() < 0.15) this.later(p.id, 'patch', Math.floor(actors.rand() * 30));
    }));
  }

  private pick(cat: string): string {
    const list = CHAT[cat] ?? EMOTES;
    return list[Math.floor(this.actors.rand() * list.length)];
  }

  private neighbours(a: Actor, r: number): Actor[] {
    this.near.length = 0;
    this.actors.spatial.query(a.x, a.y, r, this.near);
    return this.near.filter((o) => o.kind === 'player' && o.id !== a.id && isAlive(o));
  }

  private later(actorId: string, cat: string, ticks: number, params?: Record<string, string | number>): void {
    this.pending.push({ at: this.actors.tick + ticks, actorId, key: this.pick(cat), params });
  }

  /** Put a line above a player's head and into the server chat. */
  say(playerId: string, key: string, params?: Record<string, string | number>): void {
    const a = this.actors.actors.get(playerId);
    const p = this.pm.get(playerId);
    if (!a || !p || !isAlive(a)) return;
    const line: ChatLine = { actorId: a.id, name: p.name, key, params, at: this.actors.gameMinutes };
    this.bubbles.set(a.id, { ...line, until: this.actors.tick + BUBBLE_TICKS });
    this.log.push(line);
    if (this.log.length > 80) this.log.shift();
  }

  update(ctx: SimContext): void {
    const tick = ctx.tick;
    for (const [id, b] of this.bubbles) if (b.until <= tick || !this.actors.actors.has(id)) this.bubbles.delete(id);
    for (const m of [...this.pending]) if (m.at <= tick) { this.pending.splice(this.pending.indexOf(m), 1); this.say(m.actorId, m.key, m.params); }
    // Small talk: a few random players start a conversation with someone nearby.
    const online = this.pm.online();
    if (!online.length) return;
    const tries = Math.max(1, Math.round(online.length / 40));
    for (let i = 0; i < tries; i++) {
      if (this.actors.rand() > 0.35) continue;
      const p: PlayerState = online[Math.floor(this.actors.rand() * online.length)];
      const a = this.actors.actors.get(p.id);
      if (!a || !isAlive(a) || this.bubbles.has(a.id) || a.targetId) continue;
      const others = this.neighbours(a, 5);
      if (this.world.sim.patches.bugs > 0 && this.actors.rand() < Math.min(0.3, this.world.sim.patches.bugs * 0.03)) { this.say(p.id, this.pick('bug')); continue; }
      if (!others.length) { if (this.actors.rand() < 0.2) this.say(p.id, EMOTES[Math.floor(this.actors.rand() * EMOTES.length)]); continue; }
      const topic = p.behavior === 'trader' ? 'trade' : ['greet', 'ask', 'joke', 'greet'][Math.floor(this.actors.rand() * 4)];
      this.say(p.id, this.pick(topic));
      const other = others[Math.floor(this.actors.rand() * others.length)];
      this.later(other.defId, `${topic}Reply`, 12 + Math.floor(this.actors.rand() * 10));
      if (this.actors.rand() < 0.3) this.later(p.id, 'emote', 30);
    }
  }

  dispose(): void {
    this.unsubs.forEach((u) => u());
  }
}
