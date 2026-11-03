import { SAVE_SLOTS, type SaveSlotKey } from '@/models/world';
import { dayPhase, formatGameTime } from '@/simulation/time';
import type { SimSpeed } from '@/simulation/types';
import { closeWorld } from '@/session/sessionActions';
import { confirmDialog, promptDialog } from '@/stores/dialogStore';
import { useEditorStore } from '@/stores/editorStore';
import { useSessionStore } from '@/stores/sessionStore';
import { toast } from '@/stores/toastStore';
import { PixelIcon } from '../components/PixelIcon';

const SPEEDS: SimSpeed[] = [1, 2, 4];

export function TopBar() {
  const s = useSessionStore();
  const canUndo = useEditorStore((e) => e.canUndo);
  const canRedo = useEditorStore((e) => e.canRedo);
  const session = s.session!;
  const phase = dayPhase(s.gameMinutes);

  const rename = async () => {
    const name = await promptDialog({ title: 'Rename world', defaultValue: s.worldName, confirmLabel: 'Rename' });
    if (name) session.runtime.rename(name);
  };

  const save = async (slot: SaveSlotKey) => {
    if (await session.save(slot)) toast(`Saved to ${SAVE_SLOTS.find((x) => x.key === slot)?.label}`, 'success');
    else toast('Save failed — see log', 'error');
  };

  const exitToMenu = async () => {
    if (s.dirty) {
      const ok = await confirmDialog({ title: 'Unsaved changes', message: 'Save the world before leaving?', confirmLabel: 'Save & exit' });
      if (ok && !(await session.save())) return;
      if (!ok) {
        const discard = await confirmDialog({ title: 'Discard changes?', message: 'Leave without saving? Changes since the last save will be lost.', confirmLabel: 'Discard', danger: true });
        if (!discard) return;
      }
    }
    closeWorld();
    s.go('menu');
  };

  const treasury = session.runtime.config.startingGold;

  return (
    <div className="topbar panel">
      <button className="btn icon" title="Main menu" onClick={exitToMenu}><PixelIcon name="menu" /></button>
      <button className="world-title" onClick={rename} title="Click to rename">
        <span className="pixel-title">{s.worldName}</span>
        {s.dirty && <span className="dirty-dot" title="Unsaved changes">●</span>}
      </button>

      <div className="topbar-stat" title={`${phase[0].toUpperCase()}${phase.slice(1)}`}>
        <PixelIcon name={phase === 'night' ? 'moon' : 'sun'} accent={phase === 'night' ? '#7fd7ff' : '#f2c14e'} color={phase === 'night' ? '#c9d6ff' : '#ffd97a'} />
        <span>{formatGameTime(s.gameMinutes)}</span>
      </div>
      <div className="topbar-stat" title="Simulated players online. Player simulation arrives in Phase 4 — until then this is honestly 0.">
        <PixelIcon name="user" /> <span>0 players</span>
      </div>
      <div className="topbar-stat" title="World treasury (starting gold). The economy system arrives in Phase 3.">
        <PixelIcon name="gold" color="#6e4d14" /> <span>{treasury.toLocaleString()} gold</span>
      </div>

      <div className="grow" />

      <div className="sim-controls">
        <button className={`btn icon ${s.running ? 'active' : ''}`} title="Play / Pause (P)" onClick={() => session.engine.toggle()}>
          <PixelIcon name={s.running ? 'pause' : 'play'} />
        </button>
        {SPEEDS.map((sp) => (
          <button key={sp} className={`btn small ${s.speed === sp ? 'active' : ''}`} onClick={() => session.setSpeed(sp)}>x{sp}</button>
        ))}
      </div>

      <div className="divider" />
      <button className="btn icon" disabled={!canUndo} title="Undo (Ctrl+Z)" onClick={() => session.undo()}><PixelIcon name="undo" /></button>
      <button className="btn icon" disabled={!canRedo} title="Redo (Ctrl+Y)" onClick={() => session.redo()}><PixelIcon name="redo" /></button>
      <div className="divider" />

      <div className="save-group">
        <button className="btn primary" disabled={s.saving} title={`Save to ${SAVE_SLOTS.find((x) => x.key === s.slot)?.label} (Ctrl+S)`} onClick={() => save(s.slot)}>
          <PixelIcon name="save" /> {s.saving ? 'Saving…' : 'Save'}
        </button>
        <select className="input slot-select" value={s.slot} title="Save slot" onChange={(e) => { session.slot = e.target.value as SaveSlotKey; s.patch({ slot: session.slot }); }}>
          {SAVE_SLOTS.filter((x) => x.key !== 'auto').map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
        </select>
      </div>
    </div>
  );
}
