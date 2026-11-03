import { WorldRepository } from '@/persistence/WorldRepository';
import { exportWorldJson } from '@/persistence/serializer';
import { downloadText, loadAndOpenWorld, safeFileName } from '@/session/sessionActions';
import { confirmDialog, promptDialog } from '@/stores/dialogStore';
import { useSessionStore } from '@/stores/sessionStore';
import { toast } from '@/stores/toastStore';
import type { WorldMeta } from '@/models/world';
import { PixelIcon } from '../components/PixelIcon';
import { useWorldList } from '../hooks/useWorldList';
import { ScreenFrame } from './ScreenFrame';
import { WorldCard } from './WorldCard';

export function MyWorldsScreen() {
  const go = useSessionStore((s) => s.go);
  const { worlds, refresh } = useWorldList();

  const open = async (w: WorldMeta) => {
    if (!(await loadAndOpenWorld(w.id))) toast('This world has no saves.', 'error');
  };
  const rename = async (w: WorldMeta) => {
    const name = await promptDialog({ title: 'Rename world', defaultValue: w.name, confirmLabel: 'Rename' });
    if (!name) return;
    await WorldRepository.renameWorld(w.id, name);
    toast('World renamed', 'success');
    refresh();
  };
  const duplicate = async (w: WorldMeta) => {
    const copy = await WorldRepository.duplicateWorld(w.id);
    if (copy) toast(`Created "${copy.name}"`, 'success');
    refresh();
  };
  const exportJson = async (w: WorldMeta) => {
    const res = await WorldRepository.load(w.id);
    if (!res) return toast('Nothing to export.', 'error');
    downloadText(`${safeFileName(w.name)}.world.json`, exportWorldJson(res.save));
    toast('World exported', 'success');
  };
  const remove = async (w: WorldMeta) => {
    const ok = await confirmDialog({
      title: 'Delete world',
      message: `Delete "${w.name}" and all of its save slots?\nThis cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await WorldRepository.deleteWorld(w.id);
    toast('World deleted');
    refresh();
  };

  return (
    <ScreenFrame
      title="My Worlds"
      onBack={() => go('menu')}
      actions={<button className="btn small primary" onClick={() => go('create')}><PixelIcon name="plus" size={12} /> New</button>}
    >
      {worlds === null && <div className="hint">Loading…</div>}
      {worlds?.length === 0 && (
        <div className="empty-state">
          <div>No worlds yet.</div>
          <button className="btn primary" onClick={() => go('create')}>Create your first world</button>
        </div>
      )}
      <div className="world-list">
        {worlds?.map((w) => (
          <WorldCard key={w.id} world={w}>
            <button className="btn small primary" onClick={() => open(w)}><PixelIcon name="play" size={12} /> Open</button>
            <button className="btn small" onClick={() => rename(w)}><PixelIcon name="edit" size={12} /> Rename</button>
            <button className="btn small" onClick={() => duplicate(w)}><PixelIcon name="copy" size={12} /> Duplicate</button>
            <button className="btn small" onClick={() => exportJson(w)}><PixelIcon name="export" size={12} /> Export</button>
            <button className="btn small danger" onClick={() => remove(w)}><PixelIcon name="trash" size={12} /> Delete</button>
          </WorldCard>
        ))}
      </div>
    </ScreenFrame>
  );
}
