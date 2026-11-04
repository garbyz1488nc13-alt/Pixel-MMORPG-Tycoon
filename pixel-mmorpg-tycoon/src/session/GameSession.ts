import { EventBus } from '@/core/EventBus';
import { t } from '@/i18n';
import { createId } from '@/core/ids';
import { makeThumbnail } from '@/game/textures/mapImage';
import type { SaveSlotKey, WorldSave } from '@/models/world';
import type { MapObject } from '@/models/entities';
import { SAVE_SLOTS } from '@/models/world';
import { WorldRepository } from '@/persistence/WorldRepository';
import { SimulationEngine } from '@/simulation/SimulationEngine';
import { ClockSystem } from '@/simulation/systems/ClockSystem';
import { NpcSystem } from '@/simulation/systems/NpcSystem';
import { CreatureSystem } from '@/simulation/systems/CreatureSystem';
import { EconomySystem } from '@/simulation/systems/EconomySystem';
import { EconomyService } from '@/simulation/economy/EconomyService';
import { PlayerManager } from '@/simulation/players/PlayerManager';
import { PlayerBrain } from '@/simulation/players/PlayerBrain';
import { PlayerSystem } from '@/simulation/systems/PlayerSystem';
import { HourlySystem } from '@/simulation/systems/HourlySystem';
import { StudioService } from '@/simulation/studio/StudioService';
import { EntityCommand } from '@/systems/editor/History';
import { FACTORS } from '@/data/playerTypes';
import { ActorManager } from '@/simulation/actors/ActorManager';
import { displayName } from '@/simulation/actors/combat';
import { EntityEditor } from '@/systems/editor/EntityEditor';
import { RpgCommand } from '@/systems/editor/History';
import type { RpgConfig } from '@/models/rpg';
import type { SimSpeed } from '@/simulation/types';
import { WorldRuntime } from '@/simulation/WorldRuntime';
import { History } from '@/systems/editor/History';
import { TerrainPainter } from '@/systems/editor/TerrainPainter';
import { useEditorStore } from '@/stores/editorStore';
import { log } from '@/stores/logStore';
import { useSessionStore } from '@/stores/sessionStore';

/** Messages between React UI and the Phaser scene (camera control, cursor info). */
export type BridgeEvents = {
  'camera:centerTile': { x: number; y: number };
  'camera:fit': undefined;
  'camera:zoomBy': { factor: number };
  /** Emitted by the scene: visible area in tile units. */
  'camera:moved': { x: number; y: number; w: number; h: number; zoom: number };
  'scene:fps': { fps: number };
};

/**
 * One open world. Wires the world runtime, simulation engine, editor history
 * and persistence together, and mirrors their state into Zustand for React.
 */
export class GameSession {
  readonly uid = createId('session');
  readonly runtime: WorldRuntime;
  readonly engine: SimulationEngine;
  readonly history: History;
  readonly painter: TerrainPainter;
  readonly entities: EntityEditor;
  readonly actors: ActorManager;
  readonly economy: EconomyService;
  readonly players: PlayerManager;
  readonly playerSystem: PlayerSystem;
  readonly studio: StudioService;
  readonly bridge = new EventBus<BridgeEvents>();
  slot: SaveSlotKey;
  /** Copied objects for Ctrl+C / Ctrl+V. */
  clipboard: MapObject[] = [];
  private uiTimer: number;
  private disposers: (() => void)[] = [];

