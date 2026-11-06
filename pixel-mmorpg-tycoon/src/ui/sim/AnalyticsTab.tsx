import { ROOM_RENT_PER_DAY } from '@/data/furniture';
import { getObjectDef } from '@/data/objects';
import { useState } from 'react';
import { BEHAVIORS } from '@/data/playerTypes';
import { t } from '@/i18n';
import type { HistorySample } from '@/models/events';
import type { GameSession } from '@/session/GameSession';
import { ACTIVITY_LABEL, type Activity } from '@/simulation/players/PlayerBrain';
import { ItemIcon } from '../rpg/ItemIcon';
import { LineChart } from '../rpg/LineChart';
import { useSimTick } from './useSimTick';

type Range = 24 | 72 | 168;

interface Bar { label: string; value: number; color?: string; icon?: React.ReactNode; suffix?: string }

/** Horizontal bar list, scaled to the largest value. */
export function BarList({ bars, empty }: { bars: Bar[]; empty: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  if (!bars.length) return <div className="hint">{empty}</div>;
  return (
    <div className="bar-list">
      {bars.map((b) => (
        <div key={b.label} className="bl-row">
          {b.icon}
          <span className="bl-label" title={b.label}>{b.label}</span>
          <div className="bar"><div className="bar-fill" style={{ width: `${(b.value / max) * 100}%`, background: b.color ?? '#7fd7ff' }} /></div>
          <span className="bl-val">{b.value.toLocaleString()}{b.suffix ?? ''}</span>
        </div>
      ))}
    </div>
  );
}

const series = (h: HistorySample[], key: keyof HistorySample, scale = 1) => h.map((s) => Math.round((s[key] as number) * scale * 10) / 10);

export function AnalyticsTab({ session }: { session: GameSession }) {
  useSimTick(1000);
  const [range, setRange] = useState<Range>(24);
  const sim = session.runtime.sim;
  const store = session.runtime.entities;
  const h = sim.history.slice(-range);
  const online = session.players.online();
  const all = sim.players;
  const avgLevel = online.length ? online.reduce((n, p) => n + p.level, 0) / online.length : 0;
  const eco = session.runtime.rpg.economy;
  const cur = eco.currencyName;
  const labels: [string, string] = [t('{n} h ago', { n: h.length }), t('now')];
  const empty = t('Data appears after the first game hour of simulation.');

  // Distributions
  const levelBands = [[1, 2], [3, 4], [5, 7], [8, 10], [11, 15], [16, 25], [26, 200]];
  const levels: Bar[] = levelBands.map(([lo, hi]) => ({ label: hi >= 200 ? `${lo}+` : `${lo}–${hi}`, value: all.filter((p) => p.level >= lo && p.level <= hi).length, color: '#f2c14e' })).filter((b, i) => b.value || i < 4);
  const classes: Bar[] = session.runtime.rpg.progression.classes.map((c) => ({ label: c.name, value: all.filter((p) => p.classKey === c.key).length, color: '#b56cff' }));
  const behaviors: Bar[] = BEHAVIORS.map((b) => ({ label: t(b.name), value: all.filter((p) => p.behavior === b.key).length, color: '#6cc551' }));
  const actCounts = new Map<Activity['kind'] | 'dead', number>();
  for (const p of online) {
    const a = session.actors.actors.get(p.id);
    const k = a?.state === 'dead' ? 'dead' : session.playerSystem.activityOf(p.id)?.kind ?? 'idle';
    actCounts.set(k, (actCounts.get(k) ?? 0) + 1);
  }
  const activity: Bar[] = [...actCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k === 'dead' ? t('dead') : t(ACTIVITY_LABEL[k]), value: v, color: '#7fd7ff' }));

  // Top lists
  const locations: Bar[] = Object.entries(sim.regionVisits)
    .map(([id, v]) => ({ label: store.get('regions', id)?.name ?? '?', value: v, color: '#ff9a8a', suffix: ` ${t('h')}` }))
    .filter((b) => b.label !== '?').sort((a, b) => b.value - a.value).slice(0, 8);
  const owned = new Map<string, number>();
  for (const p of all) {
    for (const s of p.inventory) owned.set(s.itemId, (owned.get(s.itemId) ?? 0) + s.qty);
    for (const id of Object.values(p.equipment)) if (id) owned.set(id, (owned.get(id) ?? 0) + 1);
  }
  for (const [id, v] of session.economy.itemVolume) owned.set(id, (owned.get(id) ?? 0) + v);
  const items: Bar[] = [...owned.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, v]) => {
    const it = store.get('items', id);
    return { label: it?.name ?? '?', value: v, icon: <ItemIcon item={it} size={14} />, color: '#6cc551' };
  });
  const merchants: Bar[] = [...session.economy.merchantRevenue.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([id, v]) => ({ label: store.get('npcs', id)?.name ?? t('(gone)'), value: v, color: '#f2c14e', suffix: ` ${cur}` }));

  const tiles: [string, string, string?][] = [
    [t('Total players'), all.length.toLocaleString(), t('Everyone who still plays (online or offline).')],
    [t('Active players'), `${online.length}`, t('Online right now')],
    [t('Average level'), avgLevel ? avgLevel.toFixed(1) : '—'],
    [t('Monster kills'), sim.totals.kills.toLocaleString()],
    [t('Total deaths'), sim.totals.deaths.toLocaleString()],
    [t('Completed quests'), sim.totals.quests.toLocaleString()],
    [t('Economy balance'), `${session.economy.moneySupply().toLocaleString()} ${cur}`, t('All coins in the world (players, NPCs and treasury).')],
    [t('Level-ups'), sim.totals.levelUps.toLocaleString()],
  ];

  return (
    <div className="tab-page single wide">
      <div className="tab-list scroll econ-main">
        <div className="row analytics-head">
          <h2 className="pixel-title">{t('Analytics')}</h2>
          <div className="grow" />
          {([24, 72, 168] as Range[]).map((r) => (
            <button key={r} className={`btn small ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>{r === 24 ? t('24 h') : r === 72 ? t('3 days') : t('7 days')}</button>
          ))}
        </div>
        <div className="stat-tiles">
          {tiles.map(([l, v, hint]) => <div key={l} className="panel stat-tile" title={hint}><span className="hint">{l}</span><b>{v}</b></div>)}
        </div>
        <div className="chart-grid">
          <div className="panel"><div className="panel-header">{t('Players online')}</div><div className="section"><LineChart series={[{ label: t('Online'), values: series(h, 'online'), color: '#7fd7ff' }]} xLabels={labels} empty={empty} /></div></div>
          <div className="panel"><div className="panel-header">{t('Popularity & rating')}</div><div className="section">
            <LineChart series={[{ label: t('Popularity'), values: series(h, 'popularity'), color: '#f2c14e' }, { label: t('Rating ×20'), values: series(h, 'rating', 20), color: '#b56cff' }]} xLabels={labels} empty={empty} />
          </div></div>
          <div className="panel"><div className="panel-header">{t('Satisfaction & level')}</div><div className="section">
            <LineChart series={[{ label: t('Avg. satisfaction'), values: series(h, 'satisfaction'), color: '#6cc551' }, { label: t('Average level ×10'), values: series(h, 'avgLevel', 10), color: '#ff9a8a' }]} xLabels={labels} empty={empty} />
          </div></div>
          <div className="panel"><div className="panel-header">{t('Player activity per hour')}</div><div className="section">
            <LineChart series={[{ label: t('Monster kills'), values: series(h, 'kills'), color: '#6cc551' }, { label: t('Deaths'), values: series(h, 'deaths'), color: '#e2574c' }, { label: t('Quests'), values: series(h, 'quests'), color: '#7fd7ff' }]} xLabels={labels} empty={empty} />
          </div></div>
          <div className="panel"><div className="panel-header">{t('Joins & quits per hour')}</div><div className="section">
            <LineChart series={[{ label: t('Joined'), values: series(h, 'joins'), color: '#6cc551' }, { label: t('Quit for good'), values: series(h, 'quits'), color: '#e2574c' }]} xLabels={labels} empty={empty} />
          </div></div>
          <div className="panel"><div className="panel-header">{t('Economy')}</div><div className="section">
            <LineChart series={[{ label: t('Money supply'), values: series(h, 'moneySupply'), color: '#f2c14e' }, { label: t('Treasury'), values: series(h, 'treasury'), color: '#b0832a' }]} xLabels={labels} empty={empty} />
          </div></div>
          {session.studio.standard && (
            <div className="panel"><div className="panel-header">{t('Studio funds')}</div><div className="section">
              <LineChart series={[{ label: '$', values: series(h, 'funds'), color: '#6cc551' }]} xLabels={labels} empty={empty} />
            </div></div>
          )}
          <div className="panel"><div className="panel-header">{t('Trade volume per game hour')}</div><div className="section">
            <LineChart series={[{ label: t('Volume'), values: series(h, 'tradeVolume'), color: '#6cc551' }]} xLabels={labels} empty={empty} />
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="panel"><div className="panel-header">{t('Player activity now')}</div><div className="section"><BarList bars={activity} empty={t('Nobody online.')} /></div></div>
          <HousingPanel session={session} />
          <div className="panel"><div className="panel-header">{t('Most popular locations')}</div><div className="section"><BarList bars={locations} empty={t('No region visits yet. Draw regions so players can be tracked.')} /></div></div>
          <div className="panel"><div className="panel-header">{t('Most popular items')}</div><div className="section"><BarList bars={items} empty={t('No items owned or traded yet.')} /></div></div>
          <div className="panel"><div className="panel-header">{t('Most profitable merchants')}</div><div className="section"><BarList bars={merchants} empty={t('No sales yet.')} /></div></div>
          <div className="panel"><div className="panel-header">{t('Players by level')}</div><div className="section"><BarList bars={levels} empty={t('No players yet.')} /></div></div>
          <div className="panel"><div className="panel-header">{t('Players by class')}</div><div className="section"><BarList bars={classes} empty={t('No players yet.')} /></div></div>
          <div className="panel"><div className="panel-header">{t('Players by play style')}</div><div className="section"><BarList bars={behaviors} empty={t('No players yet.')} /></div></div>
        </div>
      </div>
    </div>
  );
}

/** Rooms in hotels and taverns: occupancy, rent and residents. */
function HousingPanel({ session }: { session: GameSession }) {
  const rooms = session.players.rooms();
  const byBuilding = new Map<string, { name: string; total: number; taken: number }>();
  for (const r of rooms) {
    const key = r.building.id;
    const row = byBuilding.get(key) ?? { name: r.building.name ?? t(getObjectDef(r.building.kind)?.name ?? r.building.kind), total: 0, taken: 0 };
    row.total++;
    if (r.bed.ownerId && session.players.get(r.bed.ownerId)) row.taken++;
    byBuilding.set(key, row);
  }
  const taken = [...byBuilding.values()].reduce((n, b) => n + b.taken, 0);
  const tenants = session.runtime.sim.players.filter((p) => p.home);
  const cur = session.runtime.rpg.economy.currencyName;
  return (
    <div className="panel">
      <div className="panel-header">{t('Housing')}</div>
      <div className="section">
        {rooms.length === 0 ? <div className="hint">{t('No rooms yet. Build a Hotel (or a Tavern with beds): every bed is a room players can rent.')}</div> : <>
          <div className="kv"><span>{t('Rooms rented')}</span><span>{taken} / {rooms.length} ({Math.round((taken / rooms.length) * 100)}%)</span></div>
          <div className="kv"><span>{t('Rent per day')}</span><span>{taken * ROOM_RENT_PER_DAY} {cur}</span></div>
          <div className="kv"><span>{t('Rent paid so far')}</span><span>{session.runtime.sim.rentPaid ?? 0} {cur}</span></div>
          {[...byBuilding.values()].map((b, i) => <div key={i} className="kv hint"><span>{b.name}</span><span>{b.taken} / {b.total}</span></div>)}
          {tenants.length > 0 && <div className="hint">{t('Tenants')}: {tenants.slice(0, 12).map((p) => p.name).join(', ')}{tenants.length > 12 ? '…' : ''}</div>}
        </>}
      </div>
    </div>
  );
}
