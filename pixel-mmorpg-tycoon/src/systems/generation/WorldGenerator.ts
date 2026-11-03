import { fbm } from '@/core/noise';
import { TerrainId } from '@/data/terrain';
import type { WorldType } from '@/data/worldPresets';
import { TileGrid } from '@/models/TileGrid';

/**
 * Procedural terrain generator. Uses elevation + moisture + temperature noise
 * fields and maps them to terrain per world type. Deterministic per seed.
 */
export function generateTerrain(width: number, height: number, type: WorldType, seed: number): TileGrid {
  const grid = new TileGrid(width, height, TerrainId.Grass);
  if (type === 'flat') return grid;

  const scale = 1 / 28;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Distance to center, 0 in the middle, ~1 at the edges: shapes continents & islands.
      const dx = (x / width) * 2 - 1;
      const dy = (y / height) * 2 - 1;
      const edge = Math.min(1, Math.sqrt(dx * dx + dy * dy));

      const elev = fbm(x * scale, y * scale, seed, 5);
      const moist = fbm(x * scale * 1.3 + 500, y * scale * 1.3 + 500, seed + 77, 4);
      const detail = fbm(x * scale * 3, y * scale * 3, seed + 991, 2);

      grid.tiles[y * width + x] = pick(type, elev, moist, detail, edge);
    }
  }
  return grid;
}

function pick(type: WorldType, elev: number, moist: number, detail: number, edge: number): TerrainId {
  switch (type) {
    case 'continent': {
      const h = elev - edge * 0.45 + 0.12;
      if (h < 0.28) return TerrainId.Water;
      if (h < 0.32) return TerrainId.Sand;
      if (h > 0.62) return h > 0.7 ? TerrainId.Snow : TerrainId.Stone;
      if (moist > 0.62 && h < 0.42) return TerrainId.Swamp;
      if (moist < 0.32 && detail > 0.55) return TerrainId.Dirt;
      return TerrainId.Grass;
    }
    case 'islands': {
      const h = elev * 1.15 - edge * 0.25;
      if (h < 0.5) return TerrainId.Water;
      if (h < 0.54) return TerrainId.Sand;
      if (h > 0.78) return TerrainId.Stone;
      if (moist > 0.66) return TerrainId.Swamp;
      return TerrainId.Grass;
    }
    case 'highlands': {
      const h = elev;
      if (h < 0.3 && moist > 0.5) return TerrainId.Water;
      if (h > 0.62) return TerrainId.Snow;
      if (h > 0.48) return TerrainId.Stone;
      if (moist < 0.4) return TerrainId.Dirt;
      return TerrainId.Grass;
    }
    case 'desert': {
      if (moist > 0.72 && elev < 0.45) return TerrainId.Water;
      if (moist > 0.64 && elev < 0.5) return TerrainId.Grass;
      if (elev > 0.66) return TerrainId.Stone;
      if (detail > 0.68) return TerrainId.Dirt;
      return TerrainId.Sand;
    }
    case 'frozen': {
      if (elev < 0.3) return TerrainId.Water;
      if (elev > 0.6) return TerrainId.Stone;
      if (moist < 0.3 && detail > 0.5) return TerrainId.Dirt;
      return TerrainId.Snow;
    }
    case 'volcanic': {
      if (elev > 0.66) return TerrainId.Lava;
      if (elev > 0.58) return TerrainId.Stone;
      if (elev < 0.27) return TerrainId.Water;
      if (moist > 0.6) return TerrainId.Swamp;
      if (detail > 0.5) return TerrainId.Dirt;
      return TerrainId.Stone;
    }
    default:
      return TerrainId.Grass;
  }
}
