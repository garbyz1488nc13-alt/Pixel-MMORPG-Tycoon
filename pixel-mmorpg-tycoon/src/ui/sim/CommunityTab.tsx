import { useState } from 'react';
import { ANTI_CHEAT } from '@/data/community';
import { FACTORS, getBehavior } from '@/data/playerTypes';
import { t } from '@/i18n';
import type { PlayerState, Review } from '@/models/sim';
import type { GameSession } from '@/session/GameSession';
import { formatGameTime } from '@/simulation/time';
import { confirmDialog } from '@/stores/dialogStore';
import { useEditorStore } from '@/stores/editorStore';
import { PixelIcon } from '../components/PixelIcon';
import { SpritePreview } from '../components/SpritePreview';
import { LineChart } from '../rpg/LineChart';
import { FACTOR_HINT, crowdLevelRange } from './feedback';
import { moodColor } from './PlayerDetail';
import { money } from './StudioTab';
import { useSimTick } from './useSimTick';

/** Pixel stars, with partial fill for fractional ratings. */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="stars" title={value ? value.toFixed(2) : '—'}>
      {[1, 2, 3, 4, 5].map((i) => (
        <PixelIcon key={i} name="star" size={size} color={value >= i - 0.25 ? '#f2c14e' : value >= i - 0.75 ? '#b0832a' : '#3a2f57'} />
      ))}
    </span>
  );
}

export function reviewText(r: Review): string {
  return r.lines.map((l) => t(l.key, l.params)).join(' ');
}

/** Ban with confirmation (shared by the Players and Community tabs). */
export async function banPlayer(session: GameSession, p: PlayerState): Promise<void> {
  const ok = await confirmDialog({
    title: t('Ban player'),
    message: t('Ban {name} permanently?\nBanning a cheater makes the community happy. Banning an honest player causes outrage and bad reviews.', { name: p.name }),
    confirmLabel: t('Ban'),
    danger: true,
  });
  if (ok) session.community.ban(p.id);
}

type ReviewFilter = 'all' | 'good' | 'bad' | 'streamers';

