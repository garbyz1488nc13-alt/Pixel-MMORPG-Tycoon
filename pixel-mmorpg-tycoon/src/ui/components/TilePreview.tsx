import { useEffect, useRef } from 'react';
import { TILE_SIZE } from '@/data/terrain';
import { paintTileset, tilesetSize, TILE_MARGIN, TILE_SPACING, tileIndexFor, TILESET_COLUMNS } from '@/game/textures/TilesetPainter';
import type { TileGrid } from '@/models/TileGrid';

let cachedTileset: HTMLCanvasElement | null = null;

/** Shared offscreen copy of the procedural tileset for DOM previews. */
export function getTilesetCanvas(): HTMLCanvasElement {
  if (cachedTileset) return cachedTileset;
  const { width, height } = tilesetSize();
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  paintTileset(c.getContext('2d')!, 0);
  cachedTileset = c;
  return c;
}

export function drawTile(ctx: CanvasRenderingContext2D, tileIndex: number, dx: number, dy: number, size = TILE_SIZE): void {
  const col = tileIndex % TILESET_COLUMNS;
  const row = Math.floor(tileIndex / TILESET_COLUMNS);
  const cell = TILE_SIZE + TILE_SPACING;
  ctx.drawImage(getTilesetCanvas(), col * cell + TILE_MARGIN, row * cell + TILE_MARGIN, TILE_SIZE, TILE_SIZE, dx, dy, size, size);
}

/** Draws a region of a grid with real tile art (used by menu backdrop & swatches). */
export function renderGridTiles(grid: TileGrid, tileSize: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = grid.width * tileSize;
  c.height = grid.height * tileSize;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < grid.height; y++)
    for (let x = 0; x < grid.width; x++) drawTile(ctx, tileIndexFor(grid.tiles[y * grid.width + x], x, y), x * tileSize, y * tileSize, tileSize);
  return c;
}

/** A single terrain swatch rendered with real tile art. */
export function TerrainSwatch({ terrain, size = 32 }: { terrain: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    drawTile(ctx, tileIndexFor(terrain, 1, 1), 0, 0, TILE_SIZE);
  }, [terrain]);
  return <canvas ref={ref} width={TILE_SIZE} height={TILE_SIZE} style={{ width: size, height: size, display: 'block' }} />;
}
