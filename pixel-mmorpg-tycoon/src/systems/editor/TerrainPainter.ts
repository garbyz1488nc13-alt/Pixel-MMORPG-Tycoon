import type { WorldRuntime } from '@/simulation/WorldRuntime';
import { t } from '@/i18n';
import { History, ReplaceMapCommand, TileEditCommand } from './History';
import { brushFootprint, floodFillIndices, lineTiles, normalizeRect, rectIndices, type BrushShape } from './shapes';
import type { TileGrid } from '@/models/TileGrid';

export type TerrainTool = 'brush' | 'fill' | 'rect' | 'picker';

/**
 * Applies terrain edits to the world and records them as undoable commands.
 * A "stroke" groups every tile touched between pointer-down and pointer-up
 * into a single undo step.
 */
export class TerrainPainter {
  private stroke: { before: Map<number, number>; terrain: number; last: [number, number] | null } | null = null;

  constructor(private world: () => WorldRuntime, readonly history: History) {}

  beginStroke(terrain: number): void {
    this.stroke = { before: new Map(), terrain, last: null };
  }

  /** Paint brush at tile (x,y), interpolating from the previous point in the stroke. */
  strokeTo(x: number, y: number, size: number, shape: BrushShape): void {
    const s = this.stroke;
    if (!s) return;
    const world = this.world();
    const grid = world.grid;
    const points = s.last ? lineTiles(s.last[0], s.last[1], x, y) : [[x, y] as [number, number]];
    s.last = [x, y];
    const foot = brushFootprint(size, shape);
    const changed: number[] = [];
    for (const [px, py] of points) {
      for (const [dx, dy] of foot) {
        const tx = px + dx;
        const ty = py + dy;
        if (!grid.inBounds(tx, ty)) continue;
        const i = grid.index(tx, ty);
        const cur = grid.tiles[i];
        if (cur === s.terrain) continue;
        if (!s.before.has(i)) s.before.set(i, cur);
        changed.push(i);
      }
    }
    if (changed.length) world.setTiles(changed, new Uint8Array(changed.length).fill(s.terrain));
  }

  endStroke(label = 'Paint'): number {
    const s = this.stroke;
    this.stroke = null;
    if (!s || s.before.size === 0) return 0;
    const indices = Uint32Array.from(s.before.keys());
    const before = Uint8Array.from(s.before.values());
    const after = new Uint8Array(indices.length).fill(s.terrain);
    this.history.push(new TileEditCommand(label, indices, before, after));
    return indices.length;
  }

  /** Apply a one-shot set of indices as a single undo step. Returns tiles changed. */
  applyIndices(indices: number[], terrain: number, label: string): number {
    const world = this.world();
    const tiles = world.grid.tiles;
    const changed = indices.filter((i) => tiles[i] !== terrain);
    if (!changed.length) return 0;
    const idx = Uint32Array.from(changed);
    const before = Uint8Array.from(changed, (i) => tiles[i]);
    const after = new Uint8Array(changed.length).fill(terrain);
    world.setTiles(idx, after);
    this.history.push(new TileEditCommand(label, idx, before, after));
    return changed.length;
  }

  fill(x: number, y: number, terrain: number): number {
    return this.applyIndices(floodFillIndices(this.world().grid, x, y), terrain, t('Fill'));
  }

  rect(x0: number, y0: number, x1: number, y1: number, terrain: number, outline: boolean): number {
    const grid = this.world().grid;
    return this.applyIndices(rectIndices(grid, normalizeRect(x0, y0, x1, y1), outline), terrain, outline ? t('Outline') : t('Rectangle'));
  }

  replaceMap(next: TileGrid, label: string): void {
    const world = this.world();
    const before = world.grid.clone();
    world.replaceGrid(next);
    this.history.push(new ReplaceMapCommand(label, before, next.clone()));
  }
}
