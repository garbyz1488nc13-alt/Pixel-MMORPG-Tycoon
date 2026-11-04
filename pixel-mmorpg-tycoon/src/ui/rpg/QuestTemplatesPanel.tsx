import { useState } from 'react';
import type { EntityId } from '@/core/ids';
import { t } from '@/i18n';
import type { GameSession } from '@/session/GameSession';
import { toast } from '@/stores/toastStore';
import { QUEST_TEMPLATES, questPack, questsFromTemplate, type QuestTemplateKey, type TemplateResult } from '@/systems/rpg/questTemplates';
import { NumberInput } from '../components/Fields';

/** One-click quests for lazy designers: pick a blueprint and a level, get a working quest. */
export function QuestTemplatesPanel({ session, giverId, onCreated }: { session: GameSession; giverId: EntityId | null; onCreated: (id: EntityId) => void }) {
  const [key, setKey] = useState<QuestTemplateKey>('hunt');
  const [level, setLevel] = useState(() => {
    const on = session.players.online();
    return on.length ? Math.max(1, Math.round(on.reduce((n, p) => n + p.level, 0) / on.length)) : 1;
  });
  const tpl = QUEST_TEMPLATES.find((x) => x.key === key)!;

  const apply = (res: TemplateResult, label: string) => {
    if (!res.quests.length) { toast(res.error ?? t('Could not build this quest.'), 'error'); return; }
    session.entities.lastError = null;
    const added = session.entities.addQuests(res.quests, label);
    if (!added.length) { toast(session.entities.lastError ?? t('Could not build this quest.'), 'error'); return; }
    onCreated(added[added.length - 1].id);
    toast(t('Quests created: {n}', { n: added.length }), 'success');
  };

  return (
    <div className="quest-templates">
      <div className="el-title">{t('Quest templates')}</div>
      <div className="row">
        <select className="input grow" value={key} onChange={(e) => setKey(e.target.value as QuestTemplateKey)}>
          {QUEST_TEMPLATES.map((x) => <option key={x.key} value={x.key}>{t(x.name)}</option>)}
        </select>
        <span className="hint">{t('Lv')}</span>
        <NumberInput value={level} min={1} max={100} onChange={setLevel} />
      </div>
      <div className="hint">{t(tpl.hint)}</div>
      <div className="row">
        <button className="btn small primary" onClick={() => apply(questsFromTemplate(session.runtime, key, level, giverId), t('Quest from template'))}>{t('Create from template')}</button>
        <button className="btn small" title={t('One quest of every kind that fits your world, for this level.')} onClick={() => apply(questPack(session.runtime, level, giverId), t('Quest pack'))}>{t('Quest pack for level {n}', { n: level })}</button>
      </div>
    </div>
  );
}
