import type { EntityId } from '@/core/ids';
import { getBehavior } from '@/data/playerTypes';
import { GATHER_SOURCES } from '@/data/rpgDefaults';
import { getRegionType } from '@/data/regionTypes';
import type { PlayerState } from '@/models/sim';
import { totalUnits } from '@/systems/rpg/inventory';
import { sellPrice } from '@/systems/rpg/pricing';
import type { ActorManager } from '../actors/ActorManager';
import type { Actor } from '../actors/Actor';
import type { EconomyService } from '../economy/EconomyService';
import type { WorldRuntime } from '../WorldRuntime';
import type { PlayerManager } from './PlayerManager';
import type { EventService } from '../events/EventService';
import type { ClanService } from '../clans/ClanService';

export type Activity =
  | { kind: 'hunt'; areaId: EntityId; templateId?: EntityId }
  | { kind: 'gather'; itemId: EntityId; kinds: string[]; objectId?: EntityId; timer: number; done: number }
  | { kind: 'npc'; npcId: EntityId; purpose: 'accept' | 'turnin' | 'talk' | 'deliver'; questId?: EntityId }
  | { kind: 'trade'; merchantId: EntityId; buyItemId?: EntityId }
  | { kind: 'explore'; regionId: EntityId; x: number; y: number }
  | { kind: 'rest'; x: number; y: number }
  | { kind: 'social'; x: number; y: number; ticks: number }
  | { kind: 'pvp'; targetId: string; ticks: number }
  | { kind: 'idle'; ticks: number }
  | { kind: 'raid'; raidId: EntityId };

/** Activity labels for the UI (English source strings). */
export const ACTIVITY_LABEL: Record<Activity['kind'], string> = {
  hunt: 'Hunting', gather: 'Gathering', npc: 'Talking to NPC', trade: 'Trading', explore: 'Exploring',
  rest: 'Resting', social: 'Socialising', pvp: 'Hunting players', idle: 'Idle', raid: 'Raiding a boss',
};

/**
 * Utility AI: scores every possible activity from the player's needs and
 * personality, then picks the best one (with a little randomness and inertia).
 */
export class PlayerBrain {
  /** World events (festival / faction war attraction). */
  events: EventService | null = null;
  /** Clans & raids (raid members drop everything to go raiding). */
  clans: ClanService | null = null;

  constructor(private world: WorldRuntime, private actors: ActorManager, private pm: PlayerManager, private econ: EconomyService) {}

  private rand() {
    return this.actors.rand();
  }

  isSafe(x: number, y: number): boolean {
    return this.world.entities.list('regions').some((r) => getRegionType(r.type).safe && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);
  }

  /** Spawn areas worth hunting for this player, best first. */
  huntingAreas(p: PlayerState, templateId?: EntityId): { areaId: EntityId; score: number; diff: number }[] {
    const out: { areaId: EntityId; score: number; diff: number }[] = [];
    const a = this.actors.actors.get(p.id);
    for (const area of this.world.entities.list('spawnAreas')) {
      const tpl = this.world.entities.get('creatureTemplates', area.templateId);
      if (!tpl || area.maxCount <= 0) continue;
      // Boss lairs are raid content: nobody solos them (raids are organised by RaidService).
      if (area.lair) continue;
      if (templateId && tpl.id !== templateId) continue;
      const diff = tpl.level - p.level;
      const hunters = this.pm.huntersIn(area.id);
      const crowd = hunters / Math.max(1, area.maxCount);
      const distance = a ? Math.hypot(area.x + area.w / 2 - a.x, area.y + area.h / 2 - a.y) : 0;
      // Event monsters (invasions, bosses, dungeons) draw a crowd regardless of level.
      const fit = templateId ? 1 : area.eventId ? 0.85 : diff >= -4 && diff <= 2 ? 1 - Math.abs(diff + 1) * 0.12 : diff > 2 ? 0.15 / diff : 0.2;
      out.push({ areaId: area.id, diff, score: fit - Math.min(0.6, crowd * 0.25) - distance / 400 });
    }
    return out.sort((x, y) => y.score - x.score);
  }

