import { useEffect, useRef, useState } from 'react';
import { gridToImageData, TERRAIN_RGB } from '@/game/textures/mapImage';
import type { GameSession } from '@/session/GameSession';

const BOX = 236;

/**
 * Live minimap: 1 pixel per tile, updated incrementally on tile edits.
 * Shows the camera viewport; click or drag to move the camera.
 */
export function Minimap({ session }: { session: GameSession }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<ImageData | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [dims, setDims] = useState({ w: session.runtime.grid.width, h: session.runtime.grid.height });
  const dragging = useRef(false);

  useEffect(() => {
    const rt = session.runtime;
    let pending = false;
    const flush = () => {
      pending = false;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && imgRef.current) ctx.putImageData(imgRef.current, 0, 0);
    };
    const schedule = () => {
      if (!pending) {
        pending = true;
        requestAnimationFrame(flush);
      }
    };
    const full = () => {
      const g = rt.grid;
      const c = canvasRef.current;
      if (!c) return;
      c.width = g.width;
      c.height = g.height;
      imgRef.current = gridToImageData(g);
      setDims({ w: g.width, h: g.height });
      schedule();
    };
    full();
    const offTiles = rt.events.on('tiles:changed', ({ indices }) => {
      const img = imgRef.current;
      if (!img) return;
      const t = rt.grid.tiles;
      for (let i = 0; i < indices.length; i++) {
        const idx = indices[i];
        const c = TERRAIN_RGB[t[idx]];
        img.data[idx * 4] = c[0];
        img.data[idx * 4 + 1] = c[1];
        img.data[idx * 4 + 2] = c[2];
      }
      schedule();
    });
    const offMap = rt.events.on('map:replaced', full);
    const offCam = session.bridge.on('camera:moved', (v) => setView(v));
    return () => {
      offTiles();
      offMap();
      offCam();
    };
  }, [session]);

  const scale = Math.min(BOX / dims.w, BOX / dims.h);
  const cw = dims.w * scale;
  const ch = dims.h * scale;

  const moveTo = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - r.left) / scale;
    const y = (e.clientY - r.top) / scale;
    session.bridge.emit('camera:centerTile', { x, y });
  };

  return (
    <div className="minimap-box" style={{ height: BOX }}>
      <div
        className="minimap"
        style={{ width: cw, height: ch }}
        onPointerDown={(e) => { dragging.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); moveTo(e); }}
        onPointerMove={(e) => dragging.current && moveTo(e)}
        onPointerUp={() => (dragging.current = false)}
      >
        <canvas ref={canvasRef} style={{ width: cw, height: ch }} />
        <div
          className="minimap-view"
          style={{
            left: Math.max(0, view.x * scale),
            top: Math.max(0, view.y * scale),
            width: Math.min(cw, (view.x + view.w) * scale) - Math.max(0, view.x * scale),
            height: Math.min(ch, (view.y + view.h) * scale) - Math.max(0, view.y * scale),
          }}
        />
      </div>
    </div>
  );
}
