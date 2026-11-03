import { TERRAINS } from '@/data/terrain';
import type { TileGrid } from '@/models/TileGrid';

/** RGB per terrain id, derived from the terrain palette's base color. */
export const TERRAIN_RGB: [number, number, number][] = TERRAINS.map((t) => {
  const hex = t.palette[0].slice(1);
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
});

/** Paint the whole grid at 1 pixel per tile into an ImageData. */
export function gridToImageData(grid: TileGrid, img?: ImageData): ImageData {
  const out = img && img.width === grid.width && img.height === grid.height ? img : new ImageData(grid.width, grid.height);
  const d = out.data;
  const t = grid.tiles;
  for (let i = 0; i < t.length; i++) {
    const c = TERRAIN_RGB[t[i]] ?? TERRAIN_RGB[0];
    const o = i * 4;
    d[o] = c[0];
    d[o + 1] = c[1];
    d[o + 2] = c[2];
    d[o + 3] = 255;
  }
  return out;
}

export function gridToCanvas(grid: TileGrid): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = grid.width;
  c.height = grid.height;
  c.getContext('2d')!.putImageData(gridToImageData(grid), 0, 0);
  return c;
}

/** Small PNG (max 128px side) for world lists. */
export function makeThumbnail(grid: TileGrid, max = 128): string {
  const src = gridToCanvas(grid);
  const scale = Math.min(1, max / Math.max(grid.width, grid.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(grid.width * scale));
  c.height = Math.max(1, Math.round(grid.height * scale));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
