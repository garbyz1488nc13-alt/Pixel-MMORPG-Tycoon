import { EventBus } from '@/core/EventBus';
import type { WorldRuntime } from './WorldRuntime';
import type { SimContext, SimSpeed, SimulationSystem } from './types';
import { GAME_MINUTES_PER_TICK, TICK_MS } from './time';

export type SimEvents = {
  'sim:state': { running: boolean; speed: SimSpeed };
  'sim:message': { text: string };
};

/** Never simulate more than this many ticks per frame (avoids a spiral of death after tab switch). */
const MAX_TICKS_PER_FRAME = 40;

/**
 * Fixed-timestep simulation loop. Independent from React and Phaser:
 * it has its own requestAnimationFrame loop and only touches WorldRuntime.
 * Speed multiplies the number of fixed ticks per real second, not the tick size,
 * so results stay deterministic regardless of speed.
 */
export class SimulationEngine {
  readonly events = new EventBus<SimEvents>();
  private systems: SimulationSystem[] = [];
  private running = false;
  private speed: SimSpeed = 1;
  private accumulator = 0;
  private lastTime = 0;
  private rafId: number | null = null;
  private ctx: SimContext;

  constructor(private world: WorldRuntime) {
    this.ctx = { world, tick: 0 };
  }

  addSystem(system: SimulationSystem): void {
    this.systems.push(system);
  }

  get isRunning(): boolean {
    return this.running;
  }

  get currentSpeed(): SimSpeed {
    return this.speed;
  }

  play(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
    this.emitState();
  }

  pause(): void {
    if (!this.running) return;
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.emitState();
  }

  toggle(): void {
    if (this.running) this.pause();
    else this.play();
  }

  setSpeed(speed: SimSpeed): void {
    this.speed = speed;
    this.emitState();
  }

  /** Advance exactly one tick (used by tests and future "step" debugging). */
  step(): void {
    this.ctx.tick++;
    for (const s of this.systems) {
      const interval = s.interval ?? 1;
      if (this.ctx.tick % interval === 0) s.update(this.ctx, GAME_MINUTES_PER_TICK * interval);
    }
    this.world.markDirty();
  }

  private frame = (now: number) => {
    if (!this.running) return;
    const elapsed = Math.min(1000, now - this.lastTime);
    this.lastTime = now;
    this.accumulator += elapsed * this.speed;
    let ticks = 0;
    while (this.accumulator >= TICK_MS && ticks < MAX_TICKS_PER_FRAME) {
      this.step();
      this.accumulator -= TICK_MS;
      ticks++;
    }
    if (ticks === MAX_TICKS_PER_FRAME) this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  };

  private emitState(): void {
    this.events.emit('sim:state', { running: this.running, speed: this.speed });
  }

  dispose(): void {
    this.pause();
    this.events.clear();
  }
}
