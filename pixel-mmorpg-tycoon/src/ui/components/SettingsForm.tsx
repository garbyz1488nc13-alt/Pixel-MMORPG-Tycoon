import { useSettingsStore } from '@/stores/settingsStore';
import { WorldRepository } from '@/persistence/WorldRepository';
import { confirmDialog } from '@/stores/dialogStore';
import { toast } from '@/stores/toastStore';

const AUTOSAVE_OPTIONS = [0, 1, 2, 5, 10];

/** Global (per-browser) settings. Every option here is applied live. */
export function SettingsForm({ showDanger = false }: { showDanger?: boolean }) {
  const s = useSettingsStore();

  const wipe = async () => {
    const ok = await confirmDialog({ title: 'Delete all worlds', message: 'Remove every saved world from this browser?\nThis cannot be undone.', confirmLabel: 'Delete all', danger: true });
    if (!ok) return;
    const worlds = await WorldRepository.listWorlds();
    for (const w of worlds) await WorldRepository.deleteWorld(w.id);
    toast(`Deleted ${worlds.length} world(s)`);
  };

  return (
    <div className="settings-form">
      <section>
        <h3 className="pixel-title">Saving</h3>
        <div className="field">
          <label>Autosave interval</label>
          <div className="chip-row">
            {AUTOSAVE_OPTIONS.map((m) => (
              <button key={m} className={`btn small ${s.autosaveMinutes === m ? 'active' : ''}`} onClick={() => s.update({ autosaveMinutes: m })}>
                {m === 0 ? 'Off' : `${m} min`}
              </button>
            ))}
          </div>
          <span className="hint">Autosave writes to the "Autosave" slot when the world has unsaved changes.</span>
        </div>
      </section>

      <section>
        <h3 className="pixel-title">Camera</h3>
        <div className="field">
          <label>Keyboard pan speed: {s.panSpeed}px/s</label>
          <input type="range" min={200} max={2000} step={50} value={s.panSpeed} onChange={(e) => s.update({ panSpeed: +e.target.value })} />
        </div>
        <div className="field">
          <label>Zoom step per wheel notch: ×{s.zoomStep.toFixed(2)}</label>
          <input type="range" min={1.05} max={1.5} step={0.01} value={s.zoomStep} onChange={(e) => s.update({ zoomStep: +e.target.value })} />
        </div>
      </section>

      <section>
        <h3 className="pixel-title">Display</h3>
        <label className="check"><input type="checkbox" checked={s.showGrid} onChange={(e) => s.update({ showGrid: e.target.checked })} /> Show tile grid (G)</label>
        <label className="check"><input type="checkbox" checked={s.animateTiles} onChange={(e) => s.update({ animateTiles: e.target.checked })} /> Animate water & lava</label>
        <label className="check"><input type="checkbox" checked={s.dayNightTint} onChange={(e) => s.update({ dayNightTint: e.target.checked })} /> Day / night lighting</label>
        <label className="check"><input type="checkbox" checked={s.showFps} onChange={(e) => s.update({ showFps: e.target.checked })} /> Show FPS counter</label>
      </section>

      <div className="row">
        <button className="btn" onClick={() => { s.reset(); toast('Settings reset'); }}>Reset to defaults</button>
        {showDanger && <button className="btn danger" onClick={wipe}>Delete all worlds</button>}
      </div>
    </div>
  );
}
