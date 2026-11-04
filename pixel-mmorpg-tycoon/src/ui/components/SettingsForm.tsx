import { useSettingsStore } from '@/stores/settingsStore';
import { t } from '@/i18n';
import { WorldRepository } from '@/persistence/WorldRepository';
import { confirmDialog } from '@/stores/dialogStore';
import { toast } from '@/stores/toastStore';
import { LanguageSwitch } from './LanguageSwitch';
import { audio } from '@/audio/AudioEngine';

const AUTOSAVE_OPTIONS = [0, 1, 2, 5, 10];

/** Global (per-browser) settings. Every option here is applied live. */
export function SettingsForm({ showDanger = false }: { showDanger?: boolean }) {
  const s = useSettingsStore();

  const wipe = async () => {
    const ok = await confirmDialog({ title: t('Delete all worlds'), message: t('Remove every saved world from this browser?\nThis cannot be undone.'), confirmLabel: t('Delete all'), danger: true });
    if (!ok) return;
    const worlds = await WorldRepository.listWorlds();
    for (const w of worlds) await WorldRepository.deleteWorld(w.id);
    toast(t('Deleted worlds: {n}', { n: worlds.length }));
  };

  return (
    <div className="settings-form">
      <section>
        <h3 className="pixel-title">{t('Language')}</h3>
        <LanguageSwitch />
      </section>
      <section>
        <h3 className="pixel-title">{t('Saving')}</h3>
        <div className="field">
          <label>{t('Autosave interval')}</label>
          <div className="chip-row">
            {AUTOSAVE_OPTIONS.map((m) => (
              <button key={m} className={`btn small ${s.autosaveMinutes === m ? 'active' : ''}`} onClick={() => s.update({ autosaveMinutes: m })}>
                {m === 0 ? t('Off') : t('{n} min', { n: m })}
              </button>
            ))}
          </div>
          <span className="hint">{t('Autosave writes to the "Autosave" slot when the world has unsaved changes.')}</span>
        </div>
      </section>

      <section>
        <h3 className="pixel-title">{t('Sound')}</h3>
        <div className="field">
          <label>{t('Sound effects')}: {Math.round(s.sfxVolume * 100)}%</label>
          <input type="range" min={0} max={1} step={0.05} value={s.sfxVolume} onChange={(e) => s.update({ sfxVolume: +e.target.value })} onPointerUp={() => audio.play('levelup')} />
        </div>
        <div className="field">
          <label>{t('Music')}: {Math.round(s.musicVolume * 100)}%</label>
          <input type="range" min={0} max={1} step={0.05} value={s.musicVolume} onChange={(e) => s.update({ musicVolume: +e.target.value })} />
          <span className="hint">{t('8-bit sounds and chiptune music are generated live. The music turns into battle music while a raid fights a boss.')}</span>
        </div>
      </section>
      <section>
        <h3 className="pixel-title">{t('Camera')}</h3>
        <div className="field">
          <label>{t('Keyboard pan speed')}: {s.panSpeed}px/s</label>
          <input type="range" min={200} max={2000} step={50} value={s.panSpeed} onChange={(e) => s.update({ panSpeed: +e.target.value })} />
        </div>
        <div className="field">
          <label>{t('Zoom step per wheel notch')}: ×{s.zoomStep.toFixed(2)}</label>
          <input type="range" min={1.05} max={1.5} step={0.01} value={s.zoomStep} onChange={(e) => s.update({ zoomStep: +e.target.value })} />
        </div>
      </section>

      <section>
        <h3 className="pixel-title">{t('Display')}</h3>
        <label className="check"><input type="checkbox" checked={s.showGrid} onChange={(e) => s.update({ showGrid: e.target.checked })} /> {t('Show tile grid (G)')}</label>
        <label className="check"><input type="checkbox" checked={s.animateTiles} onChange={(e) => s.update({ animateTiles: e.target.checked })} /> {t('Animate water & lava')}</label>
        <label className="check"><input type="checkbox" checked={s.dayNightTint} onChange={(e) => s.update({ dayNightTint: e.target.checked })} /> {t('Day / night lighting')}</label>
        <label className="check"><input type="checkbox" checked={s.showRegions} onChange={(e) => s.update({ showRegions: e.target.checked })} /> {t('Show regions & spawn areas')}</label>
        <label className="check"><input type="checkbox" checked={s.showFps} onChange={(e) => s.update({ showFps: e.target.checked })} /> {t('Show FPS counter')}</label>
      </section>

      <div className="row">
        <button className="btn" onClick={() => { s.reset(); toast(t('Settings reset')); }}>{t('Reset to defaults')}</button>
        {showDanger && <button className="btn danger" onClick={wipe}>{t('Delete all worlds')}</button>}
      </div>
    </div>
  );
}
