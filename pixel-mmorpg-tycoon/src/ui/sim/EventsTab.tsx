import { useState } from 'react';
import { createId, type EntityId } from '@/core/ids';
import { EVENT_METRICS, EVENT_TYPES, getEventType, TRIGGER_KINDS } from '@/data/eventTypes';
import { getRegionType } from '@/data/regionTypes';
import { t } from '@/i18n';
import type { EventDef, EventType } from '@/models/events';
import type { GameSession } from '@/session/GameSession';
import { formatGameTime } from '@/simulation/time';
import { confirmDialog } from '@/stores/dialogStore';
import { toast } from '@/stores/toastStore';
import { Field, NumberInput, TextInput } from '../components/Fields';
import { useEntityList } from '../hooks/useEntities';
import { money } from './StudioTab';
import { useSimTick } from './useSimTick';

function triggerSummary(d: EventDef): string {
  const tr = d.trigger;
  if (tr.kind === 'manual') return t('Manual');
  if (tr.kind === 'schedule') return t('Every {n} day(s) at {h}:00', { n: tr.everyDays, h: tr.hour });
  const metric = t(EVENT_METRICS.find((m) => m.key === tr.metric)!.label);
  return t('When {metric} {op} {v}', { metric, op: tr.op, v: tr.value });
}

/** A sensible new event of the given type (target region / creature picked from the world). */
function newEventDef(session: GameSession, type: EventType): EventDef {
  const meta = getEventType(type);
  const store = session.runtime.entities;
  const regions = store.list('regions');
  const region = regions.find((r) => meta.preferRegions.includes(r.type)) ?? regions[0];
  const tpls = store.list('creatureTemplates');
  const template = type === 'worldBoss' ? tpls.find((c) => c.boss) ?? tpls.sort((a, b) => b.level - a.level)[0] : type === 'dungeonOpening' ? tpls.find((c) => c.type === 'skeleton') ?? tpls[0] : tpls.find((c) => c.type === 'goblin' || c.type === 'orc') ?? tpls[0];
  return {
    id: createId('evdef'), name: t(meta.name), type, enabled: true, durationHours: meta.defaults.durationHours,
    regionId: meta.needsRegion ? region?.id ?? null : null, templateId: meta.needsTemplate ? template?.id ?? null : null,
    count: meta.defaults.count, xpMultiplier: meta.defaults.xpMultiplier,
    trigger: { kind: 'manual', everyDays: 7, hour: 18, metric: 'popularity', op: '<', value: 30, cooldownHours: 24 },
  };
}

