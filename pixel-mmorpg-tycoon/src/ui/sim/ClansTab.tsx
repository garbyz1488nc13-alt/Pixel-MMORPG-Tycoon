import { useState } from 'react';
import { CLAN_STYLES } from '@/data/clanData';
import { getBehavior } from '@/data/playerTypes';
import { t } from '@/i18n';
import type { Clan, PlayerState, RaidRecord } from '@/models/sim';
import type { GameSession } from '@/session/GameSession';
import { CLAN_LOYALTY } from '@/simulation/players/PlayerManager';
import { formatGameTime } from '@/simulation/time';
import { useEditorStore } from '@/stores/editorStore';
import { SpritePreview } from '../components/SpritePreview';
import { moodColor } from './PlayerDetail';
import { useSimTick } from './useSimTick';

const RESULT_CLASS: Record<RaidRecord['result'], string> = { win: 'good-text', wipe: 'bad-text', abandoned: 'hint' };
const RESULT_LABEL: Record<RaidRecord['result'], string> = { win: 'Victory', wipe: 'Wipe', abandoned: 'Gave up' };

/** Player communities: clans, their raids and the boss lairs they fight over. */
export function ClansTab({ session }: { session: GameSession }) {
  useSimTick(1000);
  const sim = session.runtime.sim;
  const clans = [...sim.clans].sort((a, b) => b.fame - a.fame || b.members.length - a.members.length);
  const [current, setCurrent] = useState<string | null>(null);
  const clan = clans.find((c) => c.id === current) ?? clans[0];
  const setFocus = useEditorStore((s) => s.setFocusPlayer);
  const setTab = useEditorStore((s) => s.setTab);
  const select = useEditorStore((s) => s.select);
  const inClans = sim.players.filter((p) => p.clanId).length;
  const lairs = session.clans.lairs();
  const wins = sim.raidHistory.filter((r) => r.result === 'win').length;
  const wipes = sim.raidHistory.filter((r) => r.result === 'wipe').length;

  const showLair = (id: string) => {
    const a = session.runtime.entities.get('spawnAreas', id);
    if (!a) return;
    select({ col: 'spawnAreas', ids: [id] });
    setTab('map');
    session.bridge.emit('camera:centerTile', { x: a.x + a.w / 2, y: a.y + a.h / 2 });
  };

  return (
    <div className="tab-page econ-page">
      <div className="tab-list scroll econ-main">
        <div className="stat-tiles">
          <div className="panel stat-tile"><span className="hint">{t('Clans')}</span><b>{clans.length}</b></div>
          <div className="panel stat-tile" title={t('Clan members quit {n}% less often.', { n: Math.round((1 - CLAN_LOYALTY) * 100) })}><span className="hint">{t('Players in clans')}</span><b>{inClans} / {sim.players.length}</b></div>
          <div className="panel stat-tile"><span className="hint">{t('Raids now')}</span><b>{sim.raids.length}</b></div>
          <div className="panel stat-tile"><span className="hint">{t('Boss kills / wipes')}</span><b><span className="good-text">{wins}</span> / <span className="bad-text">{wipes}</span></b></div>
          <div className="panel stat-tile"><span className="hint">{t('Boss lairs')}</span><b>{lairs.length}</b></div>
        </div>

        {lairs.length === 0 && (
          <div className="panel feedback bad">
            <b>{t('No boss lairs yet.')}</b>
            <div className="hint">{t('Clans need something to raid. Open the Map tab → Creatures and place a boss lair that fits your players’ levels.')}</div>
          </div>
        )}

        <div className="panel">
          <div className="panel-header">{t('Clans')}</div>
          {clans.length === 0 ? (
            <div className="hint pad">{t('No clans yet. Sociable players found clans once enough of them reach level 4 and play together.')}</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>{t('Clan')}</th><th>{t('Style')}</th><th>{t('Members')}</th><th>{t('Online')}</th><th>{t('Fame')}</th><th>{t('Raids won / wiped')}</th><th>{t('Drama')}</th></tr></thead>
              <tbody>
                {clans.map((c) => {
                  const online = c.members.filter((id) => session.players.get(id)?.online).length;
                  return (
                    <tr key={c.id} className={c === clan ? 'selected' : ''} onClick={() => setCurrent(c.id)}>
                      <td><span className="clan-dot" style={{ background: c.color }} /> <b>[{c.tag}]</b> {c.name}</td>
                      <td>{t(CLAN_STYLES[c.style].label)}</td>
                      <td>{c.members.length}</td>
                      <td>{online}</td>
                      <td>{c.fame}</td>
                      <td><span className="good-text">{c.raidWins}</span> / <span className="bad-text">{c.raidWipes}</span></td>
                      <td><DramaBar value={c.drama} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">{t('Boss lairs')}</div>
          {lairs.length === 0 ? <div className="hint pad">{t('None yet.')}</div> : (
            <table className="data-table">
              <thead><tr><th>{t('Boss')}</th><th>{t('Level')}</th><th>{t('Raid size')}</th><th>{t('Status')}</th><th>{t('Kills / wipes')}</th><th>{t('World first')}</th></tr></thead>
              <tbody>
                {lairs.map((a) => {
                  const tpl = session.runtime.entities.get('creatureTemplates', a.templateId);
                  const boss = session.clans.bossOf(a.id);
                  const st = session.clans.lairStats(a.id);
                  const raid = sim.raids.find((r) => r.lairId === a.id);
                  const rc = raid && session.clans.get(raid.clanId);
                  const status = raid
                    ? `${rc ? `[${rc.tag}]` : t('Pick-up group')} ${t(raid.phase === 'gathering' ? 'gathering' : 'fighting')} (${raid.members.length})`
                    : boss?.state === 'dead' ? t('dead') : boss?.targetId ? t('in combat') : t('waiting');
                  return (
                    <tr key={a.id} onClick={() => showLair(a.id)} title={t('Show on map')}>
                      <td>{tpl && <SpritePreview frame={`cr:${tpl.type}:0`} box={16} />} {tpl?.name ?? '?'}</td>
                      <td>{tpl?.level}</td>
                      <td>{a.lair!.minRaid}+</td>
                      <td>{status}</td>
                      <td>{st.kills} / {st.wipes}</td>
                      <td>{st.firstKill ? (st.firstKill.clanName || t('A pick-up group')) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">{t('Raid log')}</div>
          <div className="review-list scroll">
            {sim.raidHistory.length === 0 && <div className="hint pad">{t('No raids yet.')}</div>}
            {[...sim.raidHistory].reverse().slice(0, 40).map((r) => (
              <div key={r.id} className="raid-row">
                <span className={RESULT_CLASS[r.result]}>{t(RESULT_LABEL[r.result])}{r.worldFirst ? ' · ' + t('WORLD FIRST') : ''}</span>
                <b>{r.bossName}</b>
                <span>{r.clanName || t('Pick-up group')}</span>
                <span className="hint">{t('{n} players', { n: r.members })}{r.minutes ? ` · ${r.minutes} ${t('min')}` : ''} · {formatGameTime(r.at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel tab-detail scroll">
        {clan ? <ClanDetail session={session} clan={clan} onPlayer={(p) => { setFocus(p.id); setTab('map'); }} /> : (
          <div className="section hint">{t('Clans appear on their own as players make friends. Members get a coloured ring on the map.')}</div>
        )}
      </div>
    </div>
  );
}

function DramaBar({ value }: { value: number }) {
  return <div className="bar" title={`${Math.round(value)}%`}><div className="bar-fill" style={{ width: `${value}%`, background: value > 60 ? '#e2574c' : value > 30 ? '#f2c14e' : '#6cc551' }} /></div>;
}

function ClanDetail({ session, clan, onPlayer }: { session: GameSession; clan: Clan; onPlayer: (p: PlayerState) => void }) {
  const members = clan.members.map((id) => session.players.get(id)).filter((p): p is PlayerState => !!p)
    .sort((a, b) => (b.id === clan.leaderId ? 1 : 0) - (a.id === clan.leaderId ? 1 : 0) || Number(b.online) - Number(a.online) || b.level - a.level);
  const raid = session.runtime.sim.raids.find((r) => r.clanId === clan.id);
  const style = CLAN_STYLES[clan.style];
  const avgMood = members.length ? members.reduce((s, p) => s + p.satisfaction, 0) / members.length : 0;
  const avgLevel = members.length ? members.reduce((s, p) => s + p.level, 0) / members.length : 0;
  const kills = Object.entries(clan.bossKills);
  return (
    <>
      <div className="panel-header"><span><span className="clan-dot" style={{ background: clan.color }} /> [{clan.tag}] {clan.name}</span></div>
      <div className="section">
        <div className="kv"><span>{t('Style')}</span><span>{t(style.label)}</span></div>
        <div className="hint">{t(style.hint)}</div>
        <div className="kv"><span>{t('Leader')}</span><span>{session.players.get(clan.leaderId)?.name ?? '—'}</span></div>
        <div className="kv"><span>{t('Founded')}</span><span>{formatGameTime(clan.foundedAt)}</span></div>
        <div className="kv"><span>{t('Fame')}</span><span>{clan.fame}</span></div>
        <div className="kv"><span>{t('Average level')}</span><span>{avgLevel.toFixed(1)}</span></div>
        <div className="kv"><span>{t('Average mood')}</span><span style={{ color: moodColor(avgMood) }}>{Math.round(avgMood)}%</span></div>
        <div className="kv"><span>{t('Drama')}</span><DramaBar value={clan.drama} /></div>
        {clan.drama > 50 && <div className="hint bad-text">{t('Tension is high. One more wipe or loot fight and the clan may split.')}</div>}
        {raid && (
          <div className="feedback good">
            <b>{t('Raiding now')}</b>
            <div className="hint">{session.runtime.entities.get('spawnAreas', raid.lairId)?.name} · {t(raid.phase === 'gathering' ? 'gathering' : 'fighting')} · {t('attempt {n}', { n: raid.attempt })} · {t('{n} at the rally point', { n: session.clans.present(raid) })}</div>
          </div>
        )}
        {kills.length > 0 && (
          <div>
            <div className="el-title">{t('Bosses defeated')}</div>
            {kills.map(([id, n]) => <div key={id} className="kv"><span>{session.runtime.entities.get('creatureTemplates', id)?.name ?? '?'}</span><span>×{n}</span></div>)}
          </div>
        )}
      </div>
      <div className="panel-header">{t('Members')} ({members.length})</div>
      <div className="section">
        {members.map((p) => (
          <button key={p.id} className="el-row" onClick={() => onPlayer(p)}>
            <SpritePreview frame={`pl:${p.classKey}:0`} box={16} />
            <span className="grow">{p.id === clan.leaderId ? '★ ' : ''}{p.name} <span className="hint">{t('Lv')} {p.level} · {t(getBehavior(p.behavior).name)}</span></span>
            <span className={p.online ? 'good-text' : 'hint'}>{p.online ? t('online') : t('offline')}</span>
            <span style={{ color: moodColor(p.satisfaction) }}>{Math.round(p.satisfaction)}%</span>
          </button>
        ))}
      </div>
    </>
  );
}
