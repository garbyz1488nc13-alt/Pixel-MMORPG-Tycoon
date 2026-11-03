/** Pixel plotting on an "art pixel" grid (each art pixel = SCALE screen pixels). */
export const ART_SCALE = 2;

export class ArtCanvas {
  constructor(private ctx: CanvasRenderingContext2D, private ox: number, private oy: number, readonly w: number, readonly h: number, private scale = ART_SCALE) {}

  px(x: number, y: number, c: string): void {
    if (!c) { this.clear(x, y); return; }
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.ctx.fillStyle = c;
    this.ctx.fillRect(this.ox + x * this.scale, this.oy + y * this.scale, this.scale, this.scale);
  }

  /** Punch a transparent pixel ('' colour). */
  clear(x: number, y: number): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.ctx.clearRect(this.ox + x * this.scale, this.oy + y * this.scale, this.scale, this.scale);
  }

  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }

  hline(x0: number, x1: number, y: number, c: string): void {
    for (let x = x0; x <= x1; x++) this.px(x, y, c);
  }

  vline(x: number, y0: number, y1: number, c: string): void {
    for (let y = y0; y <= y1; y++) this.px(x, y, c);
  }

  outlineRect(x: number, y: number, w: number, h: number, c: string): void {
    this.hline(x, x + w - 1, y, c);
    this.hline(x, x + w - 1, y + h - 1, c);
    this.vline(x, y, y + h - 1, c);
    this.vline(x + w - 1, y, y + h - 1, c);
  }

  /** Filled ellipse; `edge` draws a 1px outline in another colour. */
  ellipse(cx: number, cy: number, rx: number, ry: number, fill: string, edge?: string): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d <= 1) {
          const inner = ((x - cx) / Math.max(0.1, rx - 1)) ** 2 + ((y - cy) / Math.max(0.1, ry - 1)) ** 2;
          this.px(x, y, edge && inner > 1 ? edge : fill);
        }
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }

  /** Draw string art: each char maps to a colour (or '.' = transparent). */
  pattern(rows: string[], colors: Record<string, string>, ox = 0, oy = 0, flip = false): void {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[flip ? row.length - 1 - x : x];
        const c = colors[ch];
        if (c) this.px(ox + x, oy + y, c);
      }
    });
  }

  shadow(cx: number, cy: number, rx: number, ry: number): void {
    this.ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && x >= 0 && y >= 0 && x < this.w && y < this.h)
          this.ctx.fillRect(this.ox + x * this.scale, this.oy + y * this.scale, this.scale, this.scale);
  }
}
