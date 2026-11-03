import { useEffect, useState } from 'react';
import { randomSeed } from '@/core/random';
import { TERRAINS, TerrainId } from '@/data/terrain';
import { DEFAULT_TERRAIN_FOR_TYPE, DIFFICULTIES, MAX_MAP_SIZE, MIN_MAP_SIZE, WORLD_TYPES, type WorldType } from '@/data/worldPresets';
import { SAVE_SLOTS, type SaveSlotKey, type SaveSlotRecord } from '@/models/world';
import { WorldRepository } from '@/persistence/WorldRepository';
import { exportWorldJson } from '@/persistence/serializer';
import type { GameSession } from '@/session/GameSession';
import { downloadText, loadAndOpenWorld, safeFileName } from '@/session/sessionActions';
import { generateTerrain } from '@/systems/generation/WorldGenerator';
import { confirmDialog } from '@/stores/dialogStore';
import { log } from '@/stores/logStore';
import { useSessionStore } from '@/stores/sessionStore';
import { toast } from '@/stores/toastStore';
import { PixelIcon } from '../components/PixelIcon';
import { SettingsForm } from '../components/SettingsForm';
import { formatDate } from '../screens/WorldCard';

const ANCHORS = [
  [0, 0], [0.5, 0], [1, 0],
  [0, 0.5], [0.5, 0.5], [1, 0.5],
  [0, 1], [0.5, 1], [1, 1],
] as const;