export function CommunityTab({ session }: { session: GameSession }) {
  useSimTick(1000);
  const sim = session.runtime.sim;
  const community = session.community;
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const setFocus = useEditorStore((s) => s.setFocusPlayer);
  const setTab = useEditorStore((s) => s.setTab);
  const online = session.players.online();
  const streamers = online.filter((p) => p.streamer);
  const suspects = community.suspects().slice(0, 15);
  const reasons = community.reviewReasons();
  const range = crowdLevelRange(online.length ? online : sim.players);
  const reviews = [...sim.reviews].reverse().filter((r) => filter === 'all' || (filter === 'good' ? r.stars >= 4 : filter === 'bad' ? r.stars <= 2 : r.streamer));
  const ac = ANTI_CHEAT[sim.antiCheat];
  const standard = session.studio.standard;
  const setAntiCheat = (level: number) => {
    sim.antiCheat = level;
    session.runtime.markDirty();
    session.runtime.events.emit('studio:changed', undefined);
  };

  return (
    <div className="tab-page econ-page">
      <div className="tab-list scroll econ-main">
        <div className="stat-tiles">
          <div className="panel stat-tile"><span className="hint">{t('Rating')}</span><b>{sim.rating ? sim.rating.toFixed(2) : '—'}</b><Stars value={sim.rating} /></div>
          <div className="panel stat-tile"><span className="hint">{t('Reviews')}</span><b>{sim.reviews.length}</b></div>
          <div className="panel stat-tile"><span className="hint">{t('Popularity')}</span><b>{Math.round(sim.popularity)}%</b></div>
          <div className="panel stat-tile"><span className="hint">{t('Streaming now')}</span><b>{streamers.length}</b></div>
          <div className="panel stat-tile" title={t('Cheaters banned / honest players banned by mistake')}><span className="hint">{t('Bans')}</span><b>{sim.bans.cheaters} / <span className={sim.bans.innocent ? 'bad-text' : ''}>{sim.bans.innocent}</span></b></div>
        </div>

        <div className="chart-row">
          <div className="panel">
            <div className="panel-header">{t('Rating per day')}</div>
            <div className="section"><LineChart series={[{ label: t('Rating'), values: sim.ratingHistory, color: '#f2c14e' }]} xLabels={[t('older'), t('now')]} empty={t('The rating is recorded once a day after the first reviews.')} /></div>
          </div>
          <div className="panel">
            <div className="panel-header">{t('Why players rate you this way')}</div>
            <div className="section">
              {reasons.bad.length === 0 && reasons.good.length === 0 && <div className="hint">{t('No reviews yet. Players review the game when they log out or quit.')}</div>}
              {reasons.bad.slice(0, 3).map(([k, n]) => (
                <div key={k} className="feedback bad">
                  <div><b>− {t(FACTORS[k].label)}</b> <span className="hint">{t('{n} reviews', { n })}</span></div>
                  {FACTOR_HINT[k] && <div className="hint">→ {t(FACTOR_HINT[k]!, { range })}</div>}
                </div>
              ))}
              {reasons.good.slice(0, 3).map(([k, n]) => (
                <div key={k} className="feedback good"><b>+ {t(FACTORS[k].label)}</b> <span className="hint">{t('{n} reviews', { n })}</span></div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">{t('Reviews')}
            <div className="row">
              {(['all', 'good', 'bad', 'streamers'] as ReviewFilter[]).map((f) => (
                <button key={f} className={`btn small ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                  {t(f === 'all' ? 'All' : f === 'good' ? 'Positive' : f === 'bad' ? 'Negative' : 'Streamers')}
                </button>
              ))}
            </div>
          </div>
          <div className="review-list scroll">
            {reviews.length === 0 && <div className="hint pad">{t('No reviews here yet.')}</div>}
            {reviews.slice(0, 60).map((r) => (
              <div key={r.id} className={`review ${r.stars >= 4 ? 'good' : r.stars <= 2 ? 'bad' : ''} ${r.streamer ? 'streamer' : ''}`}>
                <div className="review-head">
                  <Stars value={r.stars} size={12} />
                  <b>{r.playerName}</b>
                  {r.streamer && <span className="badge live">LIVE</span>}
                  <span className="hint">{t('Lv')} {r.level} · {r.hours} {t('h')} · {formatGameTime(r.at)}</span>
                </div>
                <div className="review-text">{reviewText(r)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel tab-detail scroll">
        <div className="panel-header">{t('Streamers')}</div>
        <div className="section">
          {streamers.length === 0 && <div className="hint">{t('Nobody is streaming right now. Streamers show up more often as your game gets popular.')}</div>}
          {streamers.map((p) => (
            <button key={p.id} className="el-row" onClick={() => { setFocus(p.id); setTab('map'); }}>
              <span className="badge live">LIVE</span>
              <span className="grow">{p.name}</span>
              <span className="hint">{t('{n} viewers', { n: p.streamer!.viewers.toLocaleString() })}</span>
              <span style={{ color: moodColor(p.satisfaction) }}>{Math.round(p.satisfaction)}%</span>
            </button>
          ))}
          <div className="hint">{t('Keep streamers happy: their mood decides whether viewers join or stay away.')}</div>
        </div>

        <div className="panel-header">{t('Reports & suspects')}</div>
        <div className="section">
          {suspects.length === 0 && <div className="hint">{t('No suspicious players online.')}</div>}
          {suspects.length > 0 && (
            <table className="data-table compact-table">
              <thead><tr><th /><th>{t('Name')}</th><th>{t('Reports')}</th><th>{t('Suspicion')}</th><th /></tr></thead>
              <tbody>
                {suspects.map((p) => {
                  const s = community.suspicion(p);
                  return (
                    <tr key={p.id}>
                      <td><SpritePreview frame={`pl:${p.classKey}:0`} box={16} /></td>
                      <td><button className="link" onClick={() => setFocus(p.id)} title={t(getBehavior(p.behavior).name)}>{p.name}</button> <span className="hint">{t('Lv')} {p.level}</span></td>
                      <td>{p.reports}</td>
                      <td><div className="bar"><div className="bar-fill" style={{ width: `${s}%`, background: s > 60 ? '#e2574c' : s > 30 ? '#f2c14e' : '#6cc551' }} /></div></td>
                      <td><button className="btn small danger" onClick={() => banPlayer(session, p)}>{t('Ban')}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="hint">{t('Suspicion comes from reports and unusual stats (kills, gold or speed). Strong honest players can look suspicious too — check before you ban.')}</div>
        </div>

        <div className="panel-header">{t('Anti-cheat')}</div>
        <div className="section form">
          {ANTI_CHEAT.map((x) => (
            <button key={x.level} className={`anticheat ${sim.antiCheat === x.level ? 'active' : ''}`} onClick={() => setAntiCheat(x.level)}>
              <b>{t(x.name)}</b>
              <span className="hint">{t(x.description)}</span>
              {standard && x.costPerDay > 0 && <span className="cost">{money(x.costPerDay)} / {t('day')}</span>}
            </button>
          ))}
          <div className="kv"><span>{t('Banned automatically')}</span><span>{sim.bans.auto}</span></div>
          {ac.falseBan > 0 && <div className="hint">{t('This level sometimes bans honest players by mistake.')}</div>}
        </div>
      </div>
    </div>
  );
}