export function EventsTab({ session }: { session: GameSession }) {
  useSimTick(1000);
  const defs = useEntityList(session, 'events');
  const [current, setCurrent] = useState<EntityId | null>(null);
  const [newType, setNewType] = useState<EventType>('invasion');
  const ev = session.worldEvents;
  const sim = session.runtime.sim;
  const now = session.runtime.clock.totalMinutes;
  const def = defs.find((d) => d.id === current) ?? defs[0];

  const startNow = (d: EventDef) => {
    const problem = ev.problem(d);
    if (problem) return toast(problem, 'error');
    ev.start(d.id, true);
    toast(t('Event started: {name}', { name: d.name }), 'success');
  };

  return (
    <div className="tab-page econ-page">
      <div className="tab-list scroll econ-main">
        <div className="panel">
          <div className="panel-header">{t('Running now')} ({sim.activeEvents.length})</div>
          <div className="section">
            {sim.activeEvents.length === 0 && <div className="hint">{t('No events are running. Start one below, or let triggers start them.')}</div>}
            {sim.activeEvents.map((a) => {
              const left = Math.max(0, a.endsAt - now);
              const pct = 1 - left / Math.max(1, a.endsAt - a.startedAt);
              return (
                <div key={a.id} className="active-event">
                  <div className="row">
                    <b className="grow">{a.name}</b>
                    <span className="hint">{t(getEventType(a.type).name)}</span>
                    <button className="btn small" onClick={() => ev.end(a.id)}>{t('End')}</button>
                  </div>
                  <div className="bar"><div className="bar-fill" style={{ width: `${pct * 100}%`, background: '#f2c14e' }} /></div>
                  <div className="hint">{t('{h} h {m} min left', { h: Math.floor(left / 60), m: Math.floor(left % 60) })} · {t('Participants')}: {a.participants.length} · {t('Kills')}: {a.kills}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">{t('Events')} ({defs.length})
            <div className="row">
              <select className="input slot-select" value={newType} onChange={(e) => setNewType(e.target.value as EventType)}>
                {EVENT_TYPES.map((x) => <option key={x.type} value={x.type}>{t(x.name)}</option>)}
              </select>
              <button className="btn small primary" onClick={() => setCurrent(session.entities.addEvent(newEventDef(session, newType)).id)}>+ {t('New')}</button>
            </div>
          </div>
          <div className="table-scroll scroll" style={{ maxHeight: 320 }}>
            <table className="data-table">
              <thead><tr><th>{t('Name')}</th><th>{t('Type')}</th><th>{t('Trigger')}</th><th>{t('Status')}</th><th /></tr></thead>
              <tbody>
                {defs.map((d) => {
                  const running = ev.isRunning(d.id);
                  return (
                    <tr key={d.id} className={def?.id === d.id ? 'active' : ''} onClick={() => setCurrent(d.id)}>
                      <td>{d.name}</td>
                      <td>{t(getEventType(d.type).name)}</td>
                      <td>{triggerSummary(d)}</td>
                      <td className={running ? 'good' : !d.enabled ? 'bad' : ''}>{running ? t('Running') : d.enabled ? t('Ready') : t('Disabled')}</td>
                      <td><button className="btn small" disabled={running} onClick={(e) => { e.stopPropagation(); startNow(d); }}>{t('Start now')}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {defs.length === 0 && <div className="hint pad">{t('No events yet. Pick a type above and press "+ New".')}</div>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">{t('Event history')}</div>
          <div className="table-scroll scroll" style={{ maxHeight: 260 }}>
            <table className="data-table">
              <thead><tr><th>{t('Name')}</th><th>{t('Started')}</th><th>{t('Participants')}</th><th>{t('Kills')}</th><th>{t('Popularity')}</th></tr></thead>
              <tbody>
                {[...sim.eventHistory].reverse().map((r, i) => (
                  <tr key={i}><td>{r.name}</td><td>{formatGameTime(r.startedAt)}</td><td>{r.participants}</td><td>{r.kills}</td>
                    <td className={r.popularityDelta > 0 ? 'good' : r.popularityDelta < 0 ? 'bad' : ''}>{r.popularityDelta > 0 ? '+' : ''}{r.popularityDelta}</td></tr>
                ))}
              </tbody>
            </table>
            {sim.eventHistory.length === 0 && <div className="hint pad">{t('Finished events and their results appear here.')}</div>}
          </div>
        </div>
      </div>
      <div className="panel tab-detail scroll">
        <div className="panel-header">{def ? def.name : t('Event')}</div>
        <div className="section">
          {def ? <EventForm session={session} def={def} onStart={() => startNow(def)} onDeleted={() => setCurrent(null)} onDuplicated={setCurrent} /> : <div className="hint">{t('Create an event to edit it.')}</div>}
        </div>
      </div>
    </div>
  );
}

function EventForm({ session, def, onStart, onDeleted, onDuplicated }: { session: GameSession; def: EventDef; onStart: () => void; onDeleted: () => void; onDuplicated: (id: EntityId) => void }) {
  const up = (patch: Partial<EventDef>, label = t('Edit event')) => session.entities.update('events', def.id, patch, label);
  const trig = (patch: Partial<EventDef['trigger']>) => up({ trigger: { ...def.trigger, ...patch } }, t('Edit trigger'));
  const meta = getEventType(def.type);
  const store = session.runtime.entities;
  const problem = session.worldEvents.problem(def);
  const running = session.worldEvents.isRunning(def.id);
  const remove = async () => {
    const ok = await confirmDialog({ title: t('Delete event'), message: t('Delete "{name}"?', { name: def.name }), confirmLabel: t('Delete'), danger: true });
    if (!ok) return;
    for (const a of session.runtime.sim.activeEvents.filter((x) => x.defId === def.id)) session.worldEvents.end(a.id);
    session.entities.remove('events', [def.id]);
    onDeleted();
  };

  return (
    <div className="form">
      <Field label={t('Name')}><TextInput value={def.name} onChange={(name) => up({ name }, t('Rename event'))} /></Field>
      <Field label={t('Type')} hint={t(meta.description)}>
        <select className="input" value={def.type} onChange={(e) => { const m = getEventType(e.target.value as EventType); up({ type: m.type, count: m.defaults.count, xpMultiplier: m.defaults.xpMultiplier, durationHours: m.defaults.durationHours }); }}>
          {EVENT_TYPES.map((x) => <option key={x.type} value={x.type}>{t(x.name)}</option>)}
        </select>
      </Field>
      <label className="check"><input type="checkbox" checked={def.enabled} onChange={(e) => up({ enabled: e.target.checked })} /> {t('Enabled (triggers can start it)')}</label>
      <Field label={`${t('Duration')}: ${def.durationHours} ${t('h')}`}>
        <input type="range" min={1} max={48} value={def.durationHours} onChange={(e) => up({ durationHours: +e.target.value })} />
      </Field>
      {meta.needsRegion && (
        <Field label={t('Region')}>
          <select className="input" value={def.regionId ?? ''} onChange={(e) => up({ regionId: e.target.value || null })}>
            <option value="">—</option>
            {store.list('regions').map((r) => <option key={r.id} value={r.id}>{r.name} · {t(getRegionType(r.type).name)}</option>)}
          </select>
        </Field>
      )}
      {meta.needsTemplate && (
        <Field label={t('Creature')}>
          <select className="input" value={def.templateId ?? ''} onChange={(e) => up({ templateId: e.target.value || null })}>
            <option value="">—</option>
            {store.list('creatureTemplates').map((c) => <option key={c.id} value={c.id}>{c.name} ({t('Lv')} {c.level}){c.boss ? ' · ' + t('BOSS') : ''}</option>)}
          </select>
        </Field>
      )}
      <div className="two-col">
        {(def.type === 'invasion' || def.type === 'dungeonOpening') && <Field label={t('Monsters')}><NumberInput value={def.count} min={1} max={60} onChange={(count) => up({ count })} /></Field>}
        {(def.type === 'doubleXp' || def.type === 'invasion' || def.type === 'worldBoss' || def.type === 'dungeonOpening') && (
          <Field label={def.type === 'doubleXp' ? t('XP multiplier (all XP)') : t('XP multiplier (event monsters)')}><NumberInput value={def.xpMultiplier} min={1} max={10} step={0.5} onChange={(xpMultiplier) => up({ xpMultiplier })} /></Field>
        )}
      </div>
      <Field label={t('Trigger')} hint={t(TRIGGER_KINDS.find((k) => k.key === def.trigger.kind)!.hint)}>
        <div className="chip-row">
          {TRIGGER_KINDS.map((k) => <button key={k.key} className={`btn small ${def.trigger.kind === k.key ? 'active' : ''}`} onClick={() => trig({ kind: k.key })}>{t(k.label)}</button>)}
        </div>
      </Field>
      {def.trigger.kind === 'schedule' && (
        <div className="two-col">
          <Field label={t('Every N days')}><NumberInput value={def.trigger.everyDays} min={1} max={60} onChange={(everyDays) => trig({ everyDays })} /></Field>
          <Field label={t('At hour')}><NumberInput value={def.trigger.hour} min={0} max={23} onChange={(hour) => trig({ hour })} /></Field>
        </div>
      )}
      {def.trigger.kind === 'condition' && (
        <div className="cond-row">
          <select className="input" value={def.trigger.metric} onChange={(e) => trig({ metric: e.target.value as EventDef['trigger']['metric'] })}>
            {EVENT_METRICS.map((m) => <option key={m.key} value={m.key}>{t(m.label)}</option>)}
          </select>
          <select className="input" value={def.trigger.op} onChange={(e) => trig({ op: e.target.value as '<' | '>' })}><option value="<">&lt;</option><option value=">">&gt;</option></select>
          <NumberInput value={def.trigger.value} min={0} max={10000} step={0.5} onChange={(value) => trig({ value })} />
        </div>
      )}
      {def.trigger.kind !== 'manual' && <Field label={t('Cooldown (game hours)')}><NumberInput value={def.trigger.cooldownHours} min={0} max={1000} onChange={(cooldownHours) => trig({ cooldownHours })} /></Field>}
      {session.studio.standard && <div className="kv"><span>{t('Cost per run')}</span><span>{money(meta.cost)}</span></div>}
      {problem && !running && <div className="issues"><li className="error">✗ {problem}</li></div>}
      <div className="chip-row">
        <button className="btn primary" disabled={running} onClick={onStart}>{running ? t('Running') : t('Start now')}</button>
        <button className="btn small" onClick={() => { const c = session.entities.duplicateEvent(def.id); if (c) onDuplicated(c.id); }}>{t('Duplicate')}</button>
        <button className="btn small danger" onClick={remove}>{t('Delete')}</button>
      </div>
    </div>
  );
}