  /** Turn the first unfinished objective of a quest into an activity. */
  questActivity(p: PlayerState): Activity | null {
    for (const pq of p.quests) {
      if (pq.status !== 'active') continue;
      const q = this.world.entities.get('quests', pq.questId);
      if (!q) continue;
      for (let i = 0; i < q.objectives.length; i++) {
        const o = q.objectives[i];
        if ((pq.counts[i] ?? 0) >= o.count || !o.targetId) continue;
        switch (o.type) {
          case 'kill':
          case 'boss': {
            const best = this.huntingAreas(p, o.targetId)[0];
            if (best) return { kind: 'hunt', areaId: best.areaId, templateId: o.targetId };
            break;
          }
          case 'explore': {
            const r = this.world.entities.get('regions', o.targetId);
            const spot = r && this.actors.randomTileInArea({ ...r, id: r.id, name: '', templateId: '', maxCount: 0 });
            if (r && spot) return { kind: 'explore', regionId: r.id, x: spot.x, y: spot.y };
            break;
          }
          case 'talk':
            return { kind: 'npc', npcId: o.targetId, purpose: 'talk', questId: q.id };
          case 'deliver':
            if (o.receiverId && this.pm.countItem(p, o.targetId) >= o.count) return { kind: 'npc', npcId: o.receiverId, purpose: 'deliver', questId: q.id };
            return this.obtainItem(p, o.targetId);
          case 'collect':
          case 'gather':
            return this.obtainItem(p, o.targetId, o.type === 'gather');
        }
      }
    }
    return null;
  }

  /** Best way to get an item: gather it, hunt something that drops it, or buy it. */
  obtainItem(p: PlayerState, itemId: EntityId, preferGather = false): Activity | null {
    const item = this.world.entities.get('items', itemId);
    const kinds = Object.entries(GATHER_SOURCES).filter(([, k]) => k === item?.key).map(([kind]) => kind);
    if (kinds.length && (preferGather || this.rand() < 0.5)) return { kind: 'gather', itemId, kinds, timer: 0, done: 0 };
    for (const tpl of this.world.entities.list('creatureTemplates')) {
      if (!tpl.loot.some((l) => l.itemId === itemId)) continue;
      const best = this.huntingAreas(p, tpl.id)[0];
      if (best) return { kind: 'hunt', areaId: best.areaId, templateId: tpl.id };
    }
    const seller = this.econ.merchants().find((m) => m.shop.items.some((s) => s.itemId === itemId && s.stock > 0));
    if (seller) return { kind: 'trade', merchantId: seller.id, buyItemId: itemId };
    if (kinds.length) return { kind: 'gather', itemId, kinds, timer: 0, done: 0 };
    return null;
  }

  private safeSpot(a: Actor): { x: number; y: number } {
    const safe = this.world.entities.list('regions').filter((r) => getRegionType(r.type).safe);
    let best = safe[0];
    let bd = Infinity;
    for (const r of safe) { const d = Math.hypot(r.x + r.w / 2 - a.x, r.y + r.h / 2 - a.y); if (d < bd) { bd = d; best = r; } }
    if (best) {
      const p = this.actors.randomWalkableNear(best.x + best.w / 2, best.y + best.h / 2, Math.min(best.w, best.h) / 3);
      if (p) return p;
    }
    return this.pm.spawnPoint();
  }

