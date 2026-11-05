import { createId, type EntityId } from '@/core/ids';
import { EventBus } from '@/core/EventBus';
import type { PlayerState } from '@/models/sim';
import { isAlive } from '../actors/Actor';
import type { ActorManager } from '../actors/ActorManager';
import type { ClanService } from '../clans/ClanService';
import type { PlayerManager } from '../players/PlayerManager';
import type { SimContext, SimulationSystem } from '../types';
import type { WorldRuntime } from '../WorldRuntime';
import type { ChatService } from './ChatService';

/** What a group of players gets together to sort out. */
export type MeetupTopic = 'trade' | 'clan' | 'party' | 'gossip' | 'raid';
export const MEETUP_TOPICS: MeetupTopic[] = ['trade', 'clan', 'party', 'gossip', 'raid'];

export interface Meetup {
  id: EntityId;
  topic: MeetupTopic;
  x: number;
  y: number;
  members: EntityId[];
  /** Tick the talking starts (everyone had time to arrive) and ends. */
  startsAt: number;
  endsAt: number;
  nextLine: number;
}

export type MeetupEvents = {
  started: { meetup: Meetup; place: string };
  ended: { meetup: Meetup; outcome: string; params: Record<string, string | number> };
};

/** Landmarks players like to meet at. */
const SPOTS = new Set(['statue', 'well', 'campfire', 'sign', 'bench', 'banner', 'stall', 'fountain', 'tavern', 'portal']);

/**
 * Meetups: now and then a handful of players gather at a random landmark and talk
 * something over — a trade, joining a clan, forming a party, planning a raid or
 * just gossip. The talk shows as chat bubbles, and the deal really happens.
 */
export class MeetupService implements SimulationSystem {
  readonly id = 'meetups';
  readonly interval = 5;
  readonly events = new EventBus<MeetupEvents>();
  readonly active: Meetup[] = [];
  /** Hand an activity to a player (set by the session: the player system's mind). */
  assign: (playerId: EntityId, meetup: Meetup, slot: number) => void = () => undefined;
  /** Release players when the meetup ends. */
  release: (playerId: EntityId) => void = () => undefined;
  /** Whether a player is free to join (not raiding, fighting…). */
  isFree: (playerId: EntityId) => boolean = () => true;
  private nextMeetupAt = 0;

  constructor(private world: WorldRuntime, private actors: ActorManager, private pm: PlayerManager, private chat: ChatService, private clans?: ClanService) {}

  private rand() {
    return this.actors.rand();
  }

  meetupOf(playerId: EntityId): Meetup | undefined {
    return this.active.find((m) => m.members.includes(playerId));
  }

  /** Where people stand around the meeting point. */
  slotPos(m: Meetup, slot: number): { x: number; y: number } {
    const ang = (slot / Math.max(1, m.members.length)) * Math.PI * 2;
    return { x: Math.round(m.x + Math.cos(ang) * 1.6), y: Math.round(m.y + Math.sin(ang) * 1.2) };
  }

  /** Try to start a meetup now (also used by tests). */
  start(force = false): Meetup | null {
    const online = this.pm.online().filter((p) => this.isFree(p.id) && !this.meetupOf(p.id));
    if (online.length < 4 && !force) return null;
    // A landmark, or a crossroads, or just somewhere outdoors near people.
    const objs = this.world.entities.list('objects').filter((o) => SPOTS.has(o.kind) || o.kind === 'road');
    const anchor = online[Math.floor(this.rand() * online.length)];
    const anchorActor = anchor && this.actors.actors.get(anchor.id);
    if (!anchorActor) return null;
    const nearby = objs.filter((o) => Math.hypot(o.x - anchorActor.x, o.y - anchorActor.y) < 35);
    const spotObj = nearby.length ? nearby[Math.floor(this.rand() * nearby.length)] : null;
    const spot = this.actors.randomWalkableNear((spotObj?.x ?? anchorActor.x) + 0.5, (spotObj?.y ?? anchorActor.y) + 2, 2);
    if (!spot) return null;
    const members = online
      .map((p) => ({ p, a: this.actors.actors.get(p.id) }))
      .filter((x) => x.a && isAlive(x.a) && !x.a.targetId && Math.hypot(x.a.x - spot.x, x.a.y - spot.y) < 40)
      .sort(() => this.rand() - 0.5)
      .slice(0, 3 + Math.floor(this.rand() * 4))
      .map((x) => x.p.id);
    if (members.length < 3) return null;
    const topic = MEETUP_TOPICS[Math.floor(this.rand() * MEETUP_TOPICS.length)];
    const tick = this.actors.tick;
    const m: Meetup = { id: createId('meet'), topic, x: spot.x, y: spot.y, members, startsAt: tick + 120, endsAt: tick + 120 + 160 + Math.floor(this.rand() * 80), nextLine: tick + 120 };
    this.active.push(m);
    members.forEach((id, i) => this.assign(id, m, i));
    this.events.emit('started', { meetup: m, place: spotObj?.kind ?? 'field' });
    return m;
  }

