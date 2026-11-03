import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import { SAVE_SLOTS, type SaveSlotKey, type SaveSlotRecord } from '@/models/world';
import { WorldRepository } from '@/persistence/WorldRepository';
import { loadAndOpenWorld } from '@/session/sessionActions';
import { useSessionStore } from '@/stores/sessionStore';
import { toast } from '@/stores/toastStore';
import { PixelIcon } from '../components/PixelIcon';
import { useImportWorld } from '../hooks/useImportWorld';
import { useWorldList } from '../hooks/useWorldList';
import { ScreenFrame } from './ScreenFrame';
import { formatDate, WorldCard } from './WorldCard';

type SlotInfo = Omit<SaveSlotRecord, 'data'>;

export function LoadWorldScreen() {
  const go = useSessionStore((s) => s.go);
  const { worlds, refresh } = useWorldList();
  const [selected, setSelected] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const importWorld = useImportWorld(refresh);

  useEffect(() => {
    if (!selected && worlds?.length) setSelected(worlds[0].id);
  }, [worlds, selected]);

  useEffect(() => {
    if (!selected) return setSlots([]);
    WorldRepository.listSlots(selected).then(setSlots);
  }, [selected]);

  const load = async (slot: SaveSlotKey) => {
    if (!selected) return;
    if (!(await loadAndOpenWorld(selected, slot))) toast(t('Slot is empty.'), 'error');
  };

  return (
    <ScreenFrame
      title={t('Load World')}
      onBack={() => go('menu')}
      actions={<button className="btn small" onClick={importWorld}><PixelIcon name="import" size={12} /> {t('Import JSON')}</button>}
    >
      {worlds?.length === 0 && (
        <div className="empty-state">
          <div>{t('No saved worlds. Create one or import a .world.json file.')}</div>
          <div className="row">
            <button className="btn primary" onClick={() => go('create')}>{t('Create World')}</button>
            <button className="btn" onClick={importWorld}>{t('Import JSON')}</button>
          </div>
        </div>
      )}
      <div className="load-grid">
        <div className="world-list compact">
          {worlds?.map((w) => (
            <WorldCard key={w.id} world={w} selected={w.id === selected} onClick={() => setSelected(w.id)} />
          ))}
        </div>
        {selected && (
          <div className="panel slot-panel">
            <div className="panel-header">{t('Save slots')}</div>
            <div className="slot-list">
              {SAVE_SLOTS.map((s) => {
                const info = slots.find((x) => x.slot === s.key);
                return (
                  <div key={s.key} className={`slot-row ${info ? '' : 'empty'}`}>
                    <PixelIcon name="save" />
                    <div className="grow">
                      <div>{t(s.label)}</div>
                      <div className="hint">{info ? formatDate(info.savedAt) : t('empty')}</div>
                    </div>
                    <button className="btn small primary" disabled={!info} onClick={() => load(s.key)}>{t('Load')}</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ScreenFrame>
  );
}
