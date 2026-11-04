import { OBJECT_CATEGORIES } from '@/data/objects';
import { MAX_SUBSCRIPTION, MONSTER_SLOT_COST, NPC_HIRE_COST, NPC_UPKEEP_PER_DAY, OBJECT_COST, REFUND_RATE, SERVER_TIERS, SHOP_MODELS } from '@/data/studio';
import type { IncomeSource, ShopModel } from '@/models/sim';
import { t } from '@/i18n';
import type { GameSession } from '@/session/GameSession';
import { toast } from '@/stores/toastStore';
import { log } from '@/stores/logStore';
import { LineChart } from '../rpg/LineChart';
import { useSimTick } from './useSimTick';

export const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function StudioTab({ session }: { session: GameSession }) {
  useSimTick(1000);
  const studio = session.studio;
  const st = session.runtime.studio;
  const online = session.players.online().length;
  const counts = studio.counts();
  const changed = () => { session.runtime.markDirty(); session.runtime.events.emit('studio:changed', undefined); };

  if (!studio.standard) {
    return (
      <div className="tab-page single">
        <div className="panel tab-detail scroll">
          <div className="panel-header">{t('Studio')} · {t('Sandbox')}</div>
          <div className="section form">
            <div>{t('Sandbox mode: building is free and there are no server limits. Players still come and go based on how much they enjoy your world.')}</div>
            <div className="field">
              <label>{t('Max players online (performance)')}: {st.sandboxMaxOnline}</label>
              <input type="range" min={10} max={600} step={10} value={st.sandboxMaxOnline} onChange={(e) => { st.sandboxMaxOnline = +e.target.value; changed(); }} />
              <span className="hint">{t('More players need more CPU. Your computer decides the comfortable limit.')}</span>
            </div>
            <div className="kv"><span>{t('Online')}</span><span>{online}</span></div>
            <div className="kv"><span>{t('Objects')} / {t('NPCs')} / {t('Monster slots')}</span><span>{counts.objects} / {counts.npcs} / {counts.monsters}</span></div>
          </div>
        </div>
      </div>
    );
  }

  const tier = studio.tier();
  const next = SERVER_TIERS[st.serverTier];
  const today = st.ledger[st.ledger.length - 1];
  const est = studio.estimateDaily(session.players.online());
  const incomePerDay = est.subs + est.shop + est.sponsors;
  const SOURCES: { key: IncomeSource; label: string; color: string }[] = [
    { key: 'subs', label: 'Subscriptions', color: '#6cc551' },
    { key: 'shop', label: 'Cash shop', color: '#f2c14e' },
    { key: 'sponsors', label: 'Sponsors', color: '#b56cff' },
  ];
  const costPerDay = tier.upkeepPerDay + counts.npcs * NPC_UPKEEP_PER_DAY;
  const net = st.ledger.map((r) => Math.round(r.income - r.expenses - r.build));
  const upgrade = () => {
    if (studio.upgrade()) {
      const msg = t('Server upgraded to "{name}"', { name: t(studio.tier().name) });
      toast(msg, 'success');
      log.event(msg, 'success', session.runtime.clock.totalMinutes);
    } else toast(t('Not enough money for the upgrade.'), 'error');
  };
  const usage = (n: number, max: number) => (
    <div className="bar"><div className="bar-fill" style={{ width: `${Math.min(100, (n / max) * 100)}%`, background: n / max > 0.9 ? '#e2574c' : '#6cc551' }} /></div>
  );

  return (
    <div className="tab-page econ-page">
      <div className="tab-list scroll econ-main">
        <div className="stat-tiles">
          <div className={`panel stat-tile ${st.funds < 0 ? 'danger' : ''}`}><span className="hint">{t('Studio funds')}</span><b>{money(st.funds)}</b></div>
          <div className="panel stat-tile"><span className="hint">{t('Income per day')}</span><b>{money(incomePerDay)}</b></div>
          <div className="panel stat-tile"><span className="hint">{t('Running costs per day')}</span><b>{money(costPerDay)}</b></div>
          <div className="panel stat-tile"><span className="hint">{t('Today')}</span><b>{today ? money(today.income - today.expenses - today.build) : '—'}</b></div>
        </div>
        {st.daysInDebt > 0 && <div className="panel warn-box">{t('The studio is in debt (day {n}). Building is blocked until funds are positive.', { n: st.daysInDebt })}</div>}
        <div className="panel">
          <div className="panel-header">{t('Where the money comes from')}</div>
          <div className="section">
            <table className="data-table compact-table">
              <thead><tr><th>{t('Source')}</th><th>{t('Expected per day')}</th><th>{t('Today')}</th></tr></thead>
              <tbody>
                {SOURCES.map((x) => (
                  <tr key={x.key}><td><span className="clan-dot" style={{ background: x.color }} /> {t(x.label)}</td><td>{money(est[x.key])}</td><td>{money(today?.sources?.[x.key] ?? 0)}</td></tr>
                ))}
                <tr><td>{t('Running costs')}</td><td className="bad-text">−{money(costPerDay)}</td><td className="bad-text">−{money(today?.expenses ?? 0)}</td></tr>
              </tbody>
            </table>
            <div className="hint">{t('Subscriptions are paid every game day by every active player (online or not). More happy players = more money.')}</div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">{t('Daily result (income, costs and building)')}</div>
          <div className="section"><LineChart series={[{ label: '$', values: net, color: '#6cc551' }]} xLabels={[t('older'), t('now')]} empty={t('Run the simulation for a day to see results.')} /></div>
        </div>
        <div className="panel">
          <div className="panel-header">{t('Servers')}</div>
          <div className="section">
            <table className="data-table compact-table">
              <thead><tr><th>{t('Tier')}</th><th>{t('Players')}</th><th>{t('NPCs')}</th><th>{t('Monsters')}</th><th>{t('Objects')}</th><th>{t('Upkeep/day')}</th><th>{t('Price')}</th></tr></thead>
              <tbody>
                {SERVER_TIERS.map((s) => (
                  <tr key={s.tier} className={s.tier === st.serverTier ? 'active' : ''}>
                    <td>{s.tier}. {t(s.name)}</td><td>{s.maxOnline}</td><td>{s.maxNpcs}</td><td>{s.maxMonsters}</td><td>{s.maxObjects}</td><td>{money(s.upkeepPerDay)}</td>
                    <td>{s.tier <= st.serverTier ? '✓' : money(s.upgradeCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {next && <button className="btn primary" disabled={st.funds < next.upgradeCost} onClick={upgrade}>{t('Upgrade to "{name}" for {cost}', { name: t(next.name), cost: money(next.upgradeCost) })}</button>}
          </div>
        </div>
      </div>
      <div className="panel tab-detail scroll">
        <div className="panel-header">{t('Studio')} · {t(tier.name)}</div>
        <div className="section form">
          <div className="el-title">{t('Server load')}</div>
          <div className="kv"><span>{t('Players online')}</span><span>{online} / {tier.maxOnline}</span></div>{usage(online, tier.maxOnline)}
          <div className="kv"><span>{t('NPCs')}</span><span>{counts.npcs} / {tier.maxNpcs}</span></div>{usage(counts.npcs, tier.maxNpcs)}
          <div className="kv"><span>{t('Monster slots')}</span><span>{counts.monsters} / {tier.maxMonsters}</span></div>{usage(counts.monsters, tier.maxMonsters)}
          <div className="kv"><span>{t('Objects')}</span><span>{counts.objects} / {tier.maxObjects}</span></div>{usage(counts.objects, tier.maxObjects)}
          <div className="field">
            <label>{t('Subscription')}: {money(st.subscriptionPrice)} {t('per player per day')}</label>
            <input type="range" min={0} max={MAX_SUBSCRIPTION} step={1} value={st.subscriptionPrice} onChange={(e) => { st.subscriptionPrice = +e.target.value; changed(); }} />
            <span className="hint">{t('Higher price = more income per player, but fewer newcomers. ~$3 is the comfortable price; $0 = free-to-play.')}</span>
          </div>
          <div className="field">
            <label>{t('Cash shop')}</label>
            {(Object.keys(SHOP_MODELS) as ShopModel[]).map((k) => (
              <button key={k} className={`anticheat ${st.shopModel === k ? 'active' : ''}`} onClick={() => { st.shopModel = k; changed(); }}>
                <b>{t(SHOP_MODELS[k].label)}</b>
                <span className="hint">{t(SHOP_MODELS[k].hint)}</span>
              </button>
            ))}
          </div>
          <div className="el-title">{t('Build prices')}</div>
          {OBJECT_CATEGORIES.map((c) => <div key={c.key} className="kv"><span>{t(c.label)}</span><span>{money(OBJECT_COST[c.key])}</span></div>)}
          <div className="kv"><span>{t('Player spawn')}</span><span>{money(OBJECT_COST.spawns)}</span></div>
          <div className="kv"><span>{t('Hire an NPC')}</span><span>{money(NPC_HIRE_COST)} + {money(NPC_UPKEEP_PER_DAY)}/{t('day')}</span></div>
          <div className="kv"><span>{t('Monster slot')}</span><span>{money(MONSTER_SLOT_COST)}</span></div>
          <div className="hint">{t('Removing things refunds {p}% (Undo refunds everything). Terrain painting is free.', { p: Math.round(REFUND_RATE * 100) })}</div>
        </div>
      </div>
    </div>
  );
}
