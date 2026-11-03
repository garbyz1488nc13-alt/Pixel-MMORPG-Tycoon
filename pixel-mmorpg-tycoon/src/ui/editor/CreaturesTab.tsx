import { useState } from 'react';
import { t } from '@/i18n';
import { CREATURE_TYPES, type CreatureType } from '@/data/creatureTypes';
import type { EntityId } from '@/core/ids';
import type { GameSession } from '@/session/GameSession';
import { confirmDialog } from '@/stores/dialogStore';
import { useEditorStore } from '@/stores/editorStore';
import { toast } from '@/stores/toastStore';
import { SpritePreview } from '../components/SpritePreview';
import { useEntityList, useLiveCounts } from '../hooks/useEntities';
import { CreatureForm } from './inspectors/CreatureForm';

/** Creature templates (bestiary) and their spawn areas. */
export function CreaturesTab({ session }: { session: GameSession }) {
  const templates = useEntityList(session, 'creatureTemplates');
  const areas = useEntityList(session, 'spawnAreas');
  const live = useLiveCounts(session);
  const [current, setCurrent] = useState<EntityId | null>(templates[0]?.id ?? null);
  const [newType, setNewType] = useState<CreatureType>('goblin');
  const setTab = useEditorStore((s) => s.setTab);
  const setTemplateId = useEditorStore((s) => s.setTemplateId);
  const setTool = useEditorStore((s) => s.setTool);
  const select = useEditorStore((s) => s.select);
  const tpl = templates.find((t) => t.id === current) ?? templates[0];

  const remove = async (id: EntityId) => {
    const used = areas.filter((a) => a.templateId === id).length;
    const ok = await confirmDialog({ title: t('Delete creature'), message: used ? t('This also deletes spawn areas using it: {n}.', { n: used }) : t('Delete this creature?'), confirmLabel: t('Delete'), danger: true });
    if (ok) session.entities.remove('creatureTemplates', [id]);
  };

  return (
    <div className="tab-page">
      <div className="panel tab-list">
        <div className="panel-header">{t('Bestiary')} ({templates.length})
          <div className="row">
            <select className="input slot-select" value={newType} onChange={(e) => setNewType(e.target.value as CreatureType)}>
              {CREATURE_TYPES.map((x) => <option key={x.key} value={x.key}>{t(x.name)}</option>)}
            </select>
            <button className="btn small primary" onClick={() => setCurrent(session.entities.addTemplate(newType).id)}>+ {t('New')}</button>
          </div>
        </div>
        <div className="section">
          <div className="kv"><span>{t('Monsters alive')}</span><span>{live.creaturesAlive} / {live.creaturesTotal}</span></div>
          <div className="kv"><span>{t('Killed this session')}</span><span>{live.kills}</span></div>
        </div>
        <div className="table-scroll scroll">
          <table className="data-table">
            <thead><tr><th /><th>{t('Name')}</th><th>{t('Lv')}</th><th>{t('HP')}</th><th>{t('DMG')}</th><th>{t('DEF')}</th><th>{t('Aggro')}</th><th>{t('XP')}</th><th>{t('Areas')}</th></tr></thead>
            <tbody>
              {templates.map((x) => (
                <tr key={x.id} className={tpl?.id === x.id ? 'active' : ''} onClick={() => setCurrent(x.id)}>
                  <td><SpritePreview frame={`cr:${x.type}:0`} box={20} /></td>
                  <td>{x.name}{x.boss && <span className="badge gold">{t('BOSS')}</span>}</td>
                  <td>{x.level}</td><td>{x.maxHp}</td><td>{x.damage}</td><td>{x.defense}</td><td>{t(x.aggression)}</td><td>{x.xpReward}</td>
                  <td>{areas.filter((a) => a.templateId === x.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {templates.length === 0 && <div className="hint pad">{t('No creatures yet. Pick a type above and press "+ New".')}</div>}
        </div>
        <div className="panel-header">{t('Spawn areas')} ({areas.length})</div>
        <div className="section">
          {areas.map((a) => {
            const tp = templates.find((x) => x.id === a.templateId);
            const alive = [...session.actors.actors.values()].filter((m) => m.spawnAreaId === a.id && m.state !== 'dead').length;
            return (
              <button key={a.id} className="el-row" onClick={() => { select({ col: 'spawnAreas', ids: [a.id] }); setTab('map'); session.bridge.emit('camera:centerTile', { x: a.x + a.w / 2, y: a.y + a.h / 2 }); }}>
                <span className="grow">{a.name}</span><span className="hint">{tp?.name} · {t('{a}/{b} alive', { a: alive, b: a.maxCount })}</span>
              </button>
            );
          })}
          {areas.length === 0 && <div className="hint">{t('No spawn areas. Choose a creature and press "Draw spawn area".')}</div>}
        </div>
      </div>
      <div className="panel tab-detail scroll">
        <div className="panel-header">{tpl ? tpl.name : t('Creature')}
          {tpl && <div className="row">
            <button className="btn small primary" onClick={() => { setTemplateId(tpl.id); setTool('spawn-area'); setTab('map'); toast(t('Drag on the map to draw the spawn area')); }}>{t('Draw spawn area')}</button>
          </div>}
        </div>
        <div className="section">
          {tpl ? (
            <>
              <CreatureForm session={session} tpl={tpl} />
              <div className="chip-row">
                <button className="btn small" onClick={() => { const c = session.entities.duplicateTemplate(tpl.id); if (c) setCurrent(c.id); }}>{t('Duplicate')}</button>
                <button className="btn small danger" onClick={() => remove(tpl.id)}>{t('Delete')}</button>
              </div>
            </>
          ) : <div className="hint">{t('Create a creature to edit it.')}</div>}
        </div>
      </div>
    </div>
  );
}
