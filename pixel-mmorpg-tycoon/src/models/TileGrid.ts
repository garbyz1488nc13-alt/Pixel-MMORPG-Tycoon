import { TERRAIN_COUNT } from '@/data/terrain';

/**
 * Dense terrain grid backed by a Uint8Array (1 byte per tile).
 * Pure data — no rendering or React knowledge.
 */
export class TileGrid {
  readonly width: number;
  readonly height: number;
  readonly tiles: Uint8Array;

  constructor(width: number, height: number, fill = 0, tiles?: Uint8Array) {
    this.width = width;
    this.height = height;
    this.tiles = tiles ?? new Uint8Array(width * height).fill(fill);
    if (this.tiles.length !== width * height) throw new Error('TileGrid: tile buffer size mismatch');
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }

  get(x: number, y: number): number {
    return this.inBounds(x, y) ? this.tiles[y * this.width + x] : -1;
  }

  set(x: number, y: number, terrain: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = y * this.width + x;
    if (this.tiles[i] === terrain) return false;
    this.tiles[i] = terrain;
    return true;
  }

  clone(): TileGrid {
    return new TileGrid(this.width, this.height, 0, this.tiles.slice());
  }

  /**
   * Returns a new grid of the given size. `offsetX/offsetY` is where the old
   * grid's (0,0) lands in the new grid (used for anchored resizing).
   */
  resized(width: number, height: number, offsetX: number, offsetY: number, fill: number): TileGrid {
    const next = new TileGrid(width, height, fill);
    for (let y = 0; y < this.height; y++) {
      const ny = y + offsetY;
      if (ny < 0 || ny >= height) continue;
      for (let x = 0; x < this.width; x++) {
        const nx = x + offsetX;
        if (nx < 0 || nx >= width) continue;
        next.tiles[ny * width + nx] = this.tiles[y * this.width + x];
      }
    }
    return next;
  }

  countByTerrain(): number[] {
    const counts = new Array(TERRAIN_COUNT).fill(0);
    for (let i = 0; i < this.tiles.length; i++) counts[this.tiles[i]]++;
    return counts;
  }

  /** Run-length encoding: "value*count,value*count,..." in base36. */
  toRle(): string {
    const parts: string[] = [];
    const t = this.tiles;
    let i = 0;
    while (i < t.length) {
      const v = t[i];
      let run = 1;
      while (i + run < t.length && t[i + run] === v) run++;
      parts.push(run === 1 ? v.toString(36) : `${v.toString(36)}*${run.toString(36)}`);
      i += run;
    }
    return parts.join(',');
  }

  static fromRle(width: number, height: number, rle: string): TileGrid {
    const tiles = new Uint8Array(width * height);
    let i = 0;
    if (rle.length > 0) {
      for (const part of rle.split(',')) {
        const [v, c] = part.split('*');
        const value = parseInt(v, 36);
        const count = c ? parseInt(c, 36) : 1;
        if (Number.isNaN(value) || Number.isNaN(count) || value < 0 || value >= TERRAIN_COUNT) {
          throw new Error(`Corrupt map data near tile ${i}`);
        }
        if (i + count > tiles.length) throw new Error('Map data longer than map size');
        tiles.fill(value, i, i + count);
        i += count;
      }
    }
    if (i !== tiles.length) throw new Error(`Map data incomplete: ${i}/${tiles.length} tiles`);
    return new TileGrid(width, height, 0, tiles);
  }
}
