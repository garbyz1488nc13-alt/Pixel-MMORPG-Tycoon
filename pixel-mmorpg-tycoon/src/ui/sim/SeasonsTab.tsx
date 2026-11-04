import { t } from '@/i18n';
import type { GameSession } from '@/session/GameSession';
import { LEAGUES, leagueFor, SEASON_LENGTHS } from '@/simulation/liveops/SeasonService';
import { formatGameTime } from '@/simulation/time';
import { confirmDialog } from '@/stores/dialogStore';
import { useEditorStore } from '@/stores/editorStore';
import { useSimTick } from './useSimTick';

function League({ points }: { points: number }) {
  const l = leagueFor(points);
  return <span className="league" style={{ color: l.color, borderColor: l.color }}>{t(l.label)}</span>;
}

/** Competitive seasons: clan leagues, player ladders, history. */
export function SeasonsTab({ session }: { session: GameSession }) {
  useSimTick(1000);
  const s = session.runtime.sim.season;
  const svc = session.seasons;
  const setFocus = useEditorStore((x) => x.setFocusPlayer);
  const setTab = useEditorStore((x) => x.setTab);
  const left = Math.max(0, svc.endsAt() - session.runtime.clock.totalMinutes);
  const clans = svc.clanStandings();
  const players = svc.playerStandings(10);
  const pvp = svc.pvpStandings(10);
  const show = (id: string) => { setFocus(id); setTab('map'); };
  const endNow = async () => {
    if (await confirmDialog({ title: t('End season now'), message: t('Close season {n} now and hand out the rewards?', { n: s.number }), confirmLabel: t('End season') })) svc.endSeason();
  };

  return (
    <div className="tab-page econ-page">
      <div className="tab-list scroll econ-main">
        <div className="stat-tiles">
          <div className="panel stat-tile"><span className="hint">{t('Season')}</span><b>{s.number}</b></div>
          <div className="panel stat-tile"><span className="hint">{t('Ends in')}</span><b>{t('{d} d {h} h', { d: Math.floor(left / 1440), h: Math.floor((left % 1440) / 60) })}</b></div>
          <div className="panel stat-tile"><span className="hint">{t('Competing players')}</span><b>{Object.keys(s.playerPoints).length}</b></div>
          <div className="panel stat-tile"><span className="hint">{t('Clans with points')}</span><b>{clans.filter((c) => c.points > 0).length}</b></div>
        </div>
        <div className="panel">
          <div className="panel-header">{t('Clan league')}</div>
          {clans.length === 0 ? <div className="hint pad">{t('No clans yet. Clans earn season points by killing bosses (world firsts count triple).')}</div> : (
            <table className="data-table">
              <thead><tr><th>#</th><th>{t('Clan')}</th><th>{t('Points')}</th><th>{t('League')}</th><th>{t('Members')}</th></tr></thead>
              <tbody>
                {clans.map((x, i) => (
                  <tr key={x.clan.id}><td>{i + 1}</td><td><span className="clan-dot" style={{ background: x.clan.color }} /> [{x.clan.tag}] {x.clan.name}</td><td>{x.points}</td><td><League points={x.points} /></td><td>{x.clan.members.length}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="chart-row">
          <div className="panel">
            <div className="panel-header">{t('Top players')}</div>
            <div className="section">
              {players.length === 0 && <div className="hint">{t('Players earn points from quests, level-ups, raids and PvP.')}</div>}
              {players.map((x, i) => <button key={x.player!.id} className="el-row" onClick={() => show(x.player!.id)}><span>{i + 1}.</span><span className="grow">{x.player!.name} <span className="hint">{t('Lv')} {x.player!.level}</span></span><b>{x.points}</b></button>)}
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">{t('PvP ladder')}</div>
            <div className="section">
              {pvp.length === 0 && <div className="hint">{t('No PvP kills this season.')}</div>}
              {pvp.map((x, i) => <button key={x.player!.id} className="el-row" onClick={() => show(x.player!.id)}><span>{i + 1}.</span><span className="grow">{x.player!.name}</span><b>{t('{n} kills', { n: x.kills })}</b></button>)}
            </div>
          </div>
        </div>
      </div>
      <div className="panel tab-detail scroll">
        <div className="panel-header">{t('Season settings')}</div>
        <div className="section form">
          <div className="field">
            <label>{t('Season length')}</label>
            <div className="chip-row">
              {SEASON_LENGTHS.map((d) => <button key={d} className={`btn small ${s.lengthDays === d ? 'active' : ''}`} onClick={() => { s.lengthDays = d; session.runtime.markDirty(); }}>{t('{n} days', { n: d })}</button>)}
            </div>
          </div>
          <div className="hint">{t('At the end of a season clans get fame, the top 3 players and the best PvP player get titles, everyone who competed is happier and the ladder resets. The last day of a season is a race to the top.')}</div>
          <button className="btn small" onClick={endNow}>{t('End season now')}</button>
          <div className="el-title">{t('Leagues')}</div>
          {LEAGUES.map((l) => <div key={l.key} className="kv"><span style={{ color: l.color }}>{t(l.label)}</span><span>{l.min}+</span></div>)}
        </div>
        <div className="panel-header">{t('Past seasons')}</div>
        <div className="section">
          {s.history.length === 0 && <div className="hint">{t('No finished seasons yet.')}</div>}
          {[...s.history].reverse().map((h) => (
            <div key={h.number} className="feedback good">
              <b>{t('Season {n}', { n: h.number })}</b> <span className="hint">{formatGameTime(h.endedAt)}</span>
              {h.topClans[0] && <div>★ [{h.topClans[0].tag}] {h.topClans[0].name} · {h.topClans[0].points}</div>}
              {h.topPlayers[0] && <div className="hint">{t('Champion')}: {h.topPlayers[0].name} · {h.topPvp[0] ? `${t('Warlord')}: ${h.topPvp[0].name}` : ''}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
