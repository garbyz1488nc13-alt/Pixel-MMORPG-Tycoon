import { accusations, cheatLabel } from '@/data/community';
import { FACTORS, getBehavior } from '@/data/playerTypes';
import { EQUIP_SLOTS } from '@/data/rpgDefaults';
import { t } from '@/i18n';
import type { FactorKey, PlayerState } from '@/models/sim';
import type { GameSession } from '@/session/GameSession';
import { ACTIVITY_LABEL } from '@/simulation/players/PlayerBrain';
import { xpToNext } from '@/systems/rpg/progression';
import { useEditorStore } from '@/stores/editorStore';
import { ItemIcon } from '../rpg/ItemIcon';
import { SpritePreview } from '../components/SpritePreview';
import { banPlayer } from './CommunityTab';

export function moodColor(s: number): string {
  return s >= 65 ? '#6cc551' : s >= 40 ? '#f2c14e' : '#e2574c';
}

/** Everything about one simulated player. */
export function PlayerDetail({ session, player, compact = false }: { session: GameSession; player: PlayerState; compact?: boolean }) {
  const pm = session.players;
  const actor = session.actors.actors.get(player.id);
  const stats = pm.stats(player);
  const act = session.playerSystem.activityOf(player.id);
  const follow = useEditorStore((s) => s.followPlayer && s.focusPlayer === player.id);
  const setFocus = useEditorStore((s) => s.setFocusPlayer);
  const setFollow = useEditorStore((s) => s.setFollowPlayer);
  const setTab = useEditorStore((s) => s.setTab);
  const items = session.runtime.entities;
  const factors = (Object.entries(player.factors) as [FactorKey, number][]).filter(([, v]) => Math.abs(v) >= 0.5).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, compact ? 4 : 8);
  const need = xpToNext(player.level, session.runtime.rpg.progression);

  return (
    <div className="form player-detail">
      <div className="row">
        <SpritePreview frame={`pl:${player.classKey}:0`} box={40} />
        <div className="grow">
          <div className="inspect-title">{player.name}</div>
          <div className="hint">{t(pm.classDef(player).name)} · {t('Lv')} {player.level} · {t(getBehavior(player.behavior).name)}</div>
          <div className="hint">{player.online ? (actor?.state === 'dead' ? t('dead') : act ? t(ACTIVITY_LABEL[act.kind]) : t('Idle')) : t('Offline')}</div>
          {player.titles?.map((ti) => { const [name, season] = ti.split(' · '); return <div key={ti} className="good-text">★ {t(name)} · {season}</div>; })}
          {player.streamer && <div><span className="badge live">LIVE</span> <span className="hint">{t('{n} viewers', { n: player.streamer.viewers.toLocaleString() })}</span></div>}
        </div>
      </div>
      <div className="mood-bar" title={t('Satisfaction')}>
        <div style={{ width: `${player.satisfaction}%`, background: moodColor(player.satisfaction) }} />
        <span>{t('Satisfaction')}: {Math.round(player.satisfaction)}%</span>
      </div>
      <div className="kv"><span>{t('XP')}</span><span>{player.xp} / {need || '—'}</span></div>
      <div className="kv"><span>{t('HP')}</span><span>{actor ? `${actor.hp}/${actor.maxHp}` : stats.maxHp}</span></div>
      <div className="kv"><span>{t('Attack')} / {t('Defense')}</span><span>{stats.attack} / {stats.defense}</span></div>
      <div className="kv"><span>{session.runtime.rpg.economy.currencyName}</span><span>{player.gold}{player.bank ? ` + ${player.bank} ${t('in the bank')}` : ''}</span></div>
      {session.players.hasTrainers() && <div className="kv"><span>{t('Skills learned up to level')}</span><span className={session.players.skillLevel(player) < player.level ? 'bad-text' : ''}>{session.players.skillLevel(player)}</span></div>}
      <div className="kv"><span>{t('Kills / deaths')}</span><span>{player.stats.kills} / {player.stats.deaths}</span></div>
      <div className="kv"><span>{t('Quests done')}</span><span>{player.stats.questsDone}</span></div>
      <div className="kv"><span>{t('Played')}</span><span>{Math.round(player.playMinutes / 60)} {t('h')}</span></div>
      <div className="kv"><span>{t('Reports')}</span><span className={player.reports > 2 ? 'bad-text' : ''}>{player.reports}</span></div>
      {accusations(player).length > 0 && <div className="kv"><span>{t('Accused of')}</span><span className="hint">{accusations(player).map((x) => `${t(cheatLabel(x.kind))} ×${x.n}`).join(', ')}</span></div>}
      <div className="kv"><span>{t('Suspicion')}</span><span>{session.community.suspicion(player)}%</span></div>
      <div className="chip-row">
        <button className="btn small danger" onClick={() => banPlayer(session, player)}>{t('Ban')}</button>
      </div>
      {player.online && actor && (
        <div className="chip-row">
          <button className="btn small" onClick={() => { setTab('map'); session.bridge.emit('camera:centerTile', { x: actor.x, y: actor.y }); setFocus(player.id); }}>{t('Show on map')}</button>
          <button className={`btn small ${follow ? 'active' : ''}`} onClick={() => { setFocus(player.id); setFollow(!follow); if (!follow) setTab('map'); }}>{t('Follow camera')}</button>
        </div>
      )}
      <div className="el-title">{t('Thoughts')}</div>
      {factors.length === 0 && <div className="hint">{t('No strong feelings yet.')}</div>}
      {factors.map(([k, v]) => (
        <div key={k} className={`thought ${v > 0 ? 'good' : 'bad'}`}>{v > 0 ? '+' : '−'} {t(FACTORS[k].label)} <span className="hint">{v > 0 ? '+' : ''}{Math.round(v)}</span></div>
      ))}
      {!compact && (
        <>
          <div className="el-title">{t('Equipment')}</div>
          <div className="gear-list">
            {EQUIP_SLOTS.filter((s) => s.key !== 'none').map((s) => {
              const id = player.equipment[s.key];
              const it = id ? items.get('items', id) : undefined;
              return <div key={s.key} className="gear-row"><ItemIcon item={it} size={18} /><span className="hint">{t(s.label)}:</span> {it?.name ?? '—'}</div>;
            })}
          </div>
          <div className="el-title">{t('Inventory')}</div>
          <div className="inv-grid">
            {player.inventory.length === 0 && <div className="hint">{t('Empty inventory.')}</div>}
            {player.inventory.map((s, i) => {
              const it = items.get('items', s.itemId);
              return <div key={i} className="inv-cell" title={it?.name}><ItemIcon item={it} size={22} />{s.qty > 1 && <b>{s.qty}</b>}</div>;
            })}
          </div>
          <div className="el-title">{t('Quests')}</div>
          {player.quests.length === 0 && <div className="hint">{t('No active quests.')}</div>}
          {player.quests.map((pq) => {
            const q = items.get('quests', pq.questId);
            if (!q) return null;
            return (
              <div key={pq.questId} className="quest-row">
                <b>{q.name}</b> {pq.status === 'complete' && <span className="badge gold">{t('Done')}</span>}
                <div className="hint">{q.objectives.map((o, i) => `${pq.counts[i] ?? 0}/${o.count}`).join(' · ')}</div>
              </div>
            );
          })}
          <div className="hint">{t('Completed quests')}: {player.completedQuests.length}</div>
        </>
      )}
    </div>
  );
}