  /** Something worth buying: potions or a gear upgrade the player can afford. */
  shoppingTarget(p: PlayerState): { merchantId: EntityId; itemId: EntityId } | null {
    const eco = this.world.rpg.economy;
    let best: { merchantId: EntityId; itemId: EntityId; gain: number } | null = null;
    for (const m of this.econ.merchants()) {
      if (this.actors.actors.get(m.id)?.state === 'dead') continue;
      for (const s of m.shop.items) {
        if (s.stock <= 0) continue;
        const it = this.world.entities.get('items', s.itemId);
        if (!it) continue;
        const price = sellPrice(it, s, eco);
        if (price > p.gold) continue;
        let gain = 0;
        if (it.slot !== 'none' && it.levelReq <= p.level) {
          const cur = p.equipment[it.slot] ? this.world.entities.get('items', p.equipment[it.slot]!) : undefined;
          gain = this.pm.itemScore(it) - (cur ? this.pm.itemScore(cur) : 0);
        } else if (it.category === 'potion' && (it.stats.heal ?? 0) > 0 && this.healingCount(p) < 2) gain = 3;
        if (gain > 0 && (!best || gain > best.gain)) best = { merchantId: m.id, itemId: it.id, gain };
      }
    }
    return best;
  }

  healingCount(p: PlayerState): number {
    return p.inventory.reduce((n, s) => {
      const it = this.world.entities.get('items', s.itemId);
      return n + (it && (it.category === 'potion' || it.category === 'food') && (it.stats.heal ?? 0) > 0 ? s.qty : 0);
    }, 0);
  }

