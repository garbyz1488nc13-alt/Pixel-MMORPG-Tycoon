import { useMemo, useState } from 'react';
import { t } from '@/i18n';
import { getNpcType, NPC_TYPES, type NpcType } from '@/data/npcTypes';
import type { GameSession } from '@/session/GameSession';
import { useEditorStore } from '@/stores/editorStore';
import { toast } from '@/stores/toastStore';
import { SpritePreview } from '../components/SpritePreview';
import { useEntityList, useLiveCounts } from '../hooks/useEntities';
import { NpcForm } from './inspectors/NpcForm';

/** All NPCs in a filterable table, with the full editor for the chosen one. */
export function NpcTab({ session }: { session: GameSession }) {
  const npcs = useEntityList(session, 'npcs');
  useLiveCounts(session);
  const sel = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);
  const setTab = useEditorStore((s) => s.setTab);
  const setNpcType = useEditorStore((s) => s.setNpcType);
  const [filter, setFilter] = useState<NpcType | 'all'>('all');
  const [q, setQ] = useState('');
  const shown = useMemo(
    () => npcs.filter((n) => (filter === 'all' || n.type === filter) && n.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)),
    [npcs, filter, q],
  );
  const current = sel?.col === 'npcs' ? npcs.find((n) => n.id === sel.ids[0]) : undefined;

  return (
    <div className="tab-page">
      <div className="panel tab-list">
        <div className="panel-header">{t('NPCs')} ({npcs.length})
          <button className="btn small" onClick={() => { setNpcType(filter === 'all' ? 'villager' : filter); setTab('map'); toast(t('Click a walkable tile to place the NPC')); }}>+ {t('Place on map')}</button>
        </div>
        <div className="section">
          <input className="input" placeholder={t('Search by name…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chip-row">
            <button className={`btn small ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>{t('All')}</button>
            {NPC_TYPES.map((x) => (
              <button key={x.key} className={`btn small ${filter === x.key ? 'active' : ''}`} onClick={() => setFilter(x.key)}>
                {t(x.name)} {npcs.filter((n) => n.type === x.key).length}
              </button>
            ))}
          </div>
        </div>
        <div className="table-scroll scroll">
          <table className="data-table">
            <thead><tr><th /><th>{t('Name')}</th><th>{t('Type')}</th><th>{t('Lv')}</th><th>{t('Behavior')}</th><th>{t('Hours')}</th><th>{t('Status')}</th></tr></thead>
            <tbody>
              {shown.map((n) => {
                const a = session.actors.actors.get(n.id);
                return (
                  <tr key={n.id} className={current?.id === n.id ? 'active' : ''} onClick={() => select({ col: 'npcs', ids: [n.id] })} onDoubleClick={() => { setTab('map'); session.bridge.emit('camera:centerTile', { x: n.x, y: n.y }); }}>
                    <td><SpritePreview frame={`npc:${n.type}:0`} box={20} /></td>
                    <td>{n.name}</td>
                    <td>{t(getNpcType(n.type).name)}</td>
                    <td>{n.level}</td>
                    <td>{t(n.behavior)}</td>
                    <td>{n.workStart}–{n.workEnd}</td>
                    <td className={a?.state === 'dead' ? 'bad' : ''}>{a ? (a.state === 'dead' ? t('dead') : `${t(a.state)} ${a.hp}/${a.maxHp}`) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && <div className="hint pad">{t("No NPCs match. Place some from the map's NPC section.")}</div>}
        </div>
      </div>
      <div className="panel tab-detail scroll">
        <div className="panel-header">{current ? current.name : t('NPC details')}
          {current && <button className="btn small" onClick={() => { setTab('map'); session.bridge.emit('camera:centerTile', { x: current.x, y: current.y }); }}>{t('Show on map')}</button>}
        </div>
        <div className="section">
          {current ? (
            <>
              <NpcForm session={session} npc={current} />
              <div className="chip-row">
                <button className="btn small" onClick={() => { const c = session.entities.duplicateNpc(current.id); if (c) select({ col: 'npcs', ids: [c.id] }); }}>{t('Duplicate')}</button>
                <button className="btn small danger" onClick={() => { session.entities.remove('npcs', [current.id]); select(null); }}>{t('Delete')}</button>
              </div>
            </>
          ) : <div className="hint">{t('Select an NPC in the list.')}</div>}
        </div>
      </div>
    </div>
  );
}
