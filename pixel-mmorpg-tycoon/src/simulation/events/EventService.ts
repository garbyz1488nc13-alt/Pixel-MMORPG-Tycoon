import { createId, type EntityId } from '@/core/ids';
import { EventBus } from '@/core/EventBus';
import { getEventType } from '@/data/eventTypes';
import type { ActiveEvent, EventDef, EventRecord } from '@/models/events';
import type { NpcDef, Region, SpawnArea } from '@/models/entities';
import { t } from '@/i18n';
import { EntityEditor } from '@/systems/editor/EntityEditor';
import type { ActorManager } from '../actors/ActorManager';
import type { Actor } from '../actors/Actor';
import type { PlayerManager } from '../players/PlayerManager';
import type { StudioService } from '../studio/StudioService';
import { MINUTES_PER_DAY, toGameTime } from '../time';
import type { WorldRuntime } from '../WorldRuntime';

export type WorldEventEvents = {
  started: { active: ActiveEvent; manual: boolean };
  ended: { record: EventRecord };
};

/**
 * Runs world events: checks triggers, spawns temporary content, applies effects
 * (XP multipliers, festival mood, faction war PvP) and cleans up afterwards.
 */
export class EventService {
  readonly events = new EventBus<WorldEventEvents>();
  private popAtStart = new Map<EntityId, number>();

  constructor(private world: WorldRuntime, private actors: ActorManager, private pm: PlayerManager, private studio: StudioService) {
    // Faction war scoreboard: player kills inside the war region.
    actors.events.on('died', ({ victim, killer }) => {
      if (victim.kind !== 'player' || killer?.kind !== 'player') return;
      const war = this.sim.activeEvents.find((x) => x.type === 'factionWar');
      const r = war && this.region(war);
      if (!war || !r || !this.inRegion(r, Math.floor(victim.x), Math.floor(victim.y))) return;
      if (this.faction(killer.defId) === this.faction(victim.defId)) return;
      (war.factionKills ??= [0, 0])[this.faction(killer.defId)]++;
      war.kills++;
      if (!war.participants.includes(killer.defId)) war.participants.push(killer.defId);
    });
  }

  private get sim() {
    return this.world.sim;
  }

  active(): ActiveEvent[] {
    return this.sim.activeEvents;
  }

  isRunning(defId: EntityId): boolean {
    return this.sim.activeEvents.some((a) => a.defId === defId);
  }

  def(a: ActiveEvent): EventDef | undefined {
    return this.world.entities.get('events', a.defId);
  }

  // ------------------------------------------------------------- effects
  /** Global XP multiplier (Double XP events). */
  xpMultiplier(): number {
    let m = 1;
    for (const a of this.sim.activeEvents) if (a.type === 'doubleXp') m = Math.max(m, this.def(a)?.xpMultiplier ?? 2);
    return m;
  }

  /** Extra XP for killing a monster spawned by an event; also counts the kill. */
  onEventKill(spawnAreaId: EntityId | undefined, killer: Actor | null): number {
    if (!spawnAreaId) return 1;
    const a = this.sim.activeEvents.find((x) => x.spawnAreaIds.includes(spawnAreaId));
    if (!a) return 1;
    a.kills++;
    if (killer?.kind === 'player' && !a.participants.includes(killer.defId)) a.participants.push(killer.defId);
    return this.def(a)?.xpMultiplier ?? 1.5;
  }

  region(a: ActiveEvent): Region | undefined {
    const d = this.def(a);
    return d?.regionId ? this.world.entities.get('regions', d.regionId) : undefined;
  }

  /** Active faction war region, if any. */
  warRegion(): Region | undefined {
    const a = this.sim.activeEvents.find((x) => x.type === 'factionWar');
    return a ? this.region(a) : undefined;
  }

  /** Festival region, if any (players gather there). */
  festivalRegion(): Region | undefined {
    const a = this.sim.activeEvents.find((x) => x.type === 'festival');
    return a ? this.region(a) : undefined;
  }

  /** Two factions, derived from the player id. */
  faction(playerId: EntityId): 0 | 1 {
    let h = 0;
    for (let i = 0; i < playerId.length; i++) h = (h * 31 + playerId.charCodeAt(i)) | 0;
    return (h & 1) as 0 | 1;
  }

  inRegion(r: Region, x: number, y: number): boolean {
    return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  }

