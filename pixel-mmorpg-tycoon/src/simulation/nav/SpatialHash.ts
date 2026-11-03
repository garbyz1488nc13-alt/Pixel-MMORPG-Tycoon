/** Uniform-grid spatial hash for fast "who is near me" queries (aggro, guard radius). */
export class SpatialHash<T extends { x: number; y: number }> {
  private cells = new Map<number, Set<T>>();
  private where = new Map<T, number>();

  constructor(private cellSize = 8) {}

  private key(x: number, y: number): number {
    return ((Math.floor(x / this.cellSize) + 4096) << 13) | (Math.floor(y / this.cellSize) + 4096);
  }

  upsert(item: T): void {
    const k = this.key(item.x, item.y);
    const old = this.where.get(item);
    if (old === k) return;
    if (old !== undefined) this.cells.get(old)?.delete(item);
    let set = this.cells.get(k);
    if (!set) this.cells.set(k, (set = new Set()));
    set.add(item);
    this.where.set(item, k);
  }

  remove(item: T): void {
    const old = this.where.get(item);
    if (old !== undefined) this.cells.get(old)?.delete(item);
    this.where.delete(item);
  }

  query(x: number, y: number, r: number, out: T[] = []): T[] {
    const cs = this.cellSize;
    const x0 = Math.floor((x - r) / cs), x1 = Math.floor((x + r) / cs);
    const y0 = Math.floor((y - r) / cs), y1 = Math.floor((y + r) / cs);
    const r2 = r * r;
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const set = this.cells.get(((cx + 4096) << 13) | (cy + 4096));
        if (!set) continue;
        for (const it of set) {
          const dx = it.x - x, dy = it.y - y;
          if (dx * dx + dy * dy <= r2) out.push(it);
        }
      }
    return out;
  }

  clear(): void {
    this.cells.clear();
    this.where.clear();
  }
}
