import { EventBus } from '@/core/EventBus';
import { getBehavior } from '@/data/playerTypes';
import { t } from '@/i18n';
import type { ClassKey } from '@/models/rpg';
import type { PatchNote, PatchRecord } from '@/models/sim';
import type { PlayerManager } from '../players/PlayerManager';
import type { StudioService } from '../studio/StudioService';
import type { WorldRuntime } from '../WorldRuntime';

export type PatchEvents = { released: { record: PatchRecord } };

export interface PatchDraft {
  buff: ClassKey | null;
  nerf: ClassKey | null;
  levelCap: boolean;
  /** -1 slower, 0 same, +1 faster levelling. */
  xp: -1 | 0 | 1;
  bugfix: boolean;
}

/** Content kinds counted for patch notes and their hype weight. */
const CONTENT: { key: string; label: string; weight: number }[] = [
  { key: 'regions', label: '{n} new regions', weight: 2 },
  { key: 'lairs', label: '{n} new raid bosses', weight: 4 },
  { key: 'spawns', label: '{n} new monster areas', weight: 1 },
  { key: 'quests', label: '{n} new quests', weight: 1 },
  { key: 'events', label: '{n} new world events', weight: 1.5 },
  { key: 'items', label: '{n} new items', weight: 0.5 },
  { key: 'npcs', label: '{n} new NPCs', weight: 0.3 },
  { key: 'objects', label: '{n} new buildings & decorations', weight: 0.02 },
];

/** Minimum game minutes between two patches. */
export const PATCH_COOLDOWN = 12 * 60;
export const PATCH_BASE_COST = 150;
export const PATCH_COST_PER_HYPE = 15;

/**
 * Live patches: ship what you built since the last patch plus balance changes.
 * New content brings hype (popularity, returning players) — and bugs, unless you
 * spend a patch on fixes. Players react to buffs, nerfs, level caps and XP rates.
 */
export class PatchService {
  readonly events = new EventBus<PatchEvents>();

  constructor(private world: WorldRuntime, private pm: PlayerManager, private studio: StudioService, public rand: () => number) {
    if (!Object.keys(this.state.snapshot).length) this.state.snapshot = this.counts();
  }

  get state() {
    return this.world.sim.patches;
  }

  /** Treat everything that exists now as already shipped (after world generation). */
  resetSnapshot(): void {
    this.state.snapshot = this.counts();
  }

  version(): string {
    return `${this.state.major}.${this.state.minor}`;
  }

  private counts(): Record<string, number> {
    const s = this.world.entities;
    const areas = s.list('spawnAreas').filter((a) => !a.eventId);
    return {
      regions: s.count('regions'), lairs: areas.filter((a) => a.lair).length, spawns: areas.filter((a) => !a.lair).length,
      quests: s.count('quests'), events: s.count('events'), items: s.count('items'), npcs: s.list('npcs').filter((n) => !n.eventId).length, objects: s.count('objects'),
    };
  }

  /** What is new since the last patch. */
  newContent(): { key: string; label: string; n: number }[] {
    const now = this.counts();
    return CONTENT.map((c) => ({ key: c.key, label: c.label, n: Math.max(0, (now[c.key] ?? 0) - (this.state.snapshot[c.key] ?? 0)) })).filter((c) => c.n > 0);
  }

  hype(): number {
    return Math.round(this.newContent().reduce((n, c) => n + c.n * (CONTENT.find((x) => x.key === c.key)!.weight), 0) * 10) / 10;
  }

  cost(draft: PatchDraft): number {
    if (!this.studio.standard) return 0;
    return Math.round(PATCH_BASE_COST + this.hype() * PATCH_COST_PER_HYPE + (draft.bugfix ? this.state.bugs * 20 : 0));
  }

  cooldownLeft(): number {
    return this.state.lastAt === null ? 0 : Math.max(0, this.state.lastAt + PATCH_COOLDOWN - this.world.clock.totalMinutes);
  }

  /** Why the draft can't ship (English source + params), or null. */
  problem(draft: PatchDraft): { key: string; params?: Record<string, string | number> } | null {
    if (this.cooldownLeft() > 0) return { key: 'The team needs {h} more game hours before the next patch.', params: { h: Math.ceil(this.cooldownLeft() / 60) } };
    const any = this.hype() > 0 || draft.buff || draft.nerf || draft.levelCap || draft.xp !== 0 || (draft.bugfix && this.state.bugs > 0);
    if (!any) return { key: 'Nothing to ship: build new content or pick a change.' };
    if (draft.buff && draft.buff === draft.nerf) return { key: 'A class cannot be buffed and nerfed in the same patch.' };
    if (this.studio.standard && this.world.studio.funds < this.cost(draft)) return { key: 'Not enough studio funds for QA and marketing.' };
    return null;
  }

  private avgMood(): number {
    const ps = this.world.sim.players;
    return ps.length ? Math.round(ps.reduce((n, p) => n + p.satisfaction, 0) / ps.length) : 0;
  }