  // -------------------------------------------------------------- start
  /** Why an event cannot start right now (null = it can). */
  problem(def: EventDef): string | null {
    const meta = getEventType(def.type);
    if (this.isRunning(def.id)) return t('This event is already running.');
    if (meta.needsRegion && (!def.regionId || !this.world.entities.get('regions', def.regionId))) return t('Choose a region for this event.');
    if (meta.needsTemplate && (!def.templateId || !this.world.entities.get('creatureTemplates', def.templateId))) return t('Choose a creature for this event.');
    if (this.studio.standard && this.world.studio.funds < meta.cost) return t('Not enough money: needs ${cost}, you have ${funds}.', { cost: meta.cost, funds: Math.floor(this.world.studio.funds) });
    return null;
  }

  start(defId: EntityId, manual = true): ActiveEvent | null {
    const def = this.world.entities.get('events', defId);
    if (!def || this.problem(def)) return null;
    const meta = getEventType(def.type);
    const now = this.world.clock.totalMinutes;
    const active: ActiveEvent = {
      id: createId('evt'), defId, name: def.name, type: def.type, startedAt: now, endsAt: now + def.durationHours * 60,
      spawnAreaIds: [], npcIds: [], kills: 0, participants: [],
    };
    const region = def.regionId ? this.world.entities.get('regions', def.regionId) : undefined;

    if (region && def.templateId && (def.type === 'invasion' || def.type === 'worldBoss' || def.type === 'dungeonOpening')) {
      const size = def.type === 'worldBoss' ? 4 : Math.max(6, Math.min(14, Math.ceil(Math.sqrt(def.count) * 3)));
      const w = Math.min(size, region.w), h = Math.min(size, region.h);
      const area: SpawnArea = {
        id: createId('spawn'), name: def.name, templateId: def.templateId,
        x: region.x + Math.floor((region.w - w) / 2), y: region.y + Math.floor((region.h - h) / 2), w, h,
        maxCount: def.type === 'worldBoss' ? 1 : Math.max(1, def.count), eventId: active.id,
      };
      this.world.entities.add('spawnAreas', area);
      active.spawnAreaIds.push(area.id);
    }
    if (region && def.type === 'rareMerchant') {
      const spot = this.actors.randomWalkableNear(region.x + region.w / 2, region.y + region.h / 2, Math.min(region.w, region.h) / 3);
      if (spot) {
        const npc: NpcDef = { ...EntityEditor.makeNpc('merchant', spot.x, spot.y, () => this.actors.rand(), []), name: t('Mysterious Trader'), behavior: 'stationary', workStart: 0, workEnd: 24, gold: 3000, eventId: active.id };
        const rare = this.world.entities.list('items').filter((i) => i.value > 0 && ['rare', 'epic', 'legendary'].includes(i.rarity));
        npc.shop = { enabled: true, items: rare.map((i) => ({ itemId: i.id, stock: 2 + Math.floor(this.actors.rand() * 3), maxStock: 3 })) };
        this.world.entities.add('npcs', npc);
        active.npcIds.push(npc.id);
      }
    }

    if (this.studio.standard) {
      this.world.studio.funds -= meta.cost;
      this.studio.today().build += meta.cost;
      this.world.events.emit('studio:changed', undefined);
    }
    // Announcements make the game a bit more popular right away.
    this.popAtStart.set(active.id, this.sim.popularity);
    this.sim.popularity = Math.min(100, this.sim.popularity + 1);
    this.sim.activeEvents.push(active);
    this.sim.eventLastRun[defId] = now;
    this.world.markDirty();
    this.events.emit('started', { active, manual });
    return active;
  }

  end(activeId: EntityId): EventRecord | null {
    const idx = this.sim.activeEvents.findIndex((a) => a.id === activeId);
    if (idx < 0) return null;
    const a = this.sim.activeEvents[idx];
    this.sim.activeEvents.splice(idx, 1);
    for (const id of a.spawnAreaIds) this.world.entities.remove('spawnAreas', id);
    for (const id of a.npcIds) this.world.entities.remove('npcs', id);
    const record: EventRecord = {
      name: a.name, type: a.type, startedAt: a.startedAt, endedAt: this.world.clock.totalMinutes, kills: a.kills,
      participants: a.participants.length, factionKills: a.factionKills, popularityDelta: Math.round((this.sim.popularity - (this.popAtStart.get(a.id) ?? this.sim.popularity)) * 10) / 10,
    };
    this.popAtStart.delete(a.id);
    this.sim.eventHistory.push(record);
    if (this.sim.eventHistory.length > 50) this.sim.eventHistory.shift();
    this.world.markDirty();
    this.events.emit('ended', { record });
    return record;
  }

