import { useEffect, useRef } from 'react';
import { getSpriteAtlas } from '@/game/sprites/SpriteAtlas';

/** Renders one atlas frame, scaled to fit a box, with crisp pixels. */
export function SpritePreview({ frame, box = 40 }: { frame: string; box?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const { canvas, frames } = getSpriteAtlas();
    const f = frames[frame];
    if (!c || !f) return;
    const scale = Math.min(box / f.w, box / f.h);
    c.width = Math.max(1, Math.round(f.w * scale));
    c.height = Math.max(1, Math.round(f.h * scale));
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(canvas, f.x, f.y, f.w, f.h, 0, 0, c.width, c.height);
  }, [frame, box]);
  return <canvas ref={ref} className="sprite-preview" />;
}
