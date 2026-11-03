import type { EntityId } from '@/core/ids';
import { getObjectDef, type ObjectDef } from '@/data/objects';
import { TerrainId } from '@/data/terrain';
import type { MapObject } from '@/models/entities';
import type { TileRect } from '@/systems/editor/shapes';
import type { WorldRuntime } from '@/simulation/WorldRuntime';

/**
 * Per-tile lookup of map objects (two layers: flat ground objects and standing objects).
 * Rebuilt lazily after objects or the map change.
 */
export class ObjectIndex {
  private solid = new Int32Array(0);
  private flat = new Int32Array(0);
  private objs: MapObject[] = [];
  private dirty = true;
  private width = 0;

  constructor(private world: WorldRuntime) {}

  invalidate(): void {
    this.dirty = true;
  }

  private ensure(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const g = this.world.grid;
    this.width = g.width;
    this.solid = new Int32Array(g.width * g.height).fill(-1);
    this.flat = new Int32Array(g.width * g.height).fill(-1);
    this.objs = this.world.entities.list('objects');
    this.objs.forEach((o, i) => {
      const def = getObjectDef(o.kind);
      if (!def) return;
      const layer = def.flat ? this.flat : this.solid;
      for (let y = o.y; y < o.y + def.h; y++)
        for (let x = o.x; x < o.x + def.w; x++) if (g.inBounds(x, y)) layer[y * g.width + x] = i;
    });
  }

  /** Topmost object on a tile (standing objects win over flat ones). */
  objectAt(x: number, y: number): MapObject | undefined {
    this.ensure();
    if (!this.world.grid.inBounds(x, y)) return undefined;
    const i = y * this.width + x;
    const s = this.solid[i];
    if (s >= 0) return this.objs[s];
    const f = this.flat[i];
    return f >= 0 ? this.objs[f] : undefined;
  }

  solidAt(x: number, y: number): MapObject | undefined {
    this.ensure();
    if (!this.world.grid.inBounds(x, y)) return undefined;
    const s = this.solid[y * this.width + x];
    return s >= 0 ? this.objs[s] : undefined;
  }

  flatAt(x: number, y: number): MapObject | undefined {
    this.ensure();
    if (!this.world.grid.inBounds(x, y)) return undefined;
    const f = this.flat[y * this.width + x];
    return f >= 0 ? this.objs[f] : undefined;
  }

  objectsInRect(r: TileRect): MapObject[] {
    return this.world.entities.list('objects').filter((o) => {
      const d = getObjectDef(o.kind);
      if (!d) return false;
      return o.x < r.x + r.w && o.x + d.w > r.x && o.y < r.y + r.h && o.y + d.h > r.y;
    });
  }

  /** Can `def` be placed with its top-left at (x,y)? Objects in `ignore` don't count (used when moving). */
  canPlace(def: ObjectDef, x: number, y: number, ignore?: Set<EntityId>): boolean {
    this.ensure();
    const g = this.world.grid;
    for (let ty = y; ty < y + def.h; ty++) {
      for (let tx = x; tx < x + def.w; tx++) {
        if (!g.inBounds(tx, ty)) return false;
        const terrain = g.get(tx, ty);
        if (!def.flat && !def.walkableOverride && (terrain === TerrainId.Water || terrain === TerrainId.Lava)) return false;
        // Objects never overlap: neither two of the same layer, nor a ground object under a standing one.
        const a = this.flatAt(tx, ty);
        const b = this.solidAt(tx, ty);
        if ((a && !ignore?.has(a.id)) || (b && !ignore?.has(b.id))) return false;
      }
    }
    return true;
  }
}