  constructor(save: WorldSave, slot: SaveSlotKey) {
    this.slot = slot;
    this.runtime = new WorldRuntime(save);
    this.engine = new SimulationEngine(this.runtime);
    this.engine.addSystem(new ClockSystem(this.engine.events));
    this.actors = new ActorManager(this.runtime);
    this.engine.addSystem(new NpcSystem(this.actors));
    this.engine.addSystem(new CreatureSystem(this.actors));
    this.economy = new EconomyService(this.runtime, this.actors);
    this.actors.errandHandler = (a) => this.economy.completeErrand(a);
    this.engine.addSystem(new EconomySystem(this.economy, this.actors));
    this.history = new History(200, () => useEditorStore.getState().setHistoryFlags(this.history.canUndo, this.history.canRedo));
    this.painter = new TerrainPainter(() => this.runtime, this.history);
    this.entities = new EntityEditor(() => this.runtime, this.history);
    this.studio = new StudioService(this.runtime);
    if (this.studio.standard) {
      this.entities.budget = this.studio;
      EntityCommand.budget = this.studio;
    } else EntityCommand.budget = null;
    this.players = new PlayerManager(this.runtime, this.actors, this.economy);
    this.playerSystem = new PlayerSystem(this.actors, this.players, new PlayerBrain(this.runtime, this.actors, this.players, this.economy), this.economy, () => this.runtime);
    this.engine.addSystem(this.playerSystem);
    this.engine.addSystem(new HourlySystem(this.players, this.studio, (debt) => {
      if (debt > 0) log.event(t('The studio is in debt (day {n}). Building is blocked until funds are positive.', { n: debt }), 'warn', this.runtime.clock.totalMinutes);
    }));

    const store = useSessionStore.getState();
    store.patch({
      session: this,
      worldName: this.runtime.name,
      running: false,
      speed: 1,
      gameMinutes: this.runtime.clock.totalMinutes,
      dirty: false,
      lastSavedAt: save.updatedAt,
      slot,
      saving: false,
    });
    useEditorStore.getState().reset();

    this.disposers.push(
      this.engine.events.on('sim:state', ({ running, speed }) => {
        useSessionStore.getState().patch({ running, speed });
        log.system(running ? t('Simulation running at x{n}.', { n: speed }) : t('Simulation paused.'), 'info', this.runtime.clock.totalMinutes);
      }),
      this.engine.events.on('sim:message', ({ text }) => log.sim(text, 'info', this.runtime.clock.totalMinutes)),
      this.runtime.events.on('dirty:changed', ({ dirty }) => useSessionStore.getState().patch({ dirty })),
      this.runtime.events.on('meta:changed', ({ name }) => useSessionStore.getState().patch({ worldName: name })),
      this.players.events.on('joined', ({ player, returning }) => {
        if (!returning) log.sim(t('{name} ({cls}) joined the game.', { name: player.name, cls: t(this.players.classDef(player).name) }), 'info', this.runtime.clock.totalMinutes);
      }),
      this.players.events.on('left', ({ player, quit, reason }) => {
        if (quit) log.sim(reason
          ? t('{name} quit the game. Main complaint: {reason}.', { name: player.name, reason: t(FACTORS[reason].label) })
          : t('{name} quit the game.', { name: player.name }), 'warn', this.runtime.clock.totalMinutes);
      }),
      this.players.events.on('levelUp', ({ player, level }) => {
        if (level % 5 === 0) log.sim(t('{name} reached level {n}!', { name: player.name, n: level }), 'success', this.runtime.clock.totalMinutes);
      }),
      this.players.events.on('questDone', ({ player, quest }) => log.sim(t('{name} completed the quest "{quest}".', { name: player.name, quest: quest.name }), 'info', this.runtime.clock.totalMinutes)),
      this.players.events.on('turnedAway', ({ count }) => log.sim(t('Server full: {n} players could not log in.', { n: count }), 'warn', this.runtime.clock.totalMinutes)),
      this.economy.events.on('trade', (tr) => {
        if (tr.kind !== 'sale' && tr.kind !== 'purchase') return;
        if (tr.actorId && this.players.get(tr.actorId)) return; // player trades are too frequent to log
        const who = tr.actorId ? this.runtime.entities.get('npcs', tr.actorId)?.name : '?';
        const merchant = tr.merchantId ? this.runtime.entities.get('npcs', tr.merchantId)?.name : '?';
        const item = this.economy.item(tr.itemId)?.name ?? '?';
        const cur = this.runtime.rpg.economy.currencyName;
        const text = tr.kind === 'sale'
          ? t('{who} sold {qty}× {item} to {merchant} for {total} {cur}.', { who: who ?? '?', qty: tr.qty, item, merchant: merchant ?? '?', total: tr.total, cur })
          : t('{who} bought {qty}× {item} from {merchant} for {total} {cur}.', { who: who ?? '?', qty: tr.qty, item, merchant: merchant ?? '?', total: tr.total, cur });
        log.event(text, 'info', this.runtime.clock.totalMinutes);
      }),
      this.actors.events.on('died', ({ victim, killer }) => {
        const v = displayName(this.actors, victim);
        const k = killer ? displayName(this.actors, killer) : t('Something');
        if (victim.kind === 'player') {
          if (killer?.kind === 'player') log.sim(t('PvP: {killer} killed {victim}.', { killer: k, victim: v }), 'warn', this.runtime.clock.totalMinutes);
          return;
        }
        if (victim.kind === 'creature' && killer?.kind === 'player') {
          const tpl = this.actors.template(victim);
          if (tpl?.boss) log.sim(t('{killer} defeated the boss {victim}!', { killer: k, victim: v }), 'success', this.runtime.clock.totalMinutes);
          return;
        }
        if (victim.kind === 'creature') {
          const xp = this.actors.template(victim)?.xpReward ?? 0;
          log.sim(t('{killer} slew {victim} ({xp} XP).', { killer: k, victim: v, xp }), 'info', this.runtime.clock.totalMinutes);
          if (killer) {
            const drops = this.economy.lootKill(killer, victim.defId);
            if (drops.length) {
              const list = drops.map((d) => `${this.economy.item(d.itemId)?.name ?? '?'} ×${d.qty}`).join(', ');
              log.sim(t('{name} looted: {items}.', { name: k, items: list }), 'info', this.runtime.clock.totalMinutes);
            }
          }
        } else log.sim(t('{victim} was killed by {killer}. Respawning at home in 1 hour.', { victim: v, killer: k }), 'warn', this.runtime.clock.totalMinutes);
      }),
    );

    // Mirror the clock to the UI a few times per second (not every tick).
    this.uiTimer = window.setInterval(() => {
      const m = this.runtime.clock.totalMinutes;
      if (useSessionStore.getState().gameMinutes !== m) useSessionStore.getState().patch({ gameMinutes: m });
    }, 250);
  }

