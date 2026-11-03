import { useState } from 'react';
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
    const ok = await confirmDialog({ title: 'Delete creature', message: used ? `This also deletes ${used} spawn area(s) using it.` : 'Delete this creature?', confirmLabel: 'Delete', danger: true });
    if (ok) session.entities.remove('creatureTemplates', [id]);
  };

  return (
    <div className="tab-page">
      <div className="panel tab-list">
        <div className="panel-header">Bestiary ({templates.length})
          <div className="row">
            <select className="input slot-select" value={newType} onChange={(e) => setNewType(e.target.value as CreatureType)}>
              {CREATURE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
            <button className="btn small primary" onClick={() => setCurrent(session.entities.addTemplate(newType).id)}>+ New</button>
          </div>
        </div>
        <div className="section">
          <div className="kv"><span>Monsters alive</span><span>{live.creaturesAlive} / {live.creaturesTotal}</span></div>
          <div className="kv"><span>Killed this session</span><span>{live.kills}</span></div>
        </div>
        <div className="table-scroll scroll">
          <table className="data-table">
            <thead><tr><th /><th>Name</th><th>Lv</th><th>HP</th><th>DMG</th><th>DEF</th><th>Aggro</th><th>XP</th><th>Areas</th></tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className={tpl?.id === t.id ? 'active' : ''} onClick={() => setCurrent(t.id)}>
                  <td><SpritePreview frame={`cr:${t.type}:0`} box={20} /></td>
                  <td>{t.name}{t.boss && <span className="badge gold">BOSS</span>}</td>
                  <td>{t.level}</td><td>{t.maxHp}</td><td>{t.damage}</td><td>{t.defense}</td><td>{t.aggression}</td><td>{t.xpReward}</td>
                  <td>{areas.filter((a) => a.templateId === t.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {templates.length === 0 && <div className="hint pad">No creatures yet. Pick a type above and press "+ New".</div>}
        </div>
        <div className="panel-header">Spawn areas ({areas.length})</div>
        <div className="section">
          {areas.map((a) => {
            const t = templates.find((x) => x.id === a.templateId);
            const alive = [...session.actors.actors.values()].filter((m) => m.spawnAreaId === a.id && m.state !== 'dead').length;
            return (
              <button key={a.id} className="el-row" onClick={() => { select({ col: 'spawnAreas', ids: [a.id] }); setTab('map'); session.bridge.emit('camera:centerTile', { x: a.x + a.w / 2, y: a.y + a.h / 2 }); }}>
                <span className="grow">{a.name}</span><span className="hint">{t?.name} · {alive}/{a.maxCount} alive</span>
              </button>
            );
          })}
          {areas.length === 0 && <div className="hint">No spawn areas. Choose a creature and press "Draw spawn area".</div>}
        </div>
      </div>
      <div className="panel tab-detail scroll">
        <div className="panel-header">{tpl ? tpl.name : 'Creature'}
          {tpl && <div className="row">
            <button className="btn small primary" onClick={() => { setTemplateId(tpl.id); setTool('spawn-area'); setTab('map'); toast('Drag on the map to draw the spawn area'); }}>Draw spawn area</button>
          </div>}
        </div>
        <div className="section">
          {tpl ? (
            <>
              <CreatureForm session={session} tpl={tpl} />
              <div className="chip-row">
                <button className="btn small" onClick={() => { const c = session.entities.duplicateTemplate(tpl.id); if (c) setCurrent(c.id); }}>Duplicate</button>
                <button className="btn small danger" onClick={() => remove(tpl.id)}>Delete</button>
              </div>
            </>
          ) : <div className="hint">Create a creature to edit it.</div>}
        </div>
      </div>
    </div>
  );
}
