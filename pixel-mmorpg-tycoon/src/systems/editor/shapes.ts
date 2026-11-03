import type { TileGrid } from '@/models/TileGrid';

export type BrushShape = 'square' | 'circle';

/** Tile offsets covered by a brush of `size` tiles centered on the cursor. */
export function brushFootprint(size: number, shape: BrushShape): [number, number][] {
  const out: [number, number][] = [];
  const r = (size - 1) / 2;
  const start = -Math.floor(r);
  for (let dy = start; dy < start + size; dy++) {
    for (let dx = start; dx < start + size; dx++) {
      if (shape === 'circle' && size > 2) {
        const cx = dx + Math.floor(r) - r;
        const cy = dy + Math.floor(r) - r;
        if (cx * cx + cy * cy > (r + 0.5) * (r + 0.5)) continue;
      }
      out.push([dx, dy]);
    }
  }
  return out;
}

/** Bresenham line between two tiles (inclusive) so fast strokes leave no gaps. */
export function lineTiles(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    out.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return out;
}

export interface TileRect { x: number; y: number; w: number; h: number }

export function normalizeRect(x0: number, y0: number, x1: number, y1: number): TileRect {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return { x, y, w: Math.abs(x1 - x0) + 1, h: Math.abs(y1 - y0) + 1 };
}

/** Indices for a filled or outlined rectangle, clipped to the grid. */
export function rectIndices(grid: TileGrid, rect: TileRect, outlineOnly = false): number[] {
  const out: number[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (!grid.inBounds(x, y)) continue;
      if (outlineOnly && x > rect.x && x < rect.x + rect.w - 1 && y > rect.y && y < rect.y + rect.h - 1) continue;
      out.push(grid.index(x, y));
    }
  }
  return out;
}

/**
 * 4-way flood fill of the contiguous region sharing the start tile's terrain.
 * Iterative (no recursion) with a visited bitmap; capped to protect huge maps.
 */
export function floodFillIndices(grid: TileGrid, sx: number, sy: number, maxTiles = 200_000): number[] {
  if (!grid.inBounds(sx, sy)) return [];
  const target = grid.get(sx, sy);
  const { width, height, tiles } = grid;
  const visited = new Uint8Array(width * height);
  const stack = [grid.index(sx, sy)];
  const out: number[] = [];
  visited[stack[0]] = 1;
  while (stack.length && out.length < maxTiles) {
    const i = stack.pop()!;
    out.push(i);
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0 && !visited[i - 1] && tiles[i - 1] === target) { visited[i - 1] = 1; stack.push(i - 1); }
    if (x < width - 1 && !visited[i + 1] && tiles[i + 1] === target) { visited[i + 1] = 1; stack.push(i + 1); }
    if (y > 0 && !visited[i - width] && tiles[i - width] === target) { visited[i - width] = 1; stack.push(i - width); }
    if (y < height - 1 && !visited[i + width] && tiles[i + width] === target) { visited[i + width] = 1; stack.push(i + width); }
  }
  return out;
}
