import type { NavGrid } from './NavGrid';

/**
 * A* on the nav grid, 8 directions without corner cutting.
 * Buffers are reused between searches (generation stamps instead of clearing),
 * and each search is capped so one unreachable target can't stall a tick.
 */
export class Pathfinder {
  private g = new Float32Array(0);
  private parent = new Int32Array(0);
  private stamp = new Uint32Array(0);
  private closed = new Uint32Array(0);
  private gen = 0;
  private heap: number[] = [];
  private f = new Float32Array(0);

  constructor(private nav: NavGrid) {}

  private ensureBuffers(n: number) {
    if (this.g.length === n) return;
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.gen = 0;
  }

  /** Returns tile indices from (excluding) start to goal, or null if unreachable within budget. */
  find(sx: number, sy: number, gx: number, gy: number, maxNodes = 3000): number[] | null {
    const nav = this.nav;
    nav.ensure();
    const W = nav.width;
    const H = nav.height;
    if (gx < 0 || gy < 0 || gx >= W || gy >= H || !nav.walkable[gy * W + gx]) return null;
    this.ensureBuffers(W * H);
    const gen = ++this.gen;
    const start = sy * W + sx;
    const goal = gy * W + gx;
    if (start === goal) return [];
    const heap = this.heap;
    heap.length = 0;
    const h = (i: number) => {
      const dx = Math.abs((i % W) - gx);
      const dy = Math.abs(((i / W) | 0) - gy);
      return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
    };
    this.g[start] = 0;
    this.f[start] = h(start);
    this.stamp[start] = gen;
    this.parent[start] = -1;
    this.push(start);
    let expanded = 0;
    while (heap.length) {
      const cur = this.pop();
      if (cur === goal) return this.build(goal, start);
      if (this.closed[cur] === gen) continue;
      this.closed[cur] = gen;
      if (++expanded > maxNodes) return null;
      const cx = cur % W;
      const cy = (cur / W) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          if (!nav.walkable[ni] || this.closed[ni] === gen) continue;
          if (dx && dy && (!nav.walkable[cy * W + nx] || !nav.walkable[ny * W + cx])) continue; // no corner cutting
          const step = (dx && dy ? 1.414 : 1) * nav.cost[ni];
          const ng = this.g[cur] + step;
          if (this.stamp[ni] !== gen || ng < this.g[ni]) {
            this.stamp[ni] = gen;
            this.g[ni] = ng;
            this.f[ni] = ng + h(ni);
            this.parent[ni] = cur;
            this.push(ni);
          }
        }
      }
    }
    return null;
  }

  private build(goal: number, start: number): number[] {
    const out: number[] = [];
    for (let i = goal; i !== start && i !== -1; i = this.parent[i]) out.push(i);
    return out.reverse();
  }

  private push(i: number) {
    const heap = this.heap;
    const f = this.f;
    heap.push(i);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (f[heap[p]] <= f[heap[k]]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  }

  private pop(): number {
    const heap = this.heap;
    const f = this.f;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  }
}