  update(ctx: SimContext): void {
    const tick = ctx.tick;
    if (tick >= this.nextMeetupAt) {
      this.nextMeetupAt = tick + 400 + Math.floor(this.rand() * 600);
      if (this.active.length < 3) this.start();
    }
    for (const m of [...this.active]) {
      m.members = m.members.filter((id) => this.pm.get(id)?.online);
      if (m.members.length < 2) { this.finish(m, false); continue; }
      if (tick >= m.nextLine && tick >= m.startsAt) {
        m.nextLine = tick + 18 + Math.floor(this.rand() * 14);
        const here = m.members.filter((id) => { const a = this.actors.actors.get(id); return a && Math.hypot(a.x - m.x, a.y - m.y) < 4; });
        const speaker = here[Math.floor(this.rand() * here.length)];
        if (speaker) this.chat.say(speaker, this.chat.line(`meet_${m.topic}`));
      }
      if (tick >= m.endsAt) this.finish(m, true);
    }
  }

  /** The deal: apply what they agreed on. */
  private finish(m: Meetup, done: boolean): void {
    this.active.splice(this.active.indexOf(m), 1);
    const ps = m.members.map((id) => this.pm.get(id)).filter((p): p is PlayerState => !!p);
    for (const p of ps) this.release(p.id);
    if (!done || ps.length < 2) return;
    let outcome = 'They chatted and went their separate ways.';
    const params: Record<string, string | number> = { n: ps.length };
    switch (m.topic) {
      case 'trade': {
        // The richest buys something from someone who has loot to sell.
        const buyer = [...ps].sort((a, b) => b.gold - a.gold)[0];
        const seller = ps.find((p) => p !== buyer && p.inventory.length);
        const stack = seller?.inventory.find((s) => { const it = this.world.entities.get('items', s.itemId); return it && it.value > 0 && it.category !== 'quest'; });
        const it = stack && this.world.entities.get('items', stack.itemId);
        if (seller && stack && it) {
          const price = Math.max(1, Math.round(it.value * 1.2));
          if (buyer.gold >= price && this.pm.giveItem(buyer, it.id, 1)) {
            seller.inventory = seller.inventory.map((s) => (s === stack ? { ...s, qty: s.qty - 1 } : s)).filter((s) => s.qty > 0);
            buyer.gold -= price; seller.gold += price;
            this.pm.feel(buyer, 'trade'); this.pm.feel(seller, 'trade');
            outcome = '{seller} sold {item} to {buyer} for {price} gold.';
            Object.assign(params, { seller: seller.name, buyer: buyer.name, item: it.name, price });
          }
        }
        break;
      }
      case 'clan': {
        const clan = this.clans && ps.map((p) => this.clans!.clanOf(p)).find((c) => !!c);
        const recruit = ps.find((p) => !p.clanId);
        if (clan && recruit && this.clans) {
          this.clans.join(recruit, clan);
          outcome = '{name} was recruited into [{tag}] {clan}.';
          Object.assign(params, { name: recruit.name, tag: clan.tag, clan: clan.name });
        }
        break;
      }
      case 'party':
        for (const p of ps) this.pm.feel(p, 'social', 2);
        outcome = '{n} players teamed up to hunt together.';
        break;
      case 'raid':
        for (const p of ps) this.pm.feel(p, 'social', 1);
        outcome = '{n} players planned a raid for tonight.';
        break;
      case 'gossip':
        for (const p of ps) this.pm.feel(p, 'social', 1.5);
        outcome = '{n} players gossiped about the latest patch.';
        break;
    }
    this.events.emit('ended', { meetup: m, outcome, params });
  }
}
