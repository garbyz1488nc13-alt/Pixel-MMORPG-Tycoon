import Phaser from 'phaser';
import { getObjectDef } from '@/data/objects';
import { TILE_SIZE } from '@/data/terrain';
import type { GameSession } from '@/session/GameSession';
import { DEPTH } from './depth';

const S = TILE_SIZE;

interface Light { x: number; y: number; r: number; color: number; flicker: number; window?: boolean }

/** Light sources by object kind: radius in tiles, colour, flicker strength. */
const SOURCES: Record<string, { r: number; color: number; flicker: number; dy?: number }> = {
  campfire: { r: 3.2, color: 0xff8a2a, flicker: 0.25 },
  torch: { r: 2.4, color: 0xff9a3a, flicker: 0.2, dy: -0.8 },
  lamp: { r: 2.6, color: 0xffd27a, flicker: 0.05, dy: -0.8 },
  portal: { r: 2.2, color: 0xb56cff, flicker: 0.1 },
  dungeon_entrance: { r: 1.6, color: 0xff6a3a, flicker: 0.15 },
};
/** Buildings with lit windows at night. */
const WINDOWS = new Set(['house_small', 'house_large', 'shop', 'smithy', 'tavern', 'temple', 'bank', 'hut', 'tower']);

/**
 * Warm light at night: glows around fires, torches, lamps and portals, and lit
 * windows on houses. Drawn additively above the night overlay so it cuts the dark.
 */
export class LightRenderer {
  private gfx: Phaser.GameObjects.Graphics;
  private lights: Light[] = [];
  private version = -1;
  private time = 0;

  constructor(private scene: Phaser.Scene, private session: GameSession) {
    this.gfx = scene.add.graphics().setDepth(DEPTH.NIGHT + 1).setBlendMode(Phaser.BlendModes.ADD);
  }

  private rebuild(): void {
    this.lights = [];
    for (const o of this.session.runtime.entities.list('objects')) {
      const d = getObjectDef(o.kind);
      if (!d) continue;
      const src = SOURCES[o.kind];
      if (src) this.lights.push({ x: o.x + d.w / 2, y: o.y + d.h / 2 + (src.dy ?? 0), r: src.r, color: src.color, flicker: src.flicker });
      if (WINDOWS.has(o.kind)) {
        // A couple of windows per building; some houses are dark (people asleep).
        let h = 0;
        for (let i = 0; i < o.id.length; i++) h = (h * 31 + o.id.charCodeAt(i)) | 0;
        if (Math.abs(h) % 5 === 0 && o.kind.startsWith('house')) continue;
        const wy = o.y + d.h * 0.45;
        for (const fx of d.w >= 3 ? [0.25, 0.75] : [0.3, 0.7]) this.lights.push({ x: o.x + d.w * fx, y: wy, r: 0.9, color: 0xffc860, flicker: 0.03, window: true });
      }
    }
  }

  update(dt: number, darkness: number): void {
    this.time += dt;
    const g = this.gfx;
    g.clear();
    if (darkness < 0.05) return;
    const store = this.session.runtime.entities;
    if (store.version !== this.version) { this.version = store.version; this.rebuild(); }
    const view = this.scene.cameras.main.worldView;
    const k = Math.min(1, darkness * 1.6);
    for (const l of this.lights) {
      const px = l.x * S, py = l.y * S, r = l.r * S;
      if (px + r < view.x || px - r > view.right || py + r < view.y || py - r > view.bottom) continue;
      const f = 1 - l.flicker + l.flicker * (0.5 + 0.5 * Math.sin(this.time / 90 + l.x * 7.1 + l.y * 3.3));
      if (l.window) {
        g.fillStyle(l.color, 0.1 * k).fillCircle(px, py, r * 0.55 * f);
        g.fillStyle(l.color, 0.55 * k).fillRect(px - 4, py - 4, 8, 8);
        continue;
      }
      // Soft falloff: a few stacked discs.
      for (const [rr, a] of [[1, 0.1], [0.7, 0.12], [0.45, 0.16], [0.22, 0.22]] as const) g.fillStyle(l.color, a * k * f).fillCircle(px, py, r * rr * f);
    }
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
