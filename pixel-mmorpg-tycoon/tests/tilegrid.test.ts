import { describe, expect, it } from 'vitest';
import { TileGrid } from '@/models/TileGrid';
import { generateTerrain } from '@/systems/generation/WorldGenerator';
import { floodFillIndices, brushFootprint, lineTiles } from '@/systems/editor/shapes';

describe('TileGrid', () => {
  it('round-trips through RLE', () => {
    const g = generateTerrain(64, 48, 'continent', 1234);
    const back = TileGrid.fromRle(64, 48, g.toRle());
    expect(Array.from(back.tiles)).toEqual(Array.from(g.tiles));
  });

  it('rejects corrupt RLE', () => {
    expect(() => TileGrid.fromRle(4, 4, '0*f')).toThrow();
    expect(() => TileGrid.fromRle(4, 4, 'z*g')).toThrow();
  });

  it('resizes with anchor offset', () => {
    const g = new TileGrid(2, 2, 3);
    const r = g.resized(4, 4, 1, 1, 4);
    expect(r.get(0, 0)).toBe(4);
    expect(r.get(1, 1)).toBe(3);
    expect(r.get(2, 2)).toBe(3);
    expect(r.get(3, 3)).toBe(4);
  });

  it('is deterministic per seed', () => {
    expect(generateTerrain(32, 32, 'islands', 9).toRle()).toBe(generateTerrain(32, 32, 'islands', 9).toRle());
  });
});

describe('editor shapes', () => {
  it('flood fills only the connected region', () => {
    const g = new TileGrid(5, 1, 0);
    g.set(2, 0, 1);
    expect(floodFillIndices(g, 0, 0).sort()).toEqual([0, 1]);
  });
  it('brush footprints have the right area', () => {
    expect(brushFootprint(1, 'square')).toHaveLength(1);
    expect(brushFootprint(3, 'square')).toHaveLength(9);
    expect(brushFootprint(5, 'circle').length).toBeLessThan(25);
  });
  it('lines are gapless', () => {
    expect(lineTiles(0, 0, 5, 2)).toHaveLength(6);
  });
});

import { darkness, formatGameTime } from '@/simulation/time';
describe('game time', () => {
  it('formats and computes day/night', () => {
    expect(formatGameTime(1440 + 65)).toBe('Day 2 · 01:05');
    expect(darkness(12 * 60)).toBe(0);
    expect(darkness(23 * 60)).toBe(1);
    expect(darkness(6 * 60)).toBeCloseTo(0.5);
  });
});
