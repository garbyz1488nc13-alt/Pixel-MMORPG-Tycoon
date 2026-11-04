import { CREATURE_TYPES } from '@/data/creatureTypes';
import { NPC_TYPES } from '@/data/npcTypes';
import { OBJECTS } from '@/data/objects';
import { TILE_SIZE } from '@/data/terrain';
import { ART_SCALE, ArtCanvas } from './ArtCanvas';
import { drawCreature, drawHumanoid, NPC_LOOKS, PLAYER_LOOKS , drawPlayerPose, PLAYER_POSES } from './characterArt';
import { OBJECT_ART } from './objectArt';
import { ICON_ART } from './iconArt';

export interface Frame { x: number; y: number; w: number; h: number }
export interface SpriteAtlasData { canvas: HTMLCanvasElement; frames: Record<string, Frame> }

export const ATLAS_KEY = 'sprites';
const ATLAS_WIDTH = 1024;
const PAD = 2;

let cached: SpriteAtlasData | null = null;

/**
 * Builds a single sprite atlas (one texture, one draw batch) with every
 * object, NPC and creature frame, packed into shelves.
 */
export function getSpriteAtlas(): SpriteAtlasData {
  if (cached) return cached;
  const jobs: { name: string; w: number; h: number; draw: (a: ArtCanvas) => void }[] = [];

  for (const o of OBJECTS) {
    const paint = OBJECT_ART[o.key];
    if (!paint) continue;
    jobs.push({ name: `obj:${o.key}`, w: o.w * TILE_SIZE, h: (o.h + (o.overhang ?? 0)) * TILE_SIZE, draw: paint });
  }
  for (const t of NPC_TYPES)
    for (let f = 0; f < 2; f++) jobs.push({ name: `npc:${t.key}:${f}`, w: TILE_SIZE, h: TILE_SIZE, draw: (a) => drawHumanoid(a, NPC_LOOKS[t.key], f) });
  for (const [key, look] of Object.entries(PLAYER_LOOKS))
    for (let f = 0; f < 2; f++) jobs.push({ name: `pl:${key}:${f}`, w: TILE_SIZE, h: TILE_SIZE, draw: (a) => drawHumanoid(a, look, f) });
  for (const [key, look] of Object.entries(PLAYER_LOOKS))
    for (const pose of PLAYER_POSES) jobs.push({ name: `pl:${key}:${pose}`, w: TILE_SIZE, h: TILE_SIZE, draw: (a) => drawPlayerPose(a, look, pose) });
  for (const t of CREATURE_TYPES)
    for (let f = 0; f < 2; f++) jobs.push({ name: `cr:${t.key}:${f}`, w: t.size * TILE_SIZE, h: t.size * TILE_SIZE, draw: (a) => drawCreature(a, t.key, f) });
  for (const [key, paint] of Object.entries(ICON_ART)) jobs.push({ name: `icon:${key}`, w: TILE_SIZE, h: TILE_SIZE, draw: paint });
  jobs.push({
    name: 'fx:quest', w: 8 * ART_SCALE, h: 10 * ART_SCALE,
    draw: (a) => { a.rect(2, 0, 4, 6, '#1a1020'); a.rect(3, 1, 2, 4, '#f2c14e'); a.rect(2, 7, 4, 3, '#1a1020'); a.rect(3, 8, 2, 1, '#f2c14e'); },
  });
  jobs.push({
    name: 'fx:live', w: 14 * ART_SCALE, h: 7 * ART_SCALE,
    draw: (a) => {
      a.rect(0, 0, 14, 7, '#c8102e');
      a.outlineRect(0, 0, 14, 7, '#5a0010');
      const W = '#ffffff';
      // L
      a.vline(2, 2, 4, W); a.px(3, 4, W);
      // I
      a.vline(5, 2, 4, W);
      // V
      a.px(7, 2, W); a.px(7, 3, W); a.px(8, 4, W); a.px(9, 3, W); a.px(9, 2, W);
      // E
      a.vline(11, 2, 4, W); a.px(12, 2, W); a.px(12, 3, W); a.px(12, 4, W);
    },
  });
  jobs.push({
    name: 'fx:zzz', w: 8 * ART_SCALE, h: 8 * ART_SCALE,
    draw: (a) => { a.hline(1, 4, 1, '#c9d6ff'); a.px(3, 2, '#c9d6ff'); a.px(2, 3, '#c9d6ff'); a.hline(1, 4, 4, '#c9d6ff'); a.hline(5, 7, 5, '#c9d6ff'); a.px(6, 6, '#c9d6ff'); a.hline(5, 7, 7, '#c9d6ff'); },
  });

  // Shelf packing (tallest first).
  jobs.sort((a, b) => b.h - a.h);
  const frames: Record<string, Frame> = {};
  let x = 0, y = 0, shelf = 0;
  for (const j of jobs) {
    if (x + j.w > ATLAS_WIDTH) { x = 0; y += shelf + PAD; shelf = 0; }
    frames[j.name] = { x, y, w: j.w, h: j.h };
    x += j.w + PAD;
    shelf = Math.max(shelf, j.h);
  }
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_WIDTH;
  canvas.height = y + shelf;
  const ctx = canvas.getContext('2d')!;
  for (const j of jobs) {
    const f = frames[j.name];
    j.draw(new ArtCanvas(ctx, f.x, f.y, f.w / ART_SCALE, f.h / ART_SCALE));
  }
  cached = { canvas, frames };
  return cached;
}

/** Draw an atlas frame into a DOM canvas (UI previews). */
export function drawFrame(ctx: CanvasRenderingContext2D, name: string, dx: number, dy: number, scale = 1): boolean {
  const { canvas, frames } = getSpriteAtlas();
  const f = frames[name];
  if (!f) return false;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, f.x, f.y, f.w, f.h, dx, dy, f.w * scale, f.h * scale);
  return true;
}
