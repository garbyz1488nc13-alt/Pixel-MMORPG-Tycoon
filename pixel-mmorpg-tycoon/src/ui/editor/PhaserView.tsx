import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import type { GameSession } from '@/session/GameSession';
import { useEditorStore } from '@/stores/editorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { PixelIcon } from '../components/PixelIcon';

/** Mounts the Phaser game for the session and overlays camera controls / status. */
export function PhaserView({ session }: { session: GameSession }) {
  const host = useRef<HTMLDivElement>(null);
  const [fps, setFps] = useState(0);
  const zoom = useEditorStore((s) => s.zoom);
  const hover = useEditorStore((s) => s.hover);
  const showFps = useSettingsStore((s) => s.showFps);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let game: Phaser.Game | null = null;
    let disposed = false;
    // Phaser is loaded lazily so the menus start fast.
    import('@/game/createGame').then(({ createGame }) => {
      if (disposed) return;
      game = createGame(el, session);
    });
    const ro = new ResizeObserver(() => game?.scale.refresh());
    ro.observe(el);
    const off = session.bridge.on('scene:fps', ({ fps }) => setFps(fps));
    return () => {
      disposed = true;
      off();
      ro.disconnect();
      game?.destroy(true);
    };
  }, [session]);

  return (
    <div className="phaser-wrap">
      <div ref={host} className="phaser-host" />
      <div className="view-controls">
        <button className="btn icon" title="Zoom in (+)" onClick={() => session.bridge.emit('camera:zoomBy', { factor: 1.25 })}><PixelIcon name="plus" /></button>
        <div className="zoom-label">{Math.round(zoom * 100)}%</div>
        <button className="btn icon" title="Zoom out (−)" onClick={() => session.bridge.emit('camera:zoomBy', { factor: 0.8 })}><PixelIcon name="minus" /></button>
        <button className="btn icon" title="Fit map (Home)" onClick={() => session.bridge.emit('camera:fit', undefined)}><PixelIcon name="fit" /></button>
      </div>
      <div className="view-status">
        {hover ? `X ${hover.x}  Y ${hover.y}` : '—'}
        {showFps && <span className="fps">{fps} FPS</span>}
      </div>
    </div>
  );
}