export function WorldSettingsPanel({ session }: { session: GameSession }) {
  const rt = session.runtime;
  const worldName = useSessionStore((s) => s.worldName);
  const lastSavedAt = useSessionStore((s) => s.lastSavedAt);
  const [, force] = useState(0);
  const [w, setW] = useState(rt.grid.width);
  const [h, setH] = useState(rt.grid.height);
  const [anchor, setAnchor] = useState(4);
  const [fill, setFill] = useState<TerrainId>(DEFAULT_TERRAIN_FOR_TYPE[rt.config.worldType]);
  const [genType, setGenType] = useState<WorldType>(rt.config.worldType);
  const [genSeed, setGenSeed] = useState(rt.config.seed);
  const [slots, setSlots] = useState<Omit<SaveSlotRecord, 'data'>[]>([]);

  useEffect(() => {
    WorldRepository.listSlots(rt.id).then(setSlots);
  }, [rt.id, lastSavedAt]);

  useEffect(() => {
    const off = rt.events.on('map:replaced', ({ grid }) => {
      setW(grid.width);
      setH(grid.height);
    });
    return off;
  }, [rt]);

  const clamp = (v: number) => Math.max(MIN_MAP_SIZE, Math.min(MAX_MAP_SIZE, Math.round(v) || MIN_MAP_SIZE));

  const resize = () => {
    const nw = clamp(w);
    const nh = clamp(h);
    const [ax, ay] = ANCHORS[anchor];
    const ox = Math.round((nw - rt.grid.width) * ax);
    const oy = Math.round((nh - rt.grid.height) * ay);
    session.painter.replaceMap(rt.grid.resized(nw, nh, ox, oy, fill), 'Resize map');
    log.system(`Map resized to ${nw}×${nh}.`, 'success', rt.clock.totalMinutes);
    toast(`Map resized to ${nw}×${nh}`, 'success');
  };

  const regenerate = async () => {
    const ok = await confirmDialog({ title: 'Regenerate terrain', message: 'Replace all terrain with a newly generated map?\nYou can undo this with Ctrl+Z.', confirmLabel: 'Regenerate' });
    if (!ok) return;
    session.painter.replaceMap(generateTerrain(rt.grid.width, rt.grid.height, genType, genSeed), 'Regenerate terrain');
    rt.config.worldType = genType;
    rt.config.seed = genSeed;
    log.system(`Terrain regenerated (${genType}, seed ${genSeed}).`, 'success', rt.clock.totalMinutes);
  };

  const updateConfig = (patch: Partial<typeof rt.config>) => {
    Object.assign(rt.config, patch);
    rt.markDirty();
    force((n) => n + 1);
  };

  const saveTo = async (slot: SaveSlotKey) => {
    if (await session.save(slot)) toast('Saved', 'success');
  };

  const loadSlot = async (slot: SaveSlotKey) => {
    const ok = await confirmDialog({ title: 'Load save slot', message: `Load ${SAVE_SLOTS.find((s) => s.key === slot)?.label}?${useSessionStore.getState().dirty ? '\nUnsaved changes will be lost.' : ''}`, confirmLabel: 'Load', danger: useSessionStore.getState().dirty });
    if (ok) await loadAndOpenWorld(rt.id, slot);
  };

  const exportJson = () => {
    downloadText(`${safeFileName(rt.name)}.world.json`, exportWorldJson(rt.toSave()));
    log.system('World exported to JSON.', 'success', rt.clock.totalMinutes);
  };

  return (
    <div className="world-settings scroll">
      <div className="settings-columns">
        <div className="panel settings-card">
          <div className="panel-header">World</div>
          <div className="section">
            <div className="field">
              <label>Name</label>
              <input className="input" defaultValue={worldName} key={worldName} maxLength={48} onBlur={(e) => e.target.value.trim() && e.target.value !== worldName && rt.rename(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
            </div>
            <div className="field">
              <label>Difficulty</label>
              <div className="chip-row">
                {DIFFICULTIES.map((d) => (
                  <button key={d.key} className={`btn small ${rt.config.difficulty === d.key ? 'active' : ''}`} onClick={() => updateConfig({ difficulty: d.key })}>{d.label}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Treasury (gold)</label>
              <input className="input" type="number" min={0} step={500} value={rt.config.startingGold} onChange={(e) => updateConfig({ startingGold: Math.max(0, +e.target.value) })} />
            </div>
            <div className="two-col">
              <div className="field">
                <label>Initial NPCs</label>
                <input className="input" type="number" min={0} max={200} value={rt.config.initialNpcCount} onChange={(e) => updateConfig({ initialNpcCount: Math.max(0, Math.min(200, +e.target.value)) })} />
              </div>
              <div className="field">
                <label>Initial players</label>
                <input className="input" type="number" min={0} max={1000} value={rt.config.initialPlayerCount} onChange={(e) => updateConfig({ initialPlayerCount: Math.max(0, Math.min(1000, +e.target.value)) })} />
              </div>
            </div>
            <div className="hint">Created {formatDate(rt.createdAt)} · ID {rt.id}</div>
          </div>
        </div>

        <div className="panel settings-card">
          <div className="panel-header">Map size</div>
          <div className="section">
            <div className="row">
              <input className="input" type="number" min={MIN_MAP_SIZE} max={MAX_MAP_SIZE} value={w} onChange={(e) => setW(+e.target.value)} style={{ width: 90 }} />
              ×
              <input className="input" type="number" min={MIN_MAP_SIZE} max={MAX_MAP_SIZE} value={h} onChange={(e) => setH(+e.target.value)} style={{ width: 90 }} />
              <span className="hint">now {rt.grid.width}×{rt.grid.height}</span>
            </div>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="field">
                <label>Anchor</label>
                <div className="anchor-grid">
                  {ANCHORS.map((_, i) => (
                    <button key={i} className={`anchor ${anchor === i ? 'active' : ''}`} onClick={() => setAnchor(i)} title="Where the existing map stays" />
                  ))}
                </div>
              </div>
              <div className="field grow">
                <label>Fill new area with</label>
                <select className="input" value={fill} onChange={(e) => setFill(+e.target.value)}>
                  {TERRAINS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <button className="btn primary" onClick={resize}>Apply resize</button>
          </div>

          <div className="panel-header">Regenerate terrain</div>
          <div className="section">
            <select className="input" value={genType} onChange={(e) => setGenType(e.target.value as WorldType)}>
              {WORLD_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <div className="row">
              <input className="input grow" type="number" value={genSeed} onChange={(e) => setGenSeed(Math.abs(Math.floor(+e.target.value)) || 0)} />
              <button className="btn icon" title="Random seed" onClick={() => setGenSeed(randomSeed())}><PixelIcon name="dice" /></button>
            </div>
            <button className="btn" onClick={regenerate}>Regenerate</button>
          </div>
        </div>

        <div className="panel settings-card">
          <div className="panel-header">Saves</div>
          <div className="section slot-list">
            {SAVE_SLOTS.map((s) => {
              const info = slots.find((x) => x.slot === s.key);
              return (
                <div key={s.key} className="slot-row">
                  <PixelIcon name="save" />
                  <div className="grow">
                    <div>{s.label}</div>
                    <div className="hint">{info ? formatDate(info.savedAt) : 'empty'}</div>
                  </div>
                  {s.key !== 'auto' && <button className="btn small" onClick={() => saveTo(s.key)}>Save</button>}
                  <button className="btn small" disabled={!info} onClick={() => loadSlot(s.key)}>Load</button>
                </div>
              );
            })}
            <button className="btn" onClick={exportJson}><PixelIcon name="export" /> Export world JSON</button>
            <div className="hint">Import JSON from Main Menu → Load World.</div>
          </div>
        </div>

        <div className="panel settings-card">
          <div className="panel-header">Game settings</div>
          <div className="section"><SettingsForm /></div>
        </div>
      </div>
    </div>
  );
}
