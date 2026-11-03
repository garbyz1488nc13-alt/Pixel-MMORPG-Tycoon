import { useState } from 'react';
import { createId, type EntityId } from '@/core/ids';
import { EQUIP_SLOTS } from '@/data/rpgDefaults';
import { t } from '@/i18n';
import type { Attribute, ClassDef, ClassKey, EquipSlot, ProgressionConfig, SkillDef } from '@/models/rpg';
import type { GameSession } from '@/session/GameSession';
import { ATTRIBUTES, characterStats, totalXpFor, unlockedSkills, xpToNext } from '@/systems/rpg/progression';
import { Field, NumberInput, TextInput } from '../components/Fields';
import { useEntityList } from '../hooks/useEntities';
import { ItemIcon } from './ItemIcon';
import { LineChart } from './LineChart';
import { useRpg } from './useRpg';

const ATTR_LABEL: Record<Attribute, string> = { str: 'STR', agi: 'AGI', int: 'INT', vit: 'VIT' };
const SKILL_KINDS: SkillDef['kind'][] = ['attack', 'heal', 'buff'];

export function ProgressionTab({ session }: { session: GameSession }) {
  const rpg = useRpg(session);
  const p = rpg.progression;
  const items = useEntityList(session, 'items');
  const [clsKey, setClsKey] = useState<ClassKey>(p.classes[0]?.key ?? 'warrior');
  const [level, setLevel] = useState(10);
  const [gear, setGear] = useState<Partial<Record<EquipSlot, EntityId>>>({});
  const cls = p.classes.find((c) => c.key === clsKey) ?? p.classes[0];

  const setRule = <K extends keyof ProgressionConfig>(k: K, v: ProgressionConfig[K]) =>
    session.updateRpg(t('Edit progression'), (r) => { r.progression[k] = v; }, `prog:${k}`);
  const editClass = (mut: (c: ClassDef) => void, key: string) =>
    session.updateRpg(t('Edit class'), (r) => { const c = r.progression.classes.find((x) => x.key === cls.key); if (c) mut(c); }, `class:${cls.key}:${key}`);

  const lv = Math.min(level, p.maxLevel);
  const equipped = Object.values(gear).map((id) => (id ? items.find((i) => i.id === id) : undefined));
  const stats = cls ? characterStats(cls, lv, p, equipped) : null;
  const levels = Array.from({ length: Math.max(1, p.maxLevel - 1) }, (_, i) => i + 1);
  const curve = levels.map((l) => xpToNext(l, p));
  const tableLevels = [1, 2, 3, 5, 10, 15, 20, 30, 40, 50, 75, 100].filter((l) => l <= p.maxLevel);

  return (
    <div className="tab-page">
      <div className="tab-list scroll econ-main">
        <div className="panel">
          <div className="panel-header">{t('Experience curve')}</div>
          <div className="section">
            <div className="hint">{t('XP to next level = {base} × level^{exp}', { base: p.xpBase, exp: p.xpExponent })}</div>
            <LineChart series={[{ label: t('XP to next level'), values: curve, color: '#f2c14e' }]} xLabels={[t('Lv') + ' 1', t('Lv') + ' ' + (p.maxLevel - 1)]} empty="—" />
            <table className="data-table compact-table">
              <thead><tr><th>{t('Level')}</th><th>{t('XP to next level')}</th><th>{t('Total XP')}</th>{cls && <><th>{t('HP')}</th><th>{t('Mana')}</th><th>{t('Attack')}</th><th>{t('Defense')}</th></>}</tr></thead>
              <tbody>
                {tableLevels.map((l) => {
                  const s = cls ? characterStats(cls, l, p) : null;
                  return <tr key={l}><td>{l}</td><td>{xpToNext(l, p) || '—'}</td><td>{totalXpFor(l, p).toLocaleString()}</td>{s && <><td>{s.maxHp}</td><td>{s.maxMana}</td><td>{s.attack}</td><td>{s.defense}</td></>}</tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">{t('Character preview')}</div>
          <div className="section form">
            <div className="chip-row">
              {p.classes.map((c) => <button key={c.key} className={`btn small ${clsKey === c.key ? 'active' : ''}`} onClick={() => setClsKey(c.key)}>{c.name}</button>)}
            </div>
            <Field label={`${t('Level')}: ${lv}`}><input type="range" min={1} max={p.maxLevel} value={lv} onChange={(e) => setLevel(+e.target.value)} /></Field>
            <div className="gear-grid">
              {EQUIP_SLOTS.filter((s) => s.key !== 'none').map((s) => {
                const it = gear[s.key] ? items.find((i) => i.id === gear[s.key]) : undefined;
                const tooHigh = it && it.levelReq > lv;
                return (
                  <label key={s.key} className={`gear-slot ${tooHigh ? 'bad' : ''}`} title={tooHigh ? t('Requires level {n}', { n: it!.levelReq }) : undefined}>
                    <ItemIcon item={it} size={20} />
                    <select className="input" value={gear[s.key] ?? ''} onChange={(e) => setGear({ ...gear, [s.key]: e.target.value || undefined })}>
                      <option value="">{t(s.label)}: —</option>
                      {items.filter((i) => i.slot === s.key).map((i) => <option key={i.id} value={i.id}>{i.name} ({t('Lv')} {i.levelReq})</option>)}
                    </select>
                  </label>
                );
              })}
            </div>
            {stats && (
              <div className="stat-tiles small">
                {([['HP', stats.maxHp], ['Mana', stats.maxMana], ['Attack', stats.attack], ['Defense', stats.defense], ['STR', stats.str], ['AGI', stats.agi], ['INT', stats.int], ['VIT', stats.vit]] as const).map(([k, v]) => (
                  <div key={k} className="panel stat-tile"><span className="hint">{t(k)}</span><b>{v}</b></div>
                ))}
              </div>
            )}
            {cls && <div className="hint">{t('Skills unlocked')}: {unlockedSkills(cls, lv).map((s) => s.name).join(', ') || '—'}</div>}
          </div>
        </div>
      </div>

      <div className="panel tab-detail scroll">
        <div className="panel-header">{t('Progression rules')}</div>
        <div className="section form">
          <div className="two-col">
            <Field label={t('Max level')}><NumberInput value={p.maxLevel} min={2} max={200} onChange={(v) => setRule('maxLevel', v)} /></Field>
            <Field label={t('XP base')}><NumberInput value={p.xpBase} min={1} max={100000} onChange={(v) => setRule('xpBase', v)} /></Field>
            <Field label={t('XP exponent')}><NumberInput value={p.xpExponent} min={0.5} max={4} step={0.05} onChange={(v) => setRule('xpExponent', v)} /></Field>
            <Field label={t('Base HP')}><NumberInput value={p.baseHp} min={1} max={100000} onChange={(v) => setRule('baseHp', v)} /></Field>
            <Field label={t('HP per VIT')}><NumberInput value={p.hpPerVit} min={0} max={1000} step={0.5} onChange={(v) => setRule('hpPerVit', v)} /></Field>
            <Field label={t('Base mana')}><NumberInput value={p.baseMana} min={0} max={100000} onChange={(v) => setRule('baseMana', v)} /></Field>
            <Field label={t('Mana per INT')}><NumberInput value={p.manaPerInt} min={0} max={1000} step={0.5} onChange={(v) => setRule('manaPerInt', v)} /></Field>
            <Field label={t('Attack per main attribute')}><NumberInput value={p.attackPerPrimary} min={0} max={100} step={0.1} onChange={(v) => setRule('attackPerPrimary', v)} /></Field>
            <Field label={t('Defense per VIT')}><NumberInput value={p.defensePerVit} min={0} max={100} step={0.1} onChange={(v) => setRule('defensePerVit', v)} /></Field>
          </div>
        </div>
        {cls && (
          <>
            <div className="panel-header">{t('Class')}: {cls.name}</div>
            <div className="section form">
              <div className="chip-row">
                {p.classes.map((c) => <button key={c.key} className={`btn small ${clsKey === c.key ? 'active' : ''}`} onClick={() => setClsKey(c.key)}>{c.name}</button>)}
              </div>
              <Field label={t('Name')}><TextInput value={cls.name} onChange={(v) => editClass((c) => { c.name = v; }, 'name')} /></Field>
              <Field label={t('Description')}><textarea className="input" rows={2} value={cls.description} onChange={(e) => editClass((c) => { c.description = e.target.value; }, 'desc')} /></Field>
              <Field label={t('Main attribute')} hint={t('Attack scales with this attribute.')}>
                <div className="chip-row">{ATTRIBUTES.map((a) => <button key={a} className={`btn small ${cls.primary === a ? 'active' : ''}`} onClick={() => editClass((c) => { c.primary = a; }, 'primary')}>{t(ATTR_LABEL[a])}</button>)}</div>
              </Field>
              <table className="data-table compact-table">
                <thead><tr><th /><th>{t('Base')}</th><th>{t('Per level')}</th><th>{t('At level {n}', { n: lv })}</th></tr></thead>
                <tbody>
                  {ATTRIBUTES.map((a) => (
                    <tr key={a}>
                      <td>{t(ATTR_LABEL[a])}</td>
                      <td><NumberInput value={cls.base[a]} min={0} max={999} onChange={(v) => editClass((c) => { c.base[a] = v; }, `base:${a}`)} /></td>
                      <td><NumberInput value={cls.growth[a]} min={0} max={50} step={0.1} onChange={(v) => editClass((c) => { c.growth[a] = v; }, `growth:${a}`)} /></td>
                      <td>{Math.round(cls.base[a] + cls.growth[a] * (lv - 1))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Field label={t('Skills')}>
                <div className="row-editor">
                  <div className="re-row re-head" style={{ gridTemplateColumns: 'minmax(0,1fr) 44px 74px 50px 44px 44px 26px' }}>
                    <span>{t('Name')}</span><span>{t('Lv')}</span><span>{t('Type')}</span><span>{t('Power')}</span><span>{t('Mana')}</span><span>{t('CD')}</span><span />
                  </div>
                  {cls.skills.map((s, i) => (
                    <div key={s.id} className="re-row" style={{ gridTemplateColumns: 'minmax(0,1fr) 44px 74px 50px 44px 44px 26px' }}>
                      <TextInput value={s.name} onChange={(v) => editClass((c) => { c.skills[i].name = v; }, `sk:${s.id}:n`)} />
                      <NumberInput value={s.unlockLevel} min={1} max={p.maxLevel} onChange={(v) => editClass((c) => { c.skills[i].unlockLevel = v; }, `sk:${s.id}:l`)} />
                      <select className="input" value={s.kind} onChange={(e) => editClass((c) => { c.skills[i].kind = e.target.value as SkillDef['kind']; }, `sk:${s.id}:k`)}>
                        {SKILL_KINDS.map((k) => <option key={k} value={k}>{t(k)}</option>)}
                      </select>
                      <NumberInput value={s.power} min={0} max={1000} step={0.1} onChange={(v) => editClass((c) => { c.skills[i].power = v; }, `sk:${s.id}:p`)} />
                      <NumberInput value={s.manaCost} min={0} max={9999} onChange={(v) => editClass((c) => { c.skills[i].manaCost = v; }, `sk:${s.id}:m`)} />
                      <NumberInput value={s.cooldown} min={0} max={999} onChange={(v) => editClass((c) => { c.skills[i].cooldown = v; }, `sk:${s.id}:c`)} />
                      <button className="btn small icon" title={t('Remove')} onClick={() => editClass((c) => { c.skills.splice(i, 1); }, `sk:rm:${s.id}`)}>×</button>
                    </div>
                  ))}
                  <button className="btn small" onClick={() => editClass((c) => { c.skills.push({ id: createId('skill'), name: t('New skill'), unlockLevel: lv, kind: 'attack', power: 1.5, manaCost: 10, cooldown: 5 }); }, `sk:add:${Date.now()}`)}>+ {t('Add')}</button>
                </div>
              </Field>
              <div className="hint">{t('Attack: damage ×power. Heal: restores power% of max HP. Buff: +power% for a while. Players use skills in Phase 4.')}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
