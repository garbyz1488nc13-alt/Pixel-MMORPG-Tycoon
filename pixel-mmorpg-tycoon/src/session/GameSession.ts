import { EventBus } from '@/core/EventBus';
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
import { ActorManager } from '@/simulation/actors/ActorManager';
import { displayName } from '@/simulation/actors/combat';
import { EntityEditor } from '@/systems/editor/EntityEditor';
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
    this.history = new History(200, () => useEditorStore.getState().setHistoryFlags(this.history.canUndo, this.history.canRedo));
    this.painter = new TerrainPainter(() => this.runtime, this.history);
    this.entities = new EntityEditor(() => this.runtime, this.history);

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
        log.system(running ? `Simulation running at x${speed}.` : 'Simulation paused.', 'info', this.runtime.clock.totalMinutes);
      }),
      this.engine.events.on('sim:message', ({ text }) => log.sim(text, 'info', this.runtime.clock.totalMinutes)),
      this.runtime.events.on('dirty:changed', ({ dirty }) => useSessionStore.getState().patch({ dirty })),
      this.runtime.events.on('meta:changed', ({ name }) => useSessionStore.getState().patch({ worldName: name })),
      this.actors.events.on('died', ({ victim, killer }) => {
        const v = displayName(this.actors, victim);
        const k = killer ? displayName(this.actors, killer) : 'Something';
        if (victim.kind === 'creature') {
          const xp = this.actors.template(victim)?.xpReward ?? 0;
          log.sim(`${k} slew ${v} (${xp} XP).`, 'info', this.runtime.clock.totalMinutes);
        } else log.sim(`${v} was killed by ${k}. Respawning at home in 1 hour.`, 'warn', this.runtime.clock.totalMinutes);
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
    if (changed && !this.engine.isRunning) log.system(`Simulation speed set to x${speed}.`, 'info', this.runtime.clock.totalMinutes);
  }

  undo(): void {
    const label = this.history.undo(this.runtime);
    if (label) log.system(`Undo: ${label}`, 'info', this.runtime.clock.totalMinutes);
  }

  redo(): void {
    const label = this.history.redo(this.runtime);
    if (label) log.system(`Redo: ${label}`, 'info', this.runtime.clock.totalMinutes);
  }

  async save(slot: SaveSlotKey = this.slot, silent = false): Promise<boolean> {
    const store = useSessionStore.getState();
    if (store.saving) return false;
    store.patch({ saving: true });
    try {
      const data = this.runtime.toSave();
      await WorldRepository.save(data, slot, makeThumbnail(this.runtime.grid));
      if (slot !== 'auto') this.slot = slot;
      this.runtime.markClean();
      useSessionStore.getState().patch({ lastSavedAt: data.updatedAt, slot: this.slot });
      const label = SAVE_SLOTS.find((s) => s.key === slot)?.label ?? slot;
      if (slot === 'auto') log.system('Autosaved.', 'info', this.runtime.clock.totalMinutes);
      else if (!silent) log.system(`World saved to ${label}.`, 'success', this.runtime.clock.totalMinutes);
      return true;
    } catch (err) {
      log.system(`Save failed: ${(err as Error).message}`, 'error');
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
    this.bridge.clear();
    this.runtime.dispose();
  }
}
