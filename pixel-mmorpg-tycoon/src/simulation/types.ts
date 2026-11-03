import type { WorldRuntime } from './WorldRuntime';

export interface SimContext {
  world: WorldRuntime;
  /** Simulation tick number since engine start. */
  tick: number;
}

/**
 * A simulation system is updated at a fixed timestep, never per render frame.
 * Future systems (NPC movement, monster AI, economy, players) implement this.
 */
export interface SimulationSystem {
  readonly id: string;
  /** Run every N ticks (to spread heavy work). Default 1. */
  readonly interval?: number;
  update(ctx: SimContext, dtMinutes: number): void;
}

export type SimSpeed = 1 | 2 | 4;
