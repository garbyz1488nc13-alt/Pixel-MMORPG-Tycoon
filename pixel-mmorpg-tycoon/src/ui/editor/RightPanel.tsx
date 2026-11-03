import { useEffect, useState } from 'react';
import { getTerrain, TERRAINS } from '@/data/terrain';
import type { GameSession } from '@/session/GameSession';
import { useEditorStore } from '@/stores/editorStore';
import { TerrainSwatch } from '../components/TilePreview';
import { Minimap } from './Minimap';

function useTerrainStats(session: GameSession) {
  const [counts, setCounts] = useState(() => session.runtime.grid.countByTerrain());
  useEffect(() => {
    let timer: number | null = null;
    const recalc = () => {
      if (timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        setCounts(session.runtime.grid.countByTerrain());
      }, 300);
    };
    const a = session.runtime.events.on('tiles:changed', recalc);
    const b = session.runtime.events.on('map:replaced', recalc);
    return () => {
      a();
      b();
      if (timer !== null) clearTimeout(timer);
    };
  }, [session]);
  return counts;
}

export function RightPanel({ session }: { session: GameSession }) {
  const hover = useEditorStore((s) => s.hover);
  const terrain = useEditorStore((s) => s.terrain);
  const counts = useTerrainStats(session);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const walkable = counts.reduce((a, c, id) => (getTerrain(id).walkable ? a + c : a), 0);
  const grid = session.runtime.grid;
  const sel = getTerrain(terrain);

  return (
    <div className="side-panel panel scroll">
      <div className="panel-header">Minimap</div>
      <div className="section">
        <Minimap session={session} />
      </div>

      <div className="panel-header">Inspector</div>
      <div className="section">
        {hover ? (
          <div className="inspect">
            <TerrainSwatch terrain={hover.terrain} size={40} />
            <div className="grow">
              <div className="inspect-title">{getTerrain(hover.terrain).name}</div>
              <div className="hint">Tile ({hover.x}, {hover.y})</div>
              <div className="hint">
                {getTerrain(hover.terrain).walkable ? `Walkable · move cost ×${getTerrain(hover.terrain).moveCost}` : 'Blocks movement'}
              </div>
            </div>
          </div>
        ) : (
          <div className="hint">Hover the map to inspect a tile.</div>
        )}
        <div className="kv"><span>Painting with</span><span>{sel.name}</span></div>
      </div>

      <div className="panel-header">Map statistics</div>
      <div className="section">
        <div className="kv"><span>Size</span><span>{grid.width} × {grid.height}</span></div>
        <div className="kv"><span>Tiles</span><span>{total.toLocaleString()}</span></div>
        <div className="kv"><span>Walkable</span><span>{((walkable / total) * 100).toFixed(1)}%</span></div>
        <div className="terrain-bars">
          {TERRAINS.map((t) => {
            const pct = (counts[t.id] / total) * 100;
            return (
              <div key={t.id} className="bar-row" title={`${counts[t.id].toLocaleString()} tiles`}>
                <span className="bar-label">{t.name}</span>
                <div className="bar"><div className="bar-fill" style={{ width: `${pct}%`, background: t.palette[0] }} /></div>
                <span className="bar-val">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
