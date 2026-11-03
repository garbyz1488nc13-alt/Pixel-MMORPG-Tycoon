import Phaser from 'phaser';
import { useSettingsStore } from '@/stores/settingsStore';

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 4;

const isTyping = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

/**
 * Smooth top-down camera: WASD/arrow pan, right/middle/space-drag pan,
 * mouse-wheel zoom anchored at the cursor, clamped to the map.
 */
export class CameraController {
  private keys = new Set<string>();
  private dragging = false;
  private targetZoom: number;
  private zoomAnchor: { sx: number; sy: number } | null = null;
  private velocity = new Phaser.Math.Vector2();
  spaceHeld = false;

  constructor(scene: Phaser.Scene, private cam: Phaser.Cameras.Scene2D.Camera, private mapSize: () => { w: number; h: number }) {
    this.targetZoom = cam.zoom;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    const input = scene.input;
    input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.middleButtonDown() || p.rightButtonDown() || (p.leftButtonDown() && this.spaceHeld)) this.dragging = true;
    });
    input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      this.cam.scrollX -= (p.x - p.prevPosition.x) / this.cam.zoom;
      this.cam.scrollY -= (p.y - p.prevPosition.y) / this.cam.zoom;
      this.clamp();
    });
    const stop = () => (this.dragging = false);
    input.on('pointerup', stop);
    input.on('pointerupoutside', stop);
    input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const step = useSettingsStore.getState().zoomStep;
      this.zoomAt(dy > 0 ? 1 / step : step, p.x, p.y);
    });
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  /** Multiply the zoom, keeping the world point under screen (sx, sy) fixed. */
  zoomAt(factor: number, sx = this.cam.width / 2, sy = this.cam.height / 2): void {
    this.targetZoom = Phaser.Math.Clamp(this.targetZoom * factor, MIN_ZOOM, MAX_ZOOM);
    this.zoomAnchor = { sx, sy };
  }

  setZoomImmediate(z: number): void {
    this.targetZoom = Phaser.Math.Clamp(z, MIN_ZOOM, MAX_ZOOM);
    this.cam.setZoom(this.targetZoom);
    this.zoomAnchor = null;
  }

  centerOn(x: number, y: number): void {
    this.cam.centerOn(x, y);
    this.clamp();
  }

  fit(): void {
    const { w, h } = this.mapSize();
    const z = Math.min(this.cam.width / w, this.cam.height / h) * 0.95;
    this.setZoomImmediate(z);
    this.cam.centerOn(w / 2, h / 2);
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    // Smooth zoom toward target around the anchor.
    if (Math.abs(this.cam.zoom - this.targetZoom) > 0.0005) {
      const a = this.zoomAnchor ?? { sx: this.cam.width / 2, sy: this.cam.height / 2 };
      const before = this.cam.getWorldPoint(a.sx, a.sy);
      const next = Phaser.Math.Linear(this.cam.zoom, this.targetZoom, Math.min(1, dt * 14));
      this.cam.setZoom(Math.abs(next - this.targetZoom) < 0.001 ? this.targetZoom : next);
      this.cam.preRender(); // refresh matrix so getWorldPoint uses the new zoom
      const after = this.cam.getWorldPoint(a.sx, a.sy);
      this.cam.scrollX += before.x - after.x;
      this.cam.scrollY += before.y - after.y;
      this.clamp();
    }

    // Keyboard pan with acceleration/deceleration.
    let ix = 0;
    let iy = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) ix -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) ix += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) iy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) iy += 1;
    const speed = useSettingsStore.getState().panSpeed * (this.keys.has('shift') ? 2 : 1);
    const target = new Phaser.Math.Vector2(ix, iy).normalize().scale(speed);
    this.velocity.lerp(target, Math.min(1, dt * 12));
    if (this.velocity.lengthSq() > 1) {
      this.cam.scrollX += (this.velocity.x * dt) / this.cam.zoom;
      this.cam.scrollY += (this.velocity.y * dt) / this.cam.zoom;
      this.clamp();
    }
  }

  /** Keep at least part of the map on screen. */
  clamp(): void {
    const { w, h } = this.mapSize();
    const mid = this.cam.midPoint;
    const viewW = this.cam.width / this.cam.zoom;
    const viewH = this.cam.height / this.cam.zoom;
    const cx = Phaser.Math.Clamp(mid.x, Math.min(w / 2, viewW * 0.25), Math.max(w / 2, w - viewW * 0.25));
    const cy = Phaser.Math.Clamp(mid.y, Math.min(h / 2, viewH * 0.25), Math.max(h / 2, h - viewH * 0.25));
    if (cx !== mid.x || cy !== mid.y) this.cam.centerOn(cx, cy);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === ' ') {
      this.spaceHeld = true;
      e.preventDefault();
    }
    if (k.startsWith('arrow')) e.preventDefault();
    this.keys.add(k);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === ' ') this.spaceHeld = false;
    this.keys.delete(k);
  };

  private onBlur = () => {
    this.keys.clear();
    this.spaceHeld = false;
    this.dragging = false;
  };

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