  release(draft: PatchDraft): PatchRecord | null {
    if (this.problem(draft)) return null;
    const s = this.state;
    const now = this.world.clock.totalMinutes;
    const hype = this.hype();
    const content = this.newContent();
    const notes: PatchNote[] = content.map((c) => ({ key: c.label, params: { n: c.n } }));
    const players = this.world.sim.players;
    const classes = this.world.rpg.progression.classes;
    const cost = this.cost(draft);
    if (cost) { this.world.studio.funds -= cost; this.studio.today().build += cost; }
    const record: PatchRecord = {
      version: '', at: now, notes, hype, bugsIntroduced: 0, bugsFixed: 0,
      moodBefore: this.avgMood(), moodAfter: null, popularityBefore: Math.round(this.world.sim.popularity), popularityAfter: null,
    };

    // Content hype: popularity, everyone excited, lapsed players come back early.
    if (hype > 0) {
      this.world.sim.popularity = Math.min(100, this.world.sim.popularity + Math.min(8, hype * 0.4));
      for (const p of players) {
        if (p.online) this.pm.feel(p, 'patch', Math.min(3, 0.5 + hype / 5));
        else if (hype >= 3) p.returnAt = Math.min(p.returnAt, now + 30 + this.rand() * 120);
      }
    }
    const tune = (key: ClassKey, mult: number) => {
      const c = classes.find((x) => x.key === key);
      if (!c) return '';
      c.growth[c.primary] = Math.round(c.growth[c.primary] * mult * 100) / 100;
      c.base[c.primary] = Math.max(1, Math.round(c.base[c.primary] * mult));
      return c.name;
    };
    if (draft.buff) {
      const name = tune(draft.buff, 1.12);
      notes.push({ key: '{cls}: damage increased by 12%.', params: { cls: name } });
      for (const p of players) if (p.classKey === draft.buff && p.online) this.pm.feel(p, 'patch', 2);
    }
    if (draft.nerf) {
      const name = tune(draft.nerf, 0.88);
      notes.push({ key: '{cls}: damage reduced by 12%.', params: { cls: name } });
      for (const p of players) {
        if (p.classKey === draft.nerf) this.pm.feel(p, 'nerf', 1);
        else if (p.online && getBehavior(p.behavior).weights.pvp > 0.5) this.pm.feel(p, 'patch', 0.5);
      }
    }
    if (draft.levelCap) {
      const prog = this.world.rpg.progression;
      const old = prog.maxLevel;
      prog.maxLevel += 5;
      notes.push({ key: 'Level cap raised from {a} to {b}.', params: { a: old, b: prog.maxLevel } });
      this.world.sim.popularity = Math.min(100, this.world.sim.popularity + 2);
      for (const p of players) {
        if (p.level >= old) { this.pm.feel(p, 'patch', 3); if (!p.online) p.returnAt = Math.min(p.returnAt, now + 60); }
        else if (p.online && getBehavior(p.behavior).weights.fight > 1) this.pm.feel(p, 'patch', 1);
      }
    }
    if (draft.xp !== 0) {
      s.xpRate = Math.max(0.5, Math.min(3, Math.round(s.xpRate * (draft.xp > 0 ? 1.25 : 0.8) * 100) / 100));
      notes.push({ key: draft.xp > 0 ? 'Faster levelling: XP rate is now ×{x}.' : 'Slower levelling: XP rate is now ×{x}.', params: { x: s.xpRate } });
      for (const p of players) {
        if (!p.online) continue;
        const grinder = p.behavior === 'grinder' || p.behavior === 'fighter';
        if (draft.xp > 0) this.pm.feel(p, 'patch', grinder ? 0.3 : 1);
        else if (grinder) this.pm.feel(p, 'nerf', 0.5);
      }
    }
    // Bugs: fixes clear them; new content brings new ones (half as many with a QA pass).
    if (draft.bugfix && s.bugs > 0) {
      record.bugsFixed = s.bugs;
      notes.push({ key: 'Fixed {n} bugs.', params: { n: s.bugs } });
      for (const p of players) if (p.online) this.pm.feel(p, 'patch', 0.5);
      s.bugs = 0;
    }
    record.bugsIntroduced = Math.round(hype * (0.15 + this.rand() * 0.25) * (draft.bugfix ? 0.5 : 1));
    s.bugs += record.bugsIntroduced;
    if (draft.levelCap || hype >= 25) { s.major++; s.minor = 0; } else s.minor++;
    record.version = this.version();
    s.lastAt = now;
    s.snapshot = this.counts();
    s.history.push(record);
    if (s.history.length > 30) s.history.shift();
    this.world.events.emit('rpg:changed', undefined);
    this.world.markDirty();
    this.events.emit('released', { record });
    return record;
  }

  hourly(): void {
    const s = this.state;
    // Live bugs annoy players.
    if (s.bugs > 0) for (const p of this.pm.online()) if (this.rand() < Math.min(0.5, s.bugs * 0.03)) this.pm.feel(p, 'bugs');
    // Measure how the last patch landed one game day later.
    const last = s.history[s.history.length - 1];
    if (last && last.moodAfter === null && this.world.clock.totalMinutes - last.at >= 24 * 60) {
      last.moodAfter = this.avgMood();
      last.popularityAfter = Math.round(this.world.sim.popularity);
    }
  }

  /** Patch note text for the UI. */
  static noteText(n: PatchNote): string {
    return t(n.key, n.params);
  }
}