  setSpeed(speed: SimSpeed): void {
    const changed = speed !== this.engine.currentSpeed;
    this.engine.setSpeed(speed);
    if (changed && !this.engine.isRunning) log.system(t('Simulation speed set to x{n}.', { n: speed }), 'info', this.runtime.clock.totalMinutes);
  }

  /** Edit economy / progression rules as one (merged) undo step. */
  updateRpg(label: string, mutate: (rpg: RpgConfig) => void, mergeKey?: string): void {
    const before = structuredClone(this.runtime.rpg);
    mutate(this.runtime.rpg);
    this.history.push(new RpgCommand(label, before, structuredClone(this.runtime.rpg), mergeKey ?? label));
    this.runtime.events.emit('rpg:changed', undefined);
    this.runtime.markDirty();
  }

  undo(): void {
    const label = this.history.undo(this.runtime);
    if (label) log.system(t('Undo: {label}', { label }), 'info', this.runtime.clock.totalMinutes);
  }

  redo(): void {
    const label = this.history.redo(this.runtime);
    if (label) log.system(t('Redo: {label}', { label }), 'info', this.runtime.clock.totalMinutes);
  }

  async save(slot: SaveSlotKey = this.slot, silent = false): Promise<boolean> {
    const store = useSessionStore.getState();
    if (store.saving) return false;
    store.patch({ saving: true });
    try {
      this.players.flush();
      const data = this.runtime.toSave();
      await WorldRepository.save(data, slot, makeThumbnail(this.runtime.grid));
      if (slot !== 'auto') this.slot = slot;
      this.runtime.markClean();
      useSessionStore.getState().patch({ lastSavedAt: data.updatedAt, slot: this.slot });
      const label = SAVE_SLOTS.find((s) => s.key === slot)?.label ?? slot;
      if (slot === 'auto') log.system(t('Autosaved.'), 'info', this.runtime.clock.totalMinutes);
      else if (!silent) log.system(t('World saved to {slot}.', { slot: t(label) }), 'success', this.runtime.clock.totalMinutes);
      return true;
    } catch (err) {
      log.system(t('Save failed: {msg}', { msg: (err as Error).message }), 'error');
      return false;
    } finally {
      useSessionStore.getState().patch({ saving: false });
    }
  }

  dispose(): void {
    window.clearInterval(this.uiTimer);
    this.disposers.forEach((d) => d());
    this.engine.dispose();
    this.actors.dispose();
    this.economy.dispose();
    this.playerSystem.dispose();
    this.players.dispose();
    if (EntityCommand.budget === this.studio) EntityCommand.budget = null;
    this.bridge.clear();
    this.runtime.dispose();
  }
}
