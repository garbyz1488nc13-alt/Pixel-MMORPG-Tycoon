import { useState } from 'react';
import { createId, type EntityId } from '@/core/ids';
import { getNpcType } from '@/data/npcTypes';
import { OBJECTIVE_TYPES } from '@/data/rpgDefaults';
import { t } from '@/i18n';
import type { ObjectiveType, QuestDef, QuestObjective } from '@/models/rpg';
import type { GameSession } from '@/session/GameSession';
import { chainPosition, targetKind, validateQuest } from '@/systems/rpg/quests';
import { confirmDialog } from '@/stores/dialogStore';
import { Field, NumberInput, TextInput } from '../components/Fields';
import { useEntityList } from '../hooks/useEntities';
import { ItemRowEditor } from './ItemRowEditor';
import { useRpg } from './useRpg';
import { autoRewards } from '@/systems/rpg/questRewards';
import { QuestTemplatesPanel } from './QuestTemplatesPanel';

export function QuestsTab({ session }: { session: GameSession }) {
  const quests = useEntityList(session, 'quests');
  const npcs = useEntityList(session, 'npcs');
  useEntityList(session, 'spawnAreas');
  useEntityList(session, 'creatureTemplates');
  useRpg(session);
  const [current, setCurrent] = useState<EntityId | null>(null);
  const store = session.runtime.entities;
  const quest = quests.find((q) => q.id === current) ?? quests[0];
  const defaultGiver = npcs.find((n) => n.type === 'questgiver')?.id ?? npcs[0]?.id ?? null;

  return (
    <div className="tab-page">
      <div className="panel tab-list">
        <div className="panel-header">{t('Quests')} ({quests.length})
          <span className="row">
            <button className="btn small" title={t('Set every quest to automatic rewards and recalculate them.')} onClick={async () => {
              if (!(await confirmDialog({ title: t('Recalculate rewards'), message: t('Recalculate XP and gold for all {n} quests from their objectives and level? (Undo with Ctrl+Z.)', { n: quests.length }), confirmLabel: t('Recalculate') }))) return;
              session.entities.recalcQuestRewards();
            }}>{t('Auto rewards for all')}</button>
            <button className="btn small primary" onClick={() => setCurrent(session.entities.addQuest(defaultGiver).id)}>+ {t('New quest')}</button>
          </span>
        </div>
        <QuestTemplatesPanel session={session} giverId={defaultGiver} onCreated={setCurrent} />
        <div className="table-scroll scroll">
          <table className="data-table">
            <thead><tr><th>{t('Name')}</th><th>{t('Quest giver')}</th><th>{t('Lv')}</th><th>{t('Chain')}</th><th>{t('Objectives')}</th><th title={t('Taken / completed by players')}>{t('Taken / done')}</th><th>{t('Status')}</th></tr></thead>
            <tbody>
              {[...quests].sort((a, b) => chainPosition(a, store) - chainPosition(b, store) || a.requiredLevel - b.requiredLevel).map((q) => {
                const issues = validateQuest(q, store, session.runtime.rpg);
                const errors = issues.filter((i) => i.level === 'error').length;
                return (
                  <tr key={q.id} className={quest?.id === q.id ? 'active' : ''} onClick={() => setCurrent(q.id)}>
                    <td>{q.name}</td>
                    <td>{q.giverId ? store.get('npcs', q.giverId)?.name ?? '—' : '—'}</td>
                    <td>{q.requiredLevel}</td>
                    <td>{chainPosition(q, store)}</td>
                    <td>{q.objectives.length}</td>
                    <td>{session.runtime.sim.questStats?.[q.id]?.taken ?? 0} / {session.runtime.sim.questStats?.[q.id]?.done ?? 0}</td>
                    <td className={errors ? 'bad' : issues.length ? 'warn' : 'good'}>{errors ? t('{n} errors', { n: errors }) : issues.length ? t('{n} warnings', { n: issues.length }) : t('Ready')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {quests.length === 0 && <div className="hint pad">{t('No quests yet. Press "+ New quest".')}</div>}
        </div>
      </div>
      <div className="panel tab-detail scroll">
        <div className="panel-header">{quest ? quest.name : t('Quest')}</div>
        <div className="section">
          {quest ? <QuestForm session={session} quest={quest} onDuplicated={setCurrent} onDeleted={() => setCurrent(null)} /> : <div className="hint">{t('Create a quest to edit it.')}</div>}
        </div>
      </div>
    </div>
  );
}

function TargetSelect({ session, type, value, onChange }: { session: GameSession; type: ObjectiveType; value: EntityId | null; onChange: (id: EntityId) => void }) {
  const kind = targetKind(type);
  const store = session.runtime.entities;
  const options: { id: string; label: string }[] =
    kind === 'creatureTemplates' ? store.list('creatureTemplates').filter((c) => type !== 'boss' || c.boss).map((c) => ({ id: c.id, label: `${c.name} (${t('Lv')} ${c.level})` }))
    : kind === 'items' ? store.list('items').filter((i) => type !== 'gather' || i.category === 'resource').map((i) => ({ id: i.id, label: i.name }))
    : kind === 'regions' ? store.list('regions').map((r) => ({ id: r.id, label: r.name }))
    : store.list('npcs').map((n) => ({ id: n.id, label: n.name }));
  return (
    <select className="input" value={value ?? ''} onChange={(e) => e.target.value && onChange(e.target.value)}>
      <option value="">— {t('choose target')} —</option>
      {options.sort((a, b) => a.label.localeCompare(b.label)).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

function QuestForm({ session, quest, onDuplicated, onDeleted }: { session: GameSession; quest: QuestDef; onDuplicated: (id: EntityId) => void; onDeleted: () => void }) {
  const store = session.runtime.entities;
  // With auto rewards on, any change to objectives/level/repeatable re-prices the quest.
  const up = (patch: Partial<QuestDef>, label = t('Edit quest')) => {
    const next = { ...quest, ...patch };
    if (next.autoRewards && !('rewards' in patch)) patch = { ...patch, rewards: autoRewards(next, session.runtime) };
    session.entities.update('quests', quest.id, patch, label);
  };
  const setObj = (i: number, patch: Partial<QuestObjective>) => up({ objectives: quest.objectives.map((o, j) => (j === i ? { ...o, ...patch } : o)) }, t('Edit objective'));
  const issues = validateQuest(quest, store, session.runtime.rpg);
  const npcs = store.list('npcs');
  const others = store.list('quests').filter((q) => q.id !== quest.id);
  const cur = session.runtime.rpg.economy.currencyName;
  const remove = async () => {
    const ok = await confirmDialog({ title: t('Delete quest'), message: t('Delete "{name}"?', { name: quest.name }), confirmLabel: t('Delete'), danger: true });
    if (ok) { session.entities.remove('quests', [quest.id]); onDeleted(); }
  };

  return (
    <div className="form">
      <Field label={t('Quest name')}><TextInput value={quest.name} maxLength={60} onChange={(name) => up({ name }, t('Rename quest'))} /></Field>
      <Field label={t('Description')}>
        <textarea className="input" rows={3} maxLength={400} value={quest.description} onChange={(e) => up({ description: e.target.value }, t('Edit description'))} />
      </Field>
      <div className="two-col">
        <Field label={t('Quest giver')}>
          <select className="input" value={quest.giverId ?? ''} onChange={(e) => up({ giverId: e.target.value || null })}>
            <option value="">—</option>
            {npcs.sort((a, b) => a.name.localeCompare(b.name)).map((n) => <option key={n.id} value={n.id}>{n.name} · {t(getNpcType(n.type).name)}</option>)}
          </select>
        </Field>
        <Field label={t('Required level')}><NumberInput value={quest.requiredLevel} min={1} max={session.runtime.rpg.progression.maxLevel} onChange={(requiredLevel) => up({ requiredLevel })} /></Field>
      </div>
      <Field label={t('Quest chain: unlocks after')}>
        <select className="input" value={quest.prerequisiteId ?? ''} onChange={(e) => up({ prerequisiteId: e.target.value || null }, t('Edit quest chain'))}>
          <option value="">— {t('available from the start')} —</option>
          {others.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
        </select>
      </Field>
      <label className="check"><input type="checkbox" checked={quest.repeatable} onChange={(e) => up({ repeatable: e.target.checked })} /> {t('Repeatable')}</label>

      <Field label={t('Objectives')}>
        <div className="objectives">
          {quest.objectives.length === 0 && <div className="hint">{t('No objectives yet.')}</div>}
          {quest.objectives.map((o, i) => (
            <div key={o.id} className={`objective ${issues.some((x) => x.objectiveId === o.id && x.level === 'error') ? 'bad' : ''}`}>
              <div className="obj-head">
                <b>{i + 1}.</b>
                <select className="input" value={o.type} onChange={(e) => setObj(i, { type: e.target.value as ObjectiveType, targetId: null, receiverId: null, count: ['explore', 'talk', 'boss'].includes(e.target.value) ? 1 : o.count })}>
                  {OBJECTIVE_TYPES.map((x) => <option key={x.key} value={x.key}>{t(x.label)}</option>)}
                </select>
                <button className="btn small icon" title={t('Remove')} onClick={() => up({ objectives: quest.objectives.filter((_, j) => j !== i) }, t('Remove objective'))}>×</button>
              </div>
              <div className="obj-body">
                <TargetSelect session={session} type={o.type} value={o.targetId} onChange={(targetId) => setObj(i, { targetId })} />
                {!['explore', 'talk', 'boss'].includes(o.type) && <NumberInput value={o.count} min={1} max={9999} onChange={(count) => setObj(i, { count })} />}
              </div>
              {o.type === 'deliver' && (
                <select className="input" value={o.receiverId ?? ''} onChange={(e) => setObj(i, { receiverId: e.target.value || null })}>
                  <option value="">— {t('deliver to')} —</option>
                  {npcs.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              )}
              <div className="hint">{t(OBJECTIVE_TYPES.find((x) => x.key === o.type)!.hint)}</div>
            </div>
          ))}
          <button className="btn small" onClick={() => up({ objectives: [...quest.objectives, { id: createId('obj'), type: 'kill', targetId: null, count: 5 }] }, t('Add objective'))}>+ {t('Add objective')}</button>
        </div>
      </Field>

      <label className="check"><input type="checkbox" checked={!!quest.autoRewards} onChange={(e) => up({ autoRewards: e.target.checked, ...(e.target.checked ? { rewards: autoRewards(quest, session.runtime) } : {}) }, t('Auto rewards'))} /> {t('Automatic rewards (from objectives and level)')}</label>
      <Field label={t('Rewards')}>
        <div className="two-col">
          <Field label={t('Experience')}><NumberInput value={quest.rewards.xp} min={0} max={1e8} onChange={(xp) => up({ autoRewards: false, rewards: { ...quest.rewards, xp } }, t('Edit rewards'))} /></Field>
          <Field label={cur}><NumberInput value={quest.rewards.currency} min={0} max={1e9} onChange={(currency) => up({ autoRewards: false, rewards: { ...quest.rewards, currency } }, t('Edit rewards'))} /></Field>
        </div>
        <ItemRowEditor session={session} rows={quest.rewards.items} empty={t('No item rewards.')} make={(itemId) => ({ itemId, qty: 1 })} onChange={(items) => up({ rewards: { ...quest.rewards, items } }, t('Edit rewards'))} columns={[{ key: 'qty', label: t('Qty'), min: 1, max: 999 }]} />
      </Field>

      <Field label={t('Automatic check')}>
        {issues.length === 0 ? <div className="check-ok">✓ {t('This quest can be completed in the current world.')}</div> : (
          <ul className="issues">
            {issues.map((x, i) => <li key={i} className={x.level}>{x.level === 'error' ? '✗' : '!'} {t(x.text, x.params)}</li>)}
          </ul>
        )}
      </Field>
      <div className="chip-row">
        <button className="btn small" onClick={() => { const c = session.entities.duplicateQuest(quest.id); if (c) onDuplicated(c.id); }}>{t('Duplicate')}</button>
        <button className="btn small danger" onClick={remove}>{t('Delete')}</button>
      </div>
    </div>
  );
}