  /** Choose the next activity. */
  plan(p: PlayerState, a: Actor, current: Activity | null): Activity {
    const w = getBehavior(p.behavior).weights;
    const hpPct = a.hp / Math.max(1, a.maxHp);
    const options: [number, () => Activity | null][] = [];
    const add = (kind: Activity['kind'], score: number, make: () => Activity | null) =>
      options.push([score + this.rand() * 0.15 + (current?.kind === kind ? 0.08 : 0), make]);

    const raid = this.clans?.raidOf(p.id);
    if (raid) add('raid', 2, () => ({ kind: 'raid', raidId: raid.id }));
    if (hpPct < 0.35) add('rest', 1, () => ({ kind: 'rest', ...this.safeSpot(a) }));

    const complete = p.quests.find((q) => q.status === 'complete');
    if (complete) {
      const q = this.world.entities.get('quests', complete.questId);
      if (q?.giverId) add('npc', 0.95, () => ({ kind: 'npc', npcId: q.giverId!, purpose: 'turnin', questId: q.id }));
    }
    const active = p.quests.filter((q) => q.status === 'active');
    const avail = this.pm.availableQuests(p);
    if (avail.length && active.length < 3) {
      const nearest = avail.sort((x, y) => this.distTo(a, x.giverId!) - this.distTo(a, y.giverId!))[0];
      add('npc', 0.45 + 0.4 * w.quest, () => ({ kind: 'npc', npcId: nearest.giverId!, purpose: 'accept', questId: nearest.id }));
    } else if (!avail.length && !active.length && w.quest > 1 && this.rand() < 0.3) this.pm.feel(p, 'noQuests');
    if (active.length) add('hunt', 0.45 + 0.4 * w.quest, () => this.questActivity(p));

    const sellable = totalUnits(this.econ.sellable({ inventory: p.inventory } as never));
    const slotsUsed = p.inventory.length;
    if (slotsUsed >= 18 || sellable >= 15 || (sellable >= 6 && w.trade > 1)) {
      add('trade', slotsUsed >= 20 ? 0.9 : 0.35 + 0.35 * w.trade, () => {
        const m = this.econ.pickMerchant(a);
        return m ? { kind: 'trade', merchantId: m.id } : null;
      });
    }
    const shop = p.gold > 15 ? this.shoppingTarget(p) : null;
    if (shop) add('trade', 0.5, () => ({ kind: 'trade', merchantId: shop.merchantId, buyItemId: shop.itemId }));

    const areas = this.huntingAreas(p);
    const eventAreas = new Set(this.world.entities.list('spawnAreas').filter((s) => s.eventId).map((s) => s.id));
    const fitting = areas.filter((x) => (x.diff >= -4 && x.diff <= 2) || eventAreas.has(x.areaId));
    if (fitting.length) add('hunt', 0.35 + 0.45 * w.fight, () => ({ kind: 'hunt', areaId: fitting[0].areaId }));
    else if (areas.length) {
      if (w.fight > 0.5) this.pm.feel(p, areas.every((x) => x.diff > 2) ? 'tooHard' : 'noContent', 0.5);
      add('hunt', 0.15 + 0.2 * w.fight, () => ({ kind: 'hunt', areaId: areas[0].areaId }));
    }

    if (w.gather > 0.2 && this.world.entities.list('objects').some((o) => GATHER_SOURCES[o.kind])) {
      add('gather', 0.1 + 0.35 * w.gather, () => {
        const keys = [...new Set(Object.values(GATHER_SOURCES))];
        const key = keys[Math.floor(this.rand() * keys.length)];
        const item = this.world.entities.list('items').find((i) => i.key === key);
        if (!item) return null;
        return { kind: 'gather', itemId: item.id, kinds: Object.entries(GATHER_SOURCES).filter(([, k]) => k === key).map(([o]) => o), timer: 0, done: 0 };
      });
    }

    const unvisited = this.world.entities.list('regions').filter((r) => !p.visitedRegions.includes(r.id));
    if (unvisited.length) {
      add('explore', 0.15 + 0.5 * w.explore, () => {
        const r = unvisited[Math.floor(this.rand() * unvisited.length)];
        const spot = this.actors.randomTileInArea({ ...r, templateId: '', maxCount: 0 });
        return spot ? { kind: 'explore', regionId: r.id, x: spot.x, y: spot.y } : null;
      });
    } else if (w.explore > 1) this.pm.feel(p, 'boredom', 0.5);

    const festival = this.events?.festivalRegion();
    if (festival) {
      add('social', 0.45 + 0.4 * w.social, () => {
        const spot = this.actors.randomTileInArea({ ...festival, templateId: '', maxCount: 0 });
        return spot ? { kind: 'social', x: spot.x, y: spot.y, ticks: 0 } : null;
      });
    } else add('social', 0.12 + 0.35 * w.social, () => ({ kind: 'social', ...this.safeSpot(a), ticks: 0 }));

    // Faction war: fighters and PvP players join the battle against the other faction.
    const war = this.events?.warRegion();
    if (war && (w.pvp > 0 || w.fight > 1)) {
      const ev = this.events!;
      const mine = ev.faction(p.id);
      const enemies = this.actors.spatial.query(war.x + war.w / 2, war.y + war.h / 2, Math.max(war.w, war.h)).filter((o) =>
        o.kind === 'player' && o.state !== 'dead' && ev.faction(o.defId) !== mine && ev.inRegion(war, Math.floor(o.x), Math.floor(o.y)));
      if (enemies.length) add('pvp', 0.55 + 0.4 * Math.max(w.pvp, w.fight - 0.5), () => ({ kind: 'pvp', targetId: enemies[Math.floor(this.rand() * enemies.length)].id, ticks: 0 }));
      else add('explore', 0.4 + 0.3 * w.fight, () => {
        const spot = this.actors.randomTileInArea({ ...war, templateId: '', maxCount: 0 });
        return spot ? { kind: 'explore', regionId: war.id, x: spot.x, y: spot.y } : null;
      });
    }

    const griefer = p.cheat === 'griefer';
    if (w.pvp > 0 || griefer) {
      const victims = this.actors.spatial.query(a.x, a.y, 14).filter((o) => o.kind === 'player' && o.id !== a.id && o.state !== 'dead' && (griefer || !this.isSafe(Math.floor(o.x), Math.floor(o.y))));
      if (victims.length) add('pvp', griefer ? 1.2 : 0.25 + 0.5 * w.pvp, () => ({ kind: 'pvp', targetId: victims[Math.floor(this.rand() * victims.length)].id, ticks: 0 }));
    }

    options.sort((x, y) => y[0] - x[0]);
    for (const [, make] of options) {
      const act = make();
      if (act) return act;
    }
    return { kind: 'idle', ticks: 0 };
  }

  private distTo(a: Actor, npcId: EntityId): number {
    const n = this.actors.actors.get(npcId);
    return n ? Math.hypot(n.x - a.x, n.y - a.y) : 1e9;
  }
}
