/** Render order. Standing things are y-sorted between ENTITY_BASE and NIGHT. */
export const DEPTH = {
  TERRAIN: 0,
  FLAT_OBJECTS: 4,
  REGIONS: 6,
  GRID: 10,
  ENTITY_BASE: 1000,
  NIGHT: 900_000,
  OVERLAY: 900_100,
  LABELS: 900_200,
  CURSOR: 900_300,
};

export const entityDepth = (bottomPx: number) => DEPTH.ENTITY_BASE + bottomPx;
