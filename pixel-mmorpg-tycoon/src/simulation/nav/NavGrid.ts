import { getObjectDef } from '@/data/objects';
import { getTerrain } from '@/data/terrain';
import type { WorldRuntime } from '../WorldRuntime';

/**
 * Walkability + movement cost per tile, derived from terrain and objects.
 * Rebuilt lazily (one pass over the map) after any change.
 */
/** Movement cost on roads and bridges: travellers prefer the paths you lay out. */
export const ROAD_COST = 0.4;

export class NavGrid {
  walkable = new Uint8Array(0);
  cost = new Float32Array(0);
  width = 0;
  height = 0;
  private dirty = true;
  /** Incremented on each rebuild so cached paths can be revalidated. */
  revision = 0;

  constructor(private world: WorldRuntime) {}

  invalidate(): void {
    this.dirty = true;
  }

  ensure(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.revision++;
    const g = this.world.grid;
    this.width = g.width;
    this.height = g.height;
    const n = g.width * g.height;
    this.walkable = new Uint8Array(n);
    this.cost = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = getTerrain(g.tiles[i]);
      this.walkable[i] = t.walkable ? 1 : 0;
      this.cost[i] = t.walkable ? t.moveCost : 1;
    }
    for (const o of this.world.entities.list('objects')) {
      const d = getObjectDef(o.kind);
      if (!d) continue;
      for (let y = o.y; y < o.y + d.h; y++)
        for (let x = o.x; x < o.x + d.w; x++) {
          if (!g.inBounds(x, y)) continue;
          const i = y * g.width + x;
          if (d.walkableOverride) { this.walkable[i] = 1; this.cost[i] = 1; }
          if (d.category === 'roads' || d.category === 'bridges') this.cost[i] = Math.min(this.cost[i], ROAD_COST);
          if (d.blocks) this.walkable[i] = 0;
        }
    }
  }

  isWalkable(x: number, y: number): boolean {
    this.ensure();
    return x >= 0 && y >= 0 && x < this.width && y < this.height && this.walkable[y * this.width + x] === 1;
  }
}
