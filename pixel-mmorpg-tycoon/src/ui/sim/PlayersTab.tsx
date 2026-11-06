import { accusations, cheatLabel } from '@/data/community';
import { useMemo, useState } from 'react';
import { FACTORS, getBehavior } from '@/data/playerTypes';
import { t } from '@/i18n';
import type { GameSession } from '@/session/GameSession';
import { ACTIVITY_LABEL } from '@/simulation/players/PlayerBrain';
import { useEditorStore } from '@/stores/editorStore';
import { SpritePreview } from '../components/SpritePreview';
import { crowdLevelRange, FACTOR_HINT, levelCoverage, summarizeFactors } from './feedback';
import { moodColor, PlayerDetail } from './PlayerDetail';
import { useSimTick } from './useSimTick';

type Filter = 'online' | 'offline' | 'all';
type Sort = 'level' | 'satisfaction' | 'name' | 'gold';

export function PlayersTab({ session }: { session: GameSession }) {
  useSimTick(1000);
  const sim = session.runtime.sim;
  const pm = session.players;
  const [filter, setFilter] = useState<Filter>('online');
  const [sort, setSort] = useState<Sort>('level');
  const focus = useEditorStore((s) => s.focusPlayer);
  const setFocus = useEditorStore((s) => s.setFocusPlayer);
  const online = pm.online();
  const avgSat = online.length ? online.reduce((n, p) => n + p.satisfaction, 0) / online.length : 0;
  const list = useMemo(() => {
    const base = sim.players.filter((p) => filter === 'all' || (filter === 'online') === p.online);
    const key: Record<Sort, (p: (typeof base)[number]) => number | string> = { level: (p) => -p.level, satisfaction: (p) => p.satisfaction, name: (p) => p.name.toLowerCase(), gold: (p) => -p.gold };
    return [...base].sort((a, b) => (key[sort](a) < key[sort](b) ? -1 : key[sort](a) > key[sort](b) ? 1 : 0));
  }, [sim.players, sim.players.length, filter, sort, online.length]);
  const player = focus ? pm.get(focus) : undefined;
  const fb = summarizeFactors(online.length ? online : sim.players);
  const range = crowdLevelRange(online.length ? online : sim.players);
  const coverage = levelCoverage(session.runtime, online);
  const maxCov = Math.max(1, ...coverage.map((c) => Math.max(c.players, c.monsters)));

  const tiles: [string, string, string?][] = [
    [t('Online'), `${online.length} / ${pm.capacity()}`, t('Online players / server capacity')],
    [t('Popularity'), `${Math.round(sim.popularity)}%`, t('Drives how many new players arrive each hour.')],
    [t('Avg. satisfaction'), online.length ? `${Math.round(avgSat)}%` : '—'],
    [t('Players total'), String(sim.players.length)],
    [t('Joined'), String(sim.totalJoined)],
    [t('Quit for good'), String(sim.totalLeft)],
  ];

  return (
    <div className="tab-page econ-page">
      <div className="tab-list scroll econ-main">
        <div className="stat-tiles">
          {tiles.map(([l, v, h]) => <div key={l} className="panel stat-tile" title={h}><span className="hint">{l}</span><b>{v}</b></div>)}
        </div>
        <div className="chart-row">
          <div className="panel">
            <div className="panel-header">{t('What players say')}</div>
            <div className="section">
              {fb.bad.length === 0 && fb.good.length === 0 && <div className="hint">{t('No players yet. Press Play and wait for them to arrive.')}</div>}
              {fb.bad.slice(0, 4).map((f) => (
                <div key={f.key} className="feedback bad">
                  <div><b>− {t(FACTORS[f.key].label)}</b> <span className="hint">{t('{n} players', { n: f.players })}</span></div>
                  {FACTOR_HINT[f.key] && <div className="hint">→ {t(FACTOR_HINT[f.key]!, { range })}</div>}
                </div>
              ))}
              {fb.good.slice(0, 3).map((f) => (
                <div key={f.key} className="feedback good"><b>+ {t(FACTORS[f.key].label)}</b> <span className="hint">{t('{n} players', { n: f.players })}</span></div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">{t('Players vs monsters by level')}</div>
            <div className="section coverage">
              {coverage.map((c) => (
                <div key={c.band} className="cov-row">
                  <span className="cov-band">{t('Lv')} {c.band}</span>
                  <div className="cov-bars">
                    <div className="bar"><div className="bar-fill" style={{ width: `${(c.players / maxCov) * 100}%`, background: '#7fd7ff' }} /></div>
                    <div className="bar"><div className="bar-fill" style={{ width: `${(c.monsters / maxCov) * 100}%`, background: '#e2574c' }} /></div>
                  </div>
                  <span className="cov-num">{c.players}/{c.monsters}</span>
                </div>
              ))}
              <div className="chart-legend"><span><i style={{ background: '#7fd7ff' }} />{t('Players online')}</span><span><i style={{ background: '#e2574c' }} />{t('Monster slots')}</span></div>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">{t('Players')} ({list.length})
            <div className="row">
              {(['online', 'offline', 'all'] as Filter[]).map((f) => <button key={f} className={`btn small ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{t(f === 'online' ? 'Online' : f === 'offline' ? 'Offline' : 'All')}</button>)}
              <select className="input slot-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="level">{t('Level')}</option><option value="satisfaction">{t('Satisfaction')}</option><option value="gold">{session.runtime.rpg.economy.currencyName}</option><option value="name">{t('Name')}</option>
              </select>
            </div>
          </div>
          <div className="table-scroll scroll" style={{ maxHeight: 360 }}>
            <table className="data-table">
              <thead><tr><th /><th>{t('Name')}</th><th>{t('Lv')}</th><th>{t('Type')}</th><th>{t('Doing')}</th><th>{t('Mood')}</th><th>{session.runtime.rpg.economy.currencyName}</th><th>{t('K/D')}</th></tr></thead>
              <tbody>
                {list.slice(0, 300).map((p) => {
                  const act = session.playerSystem.activityOf(p.id);
                  return (
                    <tr key={p.id} className={focus === p.id ? 'active' : ''} onClick={() => setFocus(p.id)}>
                      <td><SpritePreview frame={`pl:${p.classKey}:0`} box={18} /></td>
                      <td>{p.name}{p.streamer && p.online && <span className="badge live">LIVE</span>}{p.reports > 0 && <span className="badge report" title={`${t('Reports')}: ${accusations(p).map((x) => `${t(cheatLabel(x.kind))} ×${x.n}`).join(', ')}`}>!{p.reports}</span>}</td><td>{p.level}</td>
                      <td>{t(getBehavior(p.behavior).name)}</td>
                      <td>{p.online ? (act ? t(ACTIVITY_LABEL[act.kind]) : '—') : t('Offline')}</td>
                      <td><span style={{ color: moodColor(p.satisfaction) }}>{Math.round(p.satisfaction)}%</span></td>
                      <td>{p.gold}</td><td>{p.stats.kills}/{p.stats.deaths}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {list.length === 0 && <div className="hint pad">{t('Nobody here yet.')}</div>}
          </div>
        </div>
      </div>
      <div className="panel tab-detail scroll">
        <div className="panel-header">{player ? player.name : t('Player')}</div>
        <div className="section">
          {player ? <PlayerDetail session={session} player={player} /> : <div className="hint">{t('Select a player in the table or click one on the map.')}</div>}
        </div>
      </div>
    </div>
  );
}
