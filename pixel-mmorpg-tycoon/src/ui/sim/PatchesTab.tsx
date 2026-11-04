import { useState } from 'react';
import { t } from '@/i18n';
import type { ClassKey } from '@/models/rpg';
import type { GameSession } from '@/session/GameSession';
import { PatchService, type PatchDraft } from '@/simulation/liveops/PatchService';
import { formatGameTime } from '@/simulation/time';
import { toast } from '@/stores/toastStore';
import { audio } from '@/audio/AudioEngine';
import { money } from './StudioTab';
import { useSimTick } from './useSimTick';

const EMPTY: PatchDraft = { buff: null, nerf: null, levelCap: false, xp: 0, bugfix: false };

/** Compose and ship live patches; see how players reacted to previous ones. */
export function PatchesTab({ session }: { session: GameSession }) {
  useSimTick(1000);
  const svc = session.patches;
  const st = session.runtime.sim.patches;
  const [draft, setDraft] = useState<PatchDraft>(EMPTY);
  const classes = session.runtime.rpg.progression.classes;
  const content = svc.newContent();
  const hype = svc.hype();
  const problem = svc.problem(draft);
  const cost = svc.cost(draft);
  const up = (p: Partial<PatchDraft>) => setDraft({ ...draft, ...p });
  const ship = () => {
    const r = svc.release(draft);
    if (!r) return;
    audio.play('fanfare');
    toast(t('Patch {v} released!', { v: r.version }), 'success');
    setDraft(EMPTY);
  };
  const classSelect = (value: ClassKey | null, onChange: (k: ClassKey | null) => void) => (
    <select className="input" value={value ?? ''} onChange={(e) => onChange((e.target.value || null) as ClassKey | null)}>
      <option value="">— {t('none')} —</option>
      {classes.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
    </select>
  );

  return (
    <div className="tab-page econ-page">
      <div className="tab-list scroll econ-main">
        <div className="stat-tiles">
          <div className="panel stat-tile"><span className="hint">{t('Live version')}</span><b>{svc.version()}</b></div>
          <div className={`panel stat-tile ${st.bugs > 5 ? 'danger' : ''}`}><span className="hint">{t('Known bugs')}</span><b>{st.bugs}</b></div>
          <div className="panel stat-tile"><span className="hint">{t('XP rate')}</span><b>×{st.xpRate}</b></div>
          <div className="panel stat-tile"><span className="hint">{t('Level cap')}</span><b>{session.runtime.rpg.progression.maxLevel}</b></div>
        </div>
        <div className="panel">
          <div className="panel-header">{t('Patch history')}</div>
          <div className="review-list scroll">
            {st.history.length === 0 && <div className="hint pad">{t('No patches yet. Build something new and ship it!')}</div>}
            {[...st.history].reverse().map((r) => {
              const mood = r.moodAfter === null ? null : r.moodAfter - r.moodBefore;
              const pop = r.popularityAfter === null ? null : r.popularityAfter - r.popularityBefore;
              return (
                <div key={r.version} className="review">
                  <div className="review-head">
                    <b>{t('Patch {v}', { v: r.version })}</b>
                    <span className="hint">{formatGameTime(r.at)} · {t('hype {h}', { h: r.hype })} · {t('new bugs: {n}', { n: r.bugsIntroduced })}</span>
                  </div>
                  <ul className="patch-notes">{r.notes.map((n, i) => <li key={i}>{PatchService.noteText(n)}</li>)}</ul>
                  <div className="hint">
                    {mood === null ? t('Reaction is measured one game day after release…') : <>
                      {t('Players’ mood')}: <span className={mood >= 0 ? 'good-text' : 'bad-text'}>{mood >= 0 ? '+' : ''}{mood}</span> · {t('Popularity')}: <span className={(pop ?? 0) >= 0 ? 'good-text' : 'bad-text'}>{(pop ?? 0) >= 0 ? '+' : ''}{pop}</span>
                    </>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="panel tab-detail scroll">
        <div className="panel-header">{t('Next patch')} · {t('Patch {v}', { v: draft.levelCap || hype >= 25 ? `${st.major + 1}.0` : `${st.major}.${st.minor + 1}` })}</div>
        <div className="section form">
          <div className="el-title">{t('New content since the last patch')}</div>
          {content.length === 0 ? <div className="hint">{t('Nothing new yet. Regions, bosses, quests, events and items you add are announced in the next patch.')}</div>
            : content.map((c) => <div key={c.key} className="kv"><span>{t(c.label, { n: c.n })}</span></div>)}
          <div className="kv"><span>{t('Hype')}</span><b>{hype}</b></div>
          <div className="el-title">{t('Balance changes')}</div>
          <div className="field"><label>{t('Buff a class (+12% damage)')}</label>{classSelect(draft.buff, (buff) => up({ buff }))}</div>
          <div className="field"><label>{t('Nerf a class (−12% damage)')}</label>{classSelect(draft.nerf, (nerf) => up({ nerf }))}<span className="hint">{t('Players of a nerfed class get very angry. PvP players like it when the strongest class is toned down.')}</span></div>
          <label className="check"><input type="checkbox" checked={draft.levelCap} onChange={(e) => up({ levelCap: e.target.checked })} /> {t('Raise the level cap by 5 (major version)')}</label>
          <div className="field">
            <label>{t('Levelling speed')}</label>
            <div className="chip-row">
              {([-1, 0, 1] as const).map((x) => <button key={x} className={`btn small ${draft.xp === x ? 'active' : ''}`} onClick={() => up({ xp: x })}>{t(x < 0 ? 'Slower' : x > 0 ? 'Faster' : 'Unchanged')}</button>)}
            </div>
          </div>
          <label className="check"><input type="checkbox" checked={draft.bugfix} onChange={(e) => up({ bugfix: e.target.checked })} /> {t('Bug fixes & QA pass (fixes {n} bugs, halves new ones)', { n: st.bugs })}</label>
          {session.studio.standard && <div className="kv"><span>{t('QA & marketing cost')}</span><span>{money(cost)}</span></div>}
          {problem && <div className="hint bad-text">{t(problem.key, problem.params)}</div>}
          <button className="btn primary" disabled={!!problem} onClick={ship}>{t('Release patch')}</button>
          <div className="hint">{t('Big content patches bring hype and returning players — and bugs. Live bugs annoy players until a patch fixes them.')}</div>
        </div>
      </div>
    </div>
  );
}
