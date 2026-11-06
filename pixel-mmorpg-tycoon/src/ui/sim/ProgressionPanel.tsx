import { CAMPAIGNS, FEATURES, FOUNDER_WORK, STAFF, type StaffRole } from '@/data/progression';
import { t } from '@/i18n';
import type { GameSession } from '@/session/GameSession';
import { toast } from '@/stores/toastStore';

const money = (n: number) => '$' + Math.round(n).toLocaleString('uk-UA');

/** Standard mode: research updates, hire a team, run marketing. */
export function ProgressionPanel({ session }: { session: GameSession }) {
  const studio = session.studio;
  const pr = studio.progression;
  if (!pr) return null;
  const report = (err: string | null, ok: string) => (err ? toast(err, 'error') : toast(ok, 'success'));
  const speed = FOUNDER_WORK + pr.staff.dev;
  const cur = pr.research ? FEATURES.find((f) => f.key === pr.research!.key) : undefined;
  return (
    <>
      <div className="panel">
        <div className="panel-header">{t('Development: research & updates')}</div>
        <div className="section">
          <div className="hint">{t('Your game launches almost empty. Research features and release them as updates: every update brings hype and happy players.')}</div>
          {cur && (
            <div className="feedback good">
              <b>{t('In development: {name}', { name: t(cur.name) })}</b>
              <div className="bar"><div className="bar-fill" style={{ width: Math.min(100, (pr.research!.done / cur.work) * 100) + '%', background: '#5aa9e6' }} /></div>
              <div className="hint">{t('About {d} game days left at {s} dev-days per day.', { d: Math.max(0, (cur.work - pr.research!.done) / speed).toFixed(1), s: speed })}</div>
            </div>
          )}
          {FEATURES.map((f) => {
            const done = pr.unlocked.includes(f.key);
            const blocked = !!f.requires && !pr.unlocked.includes(f.requires);
            return (
              <div key={f.key} className="kv" style={{ alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1 }}>{done ? '✓ ' : blocked ? '🔒 ' : ''}<b>{t(f.name)}</b> · {t('{n} dev-days', { n: f.work })} · {money(f.cost)}<div className="hint">{t(f.hint)}</div></span>
                {done ? <span className="good-text">{t('Released')}</span> : <button className="btn small primary" disabled={!!pr.research || blocked || studio.state.funds < f.cost} onClick={() => report(studio.startResearch(f.key), t('Development started: {name}', { name: t(f.name) }))}>{t('Develop')}</button>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">{t('Team')}</div>
        <div className="section">
          {(Object.keys(STAFF) as StaffRole[]).map((r) => (
            <div key={r} className="kv">
              <span>{t(STAFF[r].name)} · {money(STAFF[r].perDay)}/{t('day')}<div className="hint">{t(STAFF[r].hint)}</div></span>
              <span className="chip-row">
                <button className="btn small" onClick={() => studio.hire(r, -1)} disabled={!pr.staff[r]}>-</button>
                <b>{pr.staff[r]}</b>
                <button className="btn small primary" onClick={() => studio.hire(r, 1)}>+</button>
              </span>
            </div>
          ))}
          <div className="hint">{t('Team salaries: {m} per day.', { m: money(studio.staffPerDay()) })}</div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">{t('Marketing')}</div>
        <div className="section">
          <div className="kv"><span>{t('Hype')}</span><span>{Math.round(pr.hype)} / 100</span></div>
          <div className="bar"><div className="bar-fill" style={{ width: pr.hype + '%', background: '#f2a03a' }} /></div>
          <div className="hint">{t('Hype brings new players. It fades every hour unless marketers keep it up.')}</div>
          <div className="chip-row">
            {CAMPAIGNS.map((c) => (
              <button key={c.key} className="btn small" disabled={studio.state.funds < c.cost} onClick={() => report(studio.campaign(c.key), t('{name}: +{n} hype', { name: t(c.name), n: c.hype }))}>{t(c.name)} · {money(c.cost)}</button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
