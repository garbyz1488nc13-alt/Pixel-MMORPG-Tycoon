import { TERRAINS } from '@/data/terrain';
import { MAX_BRUSH, useEditorStore } from '@/stores/editorStore';
import type { TerrainTool } from '@/systems/editor/TerrainPainter';
import { PixelIcon, type IconName } from '../components/PixelIcon';
import { TerrainSwatch } from '../components/TilePreview';

const TOOLS: { key: TerrainTool; label: string; icon: IconName; hotkey: string; hint: string }[] = [
  { key: 'brush', label: 'Brush', icon: 'brush', hotkey: 'B', hint: 'Click & drag to paint terrain.' },
  { key: 'fill', label: 'Fill', icon: 'fill', hotkey: 'F', hint: 'Flood-fill a connected area of the same terrain.' },
  { key: 'rect', label: 'Rectangle', icon: 'rect', hotkey: 'R', hint: 'Drag to paint a rectangle.' },
  { key: 'picker', label: 'Picker', icon: 'picker', hotkey: 'I', hint: 'Click a tile to pick its terrain.' },
];

const LOCKED: { label: string; phase: number }[] = [
  { label: 'Buildings', phase: 2 },
  { label: 'NPC', phase: 2 },
  { label: 'Creatures', phase: 2 },
  { label: 'Spawns', phase: 2 },
  { label: 'Items', phase: 3 },
];

export function LeftPanel() {
  const ed = useEditorStore();
  const activeTool = TOOLS.find((t) => t.key === ed.tool)!;

  return (
    <div className="side-panel panel scroll">
      <div className="panel-header">World Tools</div>
      <div className="section">
        <div className="tool-grid">
          {TOOLS.map((t) => (
            <button key={t.key} className={`btn tool-btn ${ed.tool === t.key ? 'active' : ''}`} title={`${t.label} (${t.hotkey})`} onClick={() => ed.setTool(t.key)}>
              <PixelIcon name={t.icon} size={20} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="hint">{activeTool.hint}</div>

        {ed.tool === 'brush' && (
          <>
            <div className="field">
              <label>Brush size: {ed.brushSize} <span className="hint">([ / ])</span></label>
              <input type="range" min={1} max={MAX_BRUSH} value={ed.brushSize} onChange={(e) => ed.setBrushSize(+e.target.value)} />
            </div>
            <div className="chip-row">
              <button className={`btn small ${ed.brushShape === 'square' ? 'active' : ''}`} onClick={() => ed.setBrushShape('square')}>Square</button>
              <button className={`btn small ${ed.brushShape === 'circle' ? 'active' : ''}`} onClick={() => ed.setBrushShape('circle')}>Circle</button>
            </div>
          </>
        )}
        {ed.tool === 'rect' && (
          <label className="check"><input type="checkbox" checked={ed.rectOutline} onChange={(e) => ed.setRectOutline(e.target.checked)} /> Outline only</label>
        )}
      </div>

      <div className="panel-header">Terrain</div>
      <div className="section terrain-list">
        {TERRAINS.map((t) => (
          <button key={t.id} className={`terrain-btn ${ed.terrain === t.id ? 'active' : ''}`} onClick={() => { ed.setTerrain(t.id); if (ed.tool === 'picker') ed.setTool('brush'); }} title={`${t.name} (${t.hotkey})`}>
            <TerrainSwatch terrain={t.id} size={28} />
            <span className="grow">{t.name}</span>
            {!t.walkable && <span className="badge" title="Not walkable">BLOCK</span>}
            <span className="hotkey">{t.hotkey}</span>
          </button>
        ))}
      </div>

      <div className="panel-header">Coming next</div>
      <div className="section">
        {LOCKED.map((l) => (
          <div key={l.label} className="locked-row" title={`Arrives in Phase ${l.phase}`}>
            <PixelIcon name="lock" size={12} /> <span className="grow">{l.label}</span> <span className="badge">PHASE {l.phase}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
