import { useState } from 'react';
import type { EntityId } from '@/core/ids';
import { RARITIES } from '@/data/rpgDefaults';
import { t } from '@/i18n';
import type { EconomyConfig } from '@/models/rpg';
import type { GameSession } from '@/session/GameSession';
import { formatGameTime } from '@/simulation/time';
import { buyPrice, sellPrice } from '@/systems/rpg/pricing';
import { Field, NumberInput, TextInput } from '../components/Fields';
import { ItemIcon } from './ItemIcon';
import { LineChart } from './LineChart';
import { useRpg } from './useRpg';

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function EconomyTab({ session }: { session: GameSession }) {
  const rpg = useRpg(session, 1000);
  const eco = rpg.economy;
  const econ = session.economy;
  const store = session.runtime.entities;
  const merchants = econ.merchants();
  const tracked = [...econ.priceHistory.keys()];
  const [priceItem, setPriceItem] = useState<EntityId | null>(null);
  const shownItem = priceItem && econ.priceHistory.has(priceItem) ? priceItem : tracked[0] ?? null;

  const set = <K extends keyof EconomyConfig>(key: K, value: EconomyConfig[K], label = t('Edit economy')) =>
    session.updateRpg(label, (r) => { r.economy[key] = value; }, `eco:${key}`);
  const cur = eco.currencyName;

  const tiles: [string, string, string?][] = [
    [t('Treasury'), `${Math.round(eco.treasury).toLocaleString()} ${cur}`, t('Receives taxes from every trade.')],
    [t('Money supply'), `${econ.moneySupply().toLocaleString()} ${cur}`, t('All coins carried by NPCs plus the treasury.')],
    [t('Trade volume'), `${econ.totals.volume.toLocaleString()} ${cur}`, t('Total value of sales and purchases this session.')],
    [t('Taxes collected'), `${econ.totals.taxes.toLocaleString()} ${cur}`],
    [t('Trades'), econ.totals.count.toLocaleString()],
    [t('Spent on restocking'), `${econ.totals.sinks.toLocaleString()} ${cur}`, t('Coins merchants paid to outside suppliers (leaves the world).')],
  ];

  return (
    <div className="tab-page econ-page">
      <div className="tab-list scroll econ-main">
        <div className="stat-tiles">
          {tiles.map(([label, value, hint]) => (
            <div key={label} className="panel stat-tile" title={hint}><span className="hint">{label}</span><b>{value}</b></div>
          ))}
        </div>
        <div className="chart-row">
          <div className="panel"><div className="panel-header">{t('Treasury per game hour')}</div><div className="section">
            <LineChart series={[{ label: t('Treasury'), values: econ.treasuryHistory, color: '#f2c14e' }]} xLabels={[t('older'), t('now')]} empty={t('Run the simulation to collect hourly data.')} />
          </div></div>
          <div className="panel"><div className="panel-header">{t('Trade volume per game hour')}</div><div className="section">
            <LineChart series={[{ label: t('Volume'), values: econ.volumeHistory, color: '#6cc551' }]} xLabels={[t('older'), t('now')]} empty={t('Run the simulation to collect hourly data.')} />
          </div></div>
        </div>
        <div className="panel">
          <div className="panel-header">{t('Price history')}
            <select className="input slot-select" value={shownItem ?? ''} onChange={(e) => setPriceItem(e.target.value)}>
              {tracked.map((id) => <option key={id} value={id}>{store.get('items', id)?.name ?? '?'}</option>)}
            </select>
          </div>
          <div className="section">
            <LineChart series={shownItem ? [{ label: store.get('items', shownItem)?.name ?? '', values: econ.priceHistory.get(shownItem) ?? [], color: '#7fd7ff' }] : []} xLabels={[t('older'), t('now')]} empty={t('Prices are sampled every game hour while the simulation runs.')} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">{t('Merchants')} ({merchants.length})</div>
          <div className="table-scroll scroll" style={{ maxHeight: 220 }}>
            <table className="data-table">
              <thead><tr><th>{t('Name')}</th><th>{cur}</th><th>{t('Revenue')}</th><th>{t('Goods')}</th><th>{t('Stock filled')}</th></tr></thead>
              <tbody>
                {[...merchants].sort((a, b) => (econ.merchantRevenue.get(b.id) ?? 0) - (econ.merchantRevenue.get(a.id) ?? 0)).map((m) => {
                  const fill = m.shop.items.length ? m.shop.items.reduce((n, s) => n + Math.min(1, s.stock / Math.max(1, s.maxStock)), 0) / m.shop.items.length : 0;
                  return (
                    <tr key={m.id}><td>{m.name}</td><td>{m.gold}</td><td>{econ.merchantRevenue.get(m.id) ?? 0}</td><td>{m.shop.items.length}</td>
                      <td><div className="bar"><div className="bar-fill" style={{ width: pct(fill), background: fill < 0.3 ? '#e2574c' : '#6cc551' }} /></div></td></tr>
                  );
                })}
              </tbody>
            </table>
            {merchants.length === 0 && <div className="hint pad">{t('No merchants yet. Enable "Sells items" on an NPC.')}</div>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">{t('Current prices')}</div>
          <div className="table-scroll scroll" style={{ maxHeight: 240 }}>
            <table className="data-table">
              <thead><tr><th /><th>{t('Item')}</th><th>{t('Value')}</th><th>{t('Shop price')}</th><th>{t('Buyback')}</th><th>{t('Stock')}</th><th>{t('Sold')}</th></tr></thead>
              <tbody>
                {tracked.length === 0 && merchants.flatMap((m) => m.shop.items).length === 0 && <tr><td colSpan={7} className="hint">{t('Nothing is for sale.')}</td></tr>}
                {[...new Set(merchants.flatMap((m) => m.shop.items.map((s) => s.itemId)))].map((id) => {
                  const it = store.get('items', id);
                  if (!it) return null;
                  const entries = merchants.flatMap((m) => m.shop.items.filter((s) => s.itemId === id));
                  const stock = entries.reduce((n, s) => n + s.stock, 0);
                  const max = entries.reduce((n, s) => n + s.maxStock, 0);
                  const agg = { itemId: id, stock, maxStock: max };
                  return (
                    <tr key={id} onClick={() => setPriceItem(id)} className={shownItem === id ? 'active' : ''}>
                      <td><ItemIcon item={it} size={16} /></td><td>{it.name}</td><td>{it.value}</td>
                      <td>{sellPrice(it, agg, eco)}</td><td>{buyPrice(it, agg, eco)}</td><td>{stock}/{max}</td><td>{econ.itemVolume.get(id) ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">{t('Recent trades')}</div>
          <div className="trade-list scroll">
            {econ.trades.length === 0 && <div className="hint pad">{t('No trades yet. Press Play — farmers sell wheat, guards sell loot, villagers buy food.')}</div>}
            {[...econ.trades].reverse().slice(0, 40).map((tr, i) => {
              const it = store.get('items', tr.itemId);
              const who = tr.actorId ? store.get('npcs', tr.actorId)?.name : null;
              const m = tr.merchantId ? store.get('npcs', tr.merchantId)?.name : null;
              return (
                <div key={i} className={`trade-row ${tr.kind}`}>
                  <span className="log-time">{formatGameTime(tr.at)}</span>
                  <span className="trade-kind">{t(tr.kind)}</span>
                  <ItemIcon item={it} size={14} />
                  <span className="grow">{tr.qty}× {it?.name ?? '?'} {who ? `· ${who}` : ''} {m ? `→ ${m}` : ''}</span>
                  <span>{tr.total ? `${tr.total} ${cur}` : ''}{tr.tax ? ` (${t('tax')} ${tr.tax})` : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="panel tab-detail scroll">
        <div className="panel-header">{t('Economy rules')}</div>
        <div className="section form">
          <Field label={t('Currency name')}><TextInput value={eco.currencyName} maxLength={20} onChange={(v) => set('currencyName', v)} /></Field>
          <Field label={t('Treasury')}><NumberInput value={Math.round(eco.treasury)} min={0} max={1e10} onChange={(v) => set('treasury', v)} /></Field>
          <Field label={`${t('Merchant markup')}: ${pct(eco.sellMarkup)}`} hint={t('Shops sell at value × (1 + markup).')}>
            <input type="range" min={0} max={2} step={0.05} value={eco.sellMarkup} onChange={(e) => set('sellMarkup', +e.target.value)} />
          </Field>
          <Field label={`${t('Buyback rate')}: ${pct(eco.buybackRate)}`} hint={t('Shops buy items at value × rate.')}>
            <input type="range" min={0} max={1} step={0.05} value={eco.buybackRate} onChange={(e) => set('buybackRate', +e.target.value)} />
          </Field>
          <Field label={`${t('Tax rate')}: ${pct(eco.taxRate)}`} hint={t('Share of each trade paid to the treasury.')}>
            <input type="range" min={0} max={0.5} step={0.01} value={eco.taxRate} onChange={(e) => set('taxRate', +e.target.value)} />
          </Field>
          <Field label={`${t('Supply & demand strength')}: ${pct(eco.demandElasticity)}`} hint={t('How much prices rise when stock runs low (and fall on a surplus).')}>
            <input type="range" min={0} max={1.5} step={0.05} value={eco.demandElasticity} onChange={(e) => set('demandElasticity', +e.target.value)} />
          </Field>
          <div className="two-col">
            <Field label={t('Min price ×')}><NumberInput value={eco.priceFloor} min={0.1} max={1} step={0.05} onChange={(v) => set('priceFloor', v)} /></Field>
            <Field label={t('Max price ×')}><NumberInput value={eco.priceCeiling} min={1} max={10} step={0.1} onChange={(v) => set('priceCeiling', v)} /></Field>
          </div>
          <Field label={`${t('Restock speed')}: ${pct(eco.restockPerHour)} ${t('per hour')}`} hint={t('Share of missing stock merchants buy from suppliers each game hour.')}>
            <input type="range" min={0} max={1} step={0.02} value={eco.restockPerHour} onChange={(e) => set('restockPerHour', +e.target.value)} />
          </Field>
          <Field label={t('Rarity value multipliers')}>
            <div className="stat-grid">
              {RARITIES.map((r) => (
                <label key={r.key} className="stat-cell"><span style={{ color: r.color }}>{t(r.label)}</span>
                  <NumberInput value={eco.rarityMultipliers[r.key]} min={0.1} max={50} step={0.1} onChange={(v) => session.updateRpg(t('Edit economy'), (x) => { x.economy.rarityMultipliers[r.key] = v; }, `eco:rar:${r.key}`)} />
                </label>
              ))}
            </div>
          </Field>
          <div className="hint">{t('Quest rewards are set per quest; monster loot per creature; item values in the Items tab.')}</div>
        </div>
      </div>
    </div>
  );
}
