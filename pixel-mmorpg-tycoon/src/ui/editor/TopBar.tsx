import { SAVE_SLOTS, type SaveSlotKey } from '@/models/world';
import { t } from '@/i18n';
import { dayPhase, formatGameTime } from '@/simulation/time';
import type { SimSpeed } from '@/simulation/types';
import { closeWorld } from '@/session/sessionActions';
import { confirmDialog, promptDialog } from '@/stores/dialogStore';
import { useEditorStore } from '@/stores/editorStore';
import { useSessionStore } from '@/stores/sessionStore';
import { toast } from '@/stores/toastStore';
import { PixelIcon } from '../components/PixelIcon';
import { useLiveCounts } from '../hooks/useEntities';
import { useRpg } from '../rpg/useRpg';

const SPEEDS: SimSpeed[] = [1, 2, 4];

export function TopBar() {
  const s = useSessionStore();
  const canUndo = useEditorStore((e) => e.canUndo);
  const canRedo = useEditorStore((e) => e.canRedo);
  const session = s.session!;
  const phase = dayPhase(s.gameMinutes);
  const live = useLiveCounts(session);

  const rename = async () => {
    const name = await promptDialog({ title: t('Rename world'), defaultValue: s.worldName, confirmLabel: t('Rename') });
    if (name) session.runtime.rename(name);
  };

  const save = async (slot: SaveSlotKey) => {
    if (await session.save(slot)) toast(t('Saved to {slot}', { slot: t(SAVE_SLOTS.find((x) => x.key === slot)?.label ?? '') }), 'success');
    else toast(t('Save failed — see log'), 'error');
  };

  const exitToMenu = async () => {
    if (s.dirty) {
      const ok = await confirmDialog({ title: t('Unsaved changes'), message: t('Save the world before leaving?'), confirmLabel: t('Save & exit') });
      if (ok && !(await session.save())) return;
      if (!ok) {
        const discard = await confirmDialog({ title: t('Discard changes?'), message: t('Leave without saving? Changes since the last save will be lost.'), confirmLabel: t('Discard'), danger: true });
        if (!discard) return;
      }
    }
    closeWorld();
    s.go('menu');
  };

  const eco = useRpg(session, 1000).economy;

  return (
    <div className="topbar panel">
      <button className="btn icon" title={t('Main menu')} onClick={exitToMenu}><PixelIcon name="menu" /></button>
      <button className="world-title" onClick={rename} title={t('Click to rename')}>
        <span className="pixel-title">{s.worldName}</span>
        {s.dirty && <span className="dirty-dot" title={t('Unsaved changes')}>●</span>}
      </button>

      <div className="topbar-stat" title={t(phase)}>
        <PixelIcon name={phase === 'night' ? 'moon' : 'sun'} accent={phase === 'night' ? '#7fd7ff' : '#f2c14e'} color={phase === 'night' ? '#c9d6ff' : '#ffd97a'} />
        <span>{formatGameTime(s.gameMinutes)}</span>
      </div>
      <div className="topbar-stat clickable" title={t('Players online / server capacity. Popularity: {p}%', { p: Math.round(session.runtime.sim.popularity) })} onClick={() => useEditorStore.getState().setTab('players')}>
        <PixelIcon name="user" /> <span>{t('{n} players', { n: session.players.online().length })}</span>
        <span className="hint">/{session.players.capacity()} · {Math.round(session.runtime.sim.popularity)}%</span>
      </div>
      {session.studio.standard && (
        <div className={`topbar-stat clickable ${session.runtime.studio.funds < 0 ? 'danger' : ''}`} title={t('Studio funds — click to open the Studio tab')} onClick={() => useEditorStore.getState().setTab('studio')}>
          <span className="money">$</span><span>{Math.round(session.runtime.studio.funds).toLocaleString()}</span>
        </div>
      )}
      <div className="topbar-stat" title={t('NPCs alive / total. Deaths this session: {n}', { n: live.npcDeaths })}>
        <PixelIcon name="npc" /> <span>{live.npcsAlive}/{live.npcsTotal} {t('NPC')}</span>
      </div>
      <div className="topbar-stat" title={t('Monsters alive / spawn slots. Killed this session: {n}', { n: live.kills })}>
        <PixelIcon name="skull" color="#e8e4d4" /> <span>{live.creaturesAlive}/{live.creaturesTotal}</span>
      </div>
      <div className="topbar-stat clickable" title={t('World treasury — click to open the Economy tab')} onClick={() => useEditorStore.getState().setTab('economy')}>
        <PixelIcon name="gold" color="#6e4d14" /> <span>{Math.round(eco.treasury).toLocaleString()} {eco.currencyName}</span>
      </div>

      <div className="grow" />

      <div className="sim-controls">
        <button className={`btn icon ${s.running ? 'active' : ''}`} title={t('Play / Pause (P)')} onClick={() => session.engine.toggle()}>
          <PixelIcon name={s.running ? 'pause' : 'play'} />
        </button>
        {SPEEDS.map((sp) => (
          <button key={sp} className={`btn small ${s.speed === sp ? 'active' : ''}`} onClick={() => session.setSpeed(sp)}>x{sp}</button>
        ))}
      </div>

      <div className="divider" />
      <button className="btn icon" disabled={!canUndo} title={t('Undo (Ctrl+Z)')} onClick={() => session.undo()}><PixelIcon name="undo" /></button>
      <button className="btn icon" disabled={!canRedo} title={t('Redo (Ctrl+Y)')} onClick={() => session.redo()}><PixelIcon name="redo" /></button>
      <div className="divider" />

      <div className="save-group">
        <button className="btn primary" disabled={s.saving} title={t('Save to {slot}', { slot: t(SAVE_SLOTS.find((x) => x.key === s.slot)?.label ?? '') }) + ' (Ctrl+S)'} onClick={() => save(s.slot)}>
          <PixelIcon name="save" /> {s.saving ? t('Saving…') : t('Save')}
        </button>
        <select className="input slot-select" value={s.slot} title={t('Save slot')} onChange={(e) => { session.slot = e.target.value as SaveSlotKey; s.patch({ slot: session.slot }); }}>
          {SAVE_SLOTS.filter((x) => x.key !== 'auto').map((x) => <option key={x.key} value={x.key}>{t(x.label)}</option>)}
        </select>
      </div>
    </div>
  );
}