  // ------------------------------------------------------------ triggers
  metric(m: EventDef['trigger']['metric']): number {
    const on = this.pm.online();
    switch (m) {
      case 'online': return on.length;
      case 'popularity': return this.sim.popularity;
      case 'rating': return this.sim.rating;
      case 'satisfaction': return on.length ? on.reduce((n, p) => n + p.satisfaction, 0) / on.length : 50;
      case 'day': return toGameTime(this.world.clock.totalMinutes).day;
    }
  }

  private cooledDown(def: EventDef): boolean {
    const last = this.sim.eventLastRun[def.id];
    return last === undefined || this.world.clock.totalMinutes - last >= def.trigger.cooldownHours * 60;
  }

  /** Called a few times per game hour. */
  update(prevMinutes: number): void {
    const now = this.world.clock.totalMinutes;
    for (const a of [...this.sim.activeEvents]) if (now >= a.endsAt) this.end(a.id);
    const hourChanged = Math.floor(now / 60) > Math.floor(prevMinutes / 60);
    if (!hourChanged || !this.world.feature('events')) return;
    const time = toGameTime(now);
    for (const def of this.world.entities.list('events')) {
      if (!def.enabled || this.isRunning(def.id) || !this.cooledDown(def)) continue;
      const tr = def.trigger;
      if (tr.kind === 'schedule') {
        const dayOk = (time.day - 1) % Math.max(1, tr.everyDays) === 0;
        if (dayOk && time.hour === tr.hour) this.start(def.id, false);
      } else if (tr.kind === 'condition') {
        const v = this.metric(tr.metric);
        if (tr.op === '<' ? v < tr.value : v > tr.value) this.start(def.id, false);
      }
    }
  }

  /** Hourly mood effects of running events. */
  hourly(): void {
    for (const a of this.sim.activeEvents) {
      const r = this.region(a);
      for (const p of this.pm.online()) {
        const actor = this.actors.actors.get(p.id);
        const inside = r && actor && this.inRegion(r, Math.floor(actor.x), Math.floor(actor.y));
        if (a.type === 'festival') {
          this.pm.feel(p, 'event', inside ? 1 : 0.3);
          if (inside && !a.participants.includes(p.id)) a.participants.push(p.id);
        } else if (a.type === 'doubleXp') {
          this.pm.feel(p, 'event', 0.5);
          if (!a.participants.includes(p.id)) a.participants.push(p.id);
        } else if (inside) {
          this.pm.feel(p, 'event', 0.5);
          if (!a.participants.includes(p.id)) a.participants.push(p.id);
        }
      }
      if (a.type === 'festival') this.sim.popularity = Math.min(100, this.sim.popularity + 0.5);
      if (a.type === 'doubleXp') this.sim.popularity = Math.min(100, this.sim.popularity + 0.3);
    }
  }

  /** Default starter events for a new world. */
  static starterEvents(world: WorldRuntime): EventDef[] {
    const regions = world.entities.list('regions');
    const town = regions.find((r) => ['village', 'town', 'city'].includes(r.type));
    const wild = regions.find((r) => r.type === 'wilderness' || r.type === 'forest');
    const goblin = world.entities.list('creatureTemplates').find((c) => c.type === 'goblin');
    const base = { enabled: true, count: 0, xpMultiplier: 1, templateId: null, regionId: null };
    const trig = (kind: EventDef['trigger']['kind'], extra: Partial<EventDef['trigger']> = {}): EventDef['trigger'] => ({ kind, everyDays: 7, hour: 18, metric: 'satisfaction', op: '<', value: 45, cooldownHours: 48, ...extra });
    const out: EventDef[] = [
      { ...base, id: createId('evdef'), name: t('Weekend Double XP'), type: 'doubleXp', durationHours: 6, xpMultiplier: 2, trigger: trig('schedule', { everyDays: 7, hour: 18 }) },
      { ...base, id: createId('evdef'), name: t('Harvest Festival'), type: 'festival', durationHours: 6, regionId: town?.id ?? null, trigger: trig('condition', { metric: 'satisfaction', op: '<', value: 45, cooldownHours: 48 }) },
    ];
    if (town && goblin) out.push({ ...base, id: createId('evdef'), name: t('Goblin Raid'), type: 'invasion', durationHours: 4, regionId: town.id, templateId: goblin.id, count: 8, xpMultiplier: 1.5, trigger: trig('manual') });
    if (wild) out.push({ ...base, id: createId('evdef'), name: t('Travelling Merchant'), type: 'rareMerchant', durationHours: 8, regionId: town?.id ?? wild.id, trigger: trig('schedule', { everyDays: 3, hour: 10 }) });
    return out;
  }

  static dayOf(minutes: number): number {
    return Math.floor(minutes / MINUTES_PER_DAY) + 1;
  }

  dispose(): void {
    this.events.clear();
  }
}
