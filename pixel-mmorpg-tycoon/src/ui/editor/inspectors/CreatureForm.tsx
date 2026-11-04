import { AGGRESSIONS, CREATURE_TYPES } from '@/data/creatureTypes';
import { t } from '@/i18n';
import type { CreatureTemplate } from '@/models/entities';
import type { GameSession } from '@/session/GameSession';
import { Field, NumberInput, Select, TextInput } from '../../components/Fields';
import { ItemRowEditor } from '../../rpg/ItemRowEditor';
import { SpritePreview } from '../../components/SpritePreview';

export function CreatureForm({ session, tpl }: { session: GameSession; tpl: CreatureTemplate }) {
  const up = (patch: Partial<CreatureTemplate>, label = t('Edit creature')) => session.entities.update('creatureTemplates', tpl.id, patch, label);
  const num = (key: keyof CreatureTemplate, label: string, min: number, max: number, step = 1, hint?: string) => (
    <Field label={t(label)} hint={hint && t(hint)}><NumberInput value={tpl[key] as number} min={min} max={max} step={step} onChange={(v) => up({ [key]: v } as Partial<CreatureTemplate>)} /></Field>
  );
  return (
    <div className="form">
      <div className="row">
        <SpritePreview frame={`cr:${tpl.type}:0`} box={48} />
        <div className="grow">
          <TextInput value={tpl.name} onChange={(name) => up({ name }, t('Rename creature'))} />
          <label className="check"><input type="checkbox" checked={tpl.boss} onChange={(e) => up({ boss: e.target.checked })} /> {t('Raid boss (bigger, AoE slam, shared loot)')}</label>
        </div>
      </div>
      <div className="two-col">
        <Field label={t('Type')}><Select value={tpl.type} options={CREATURE_TYPES.map((x) => ({ key: x.key, label: t(x.name) }))} onChange={(type) => up({ type }, t('Change creature type'))} /></Field>
        {num('level', 'Level', 1, 100)}
        {num('maxHp', 'HP', 1, 1_000_000)}
        {num('damage', 'Damage', 0, 100_000)}
        {num('defense', 'Defense', 0, 100_000)}
        {num('speed', 'Speed (tiles/s)', 0.1, 8, 0.1)}
        {num('aggroRange', 'Aggro range', 0, 30, 0.5)}
        {num('attackRange', 'Attack range', 0.8, 10, 0.1)}
        {num('respawnMinutes', 'Respawn (game min)', 1, 10_000)}
        {num('xpReward', 'XP reward', 0, 1_000_000)}
        {tpl.boss && <Field label={t('Gold per raider')}><NumberInput value={tpl.goldReward ?? 0} min={0} max={1_000_000} onChange={(goldReward) => up({ goldReward })} /></Field>}
      </div>
      {tpl.boss && <div className="hint">{t('Bosses slam everyone nearby, enrage below 30% HP and reset if the raid dies. Everyone who fought gets XP, gold and their own loot roll.')}</div>}
      <Field label={t('Aggression')} hint={t(AGGRESSIONS.find((a) => a.key === tpl.aggression)?.hint ?? '')}>
        <div className="chip-row">
          {AGGRESSIONS.map((a) => <button key={a.key} className={`btn small ${tpl.aggression === a.key ? 'active' : ''}`} onClick={() => up({ aggression: a.key })}>{t(a.label)}</button>)}
        </div>
      </Field>
      <Field label={t('Loot table')} hint={t('Chance in %. The killer receives the drops (guards sell them to merchants).')}>
        <ItemRowEditor session={session} rows={tpl.loot} empty={t('No loot.')} make={(itemId) => ({ itemId, chance: 50, min: 1, max: 1 })} onChange={(loot) => up({ loot }, t('Edit loot'))}
          columns={[{ key: 'chance', label: '%', min: 0, max: 100, width: 50 }, { key: 'min', label: t('Min'), min: 0, max: 9999, width: 50 }, { key: 'max', label: t('Max'), min: 0, max: 9999, width: 50 }]}
          extra={{ label: t('Avg'), width: 44, render: (r) => ((r.chance / 100) * ((r.min + r.max) / 2)).toFixed(2) }} />
      </Field>
    </div>
  );
}
