import { RARITIES } from '@/data/rpgDefaults';
import { t } from '@/i18n';
import type { GameSession } from '@/session/GameSession';
import { MAX_FEE_PCT } from '@/simulation/liveops/AuctionService';
import { formatGameTime } from '@/simulation/time';
import { ItemIcon } from '../rpg/ItemIcon';
import { useSimTick } from './useSimTick';

const rarityColor = (r: string) => RARITIES.find((x) => x.key === r)?.color ?? '#ccc';

/** Player auction house for loot that only drops from monsters. */
export function AuctionTab({ session }: { session: GameSession }) {
  useSimTick(1000);
  const a = session.runtime.sim.auction;
  const cur = session.runtime.rpg.economy.currencyName;
  const market = session.auction.market();
  const items = session.runtime.entities;
  const lots = [...a.listings].sort((x, y) => y.listedAt - x.listedAt).slice(0, 60);
  const setFee = (v: number) => { a.feePct = v; session.runtime.markDirty(); };

  return (
    <div className="tab-page econ-page">
      <div className="tab-list scroll econ-main">
        <div className="stat-tiles">
          <div className="panel stat-tile"><span className="hint">{t('Lots for sale')}</span><b>{a.listings.length}</b></div>
          <div className="panel stat-tile"><span className="hint">{t('Trade volume')}</span><b>{a.volume.toLocaleString()} {cur}</b></div>
          <div className="panel stat-tile"><span className="hint">{t('Fees to treasury')}</span><b>{a.fees.toLocaleString()} {cur}</b></div>
          <div className="panel stat-tile"><span className="hint">{t('Drop-only items')}</span><b>{market.length}</b></div>
        </div>
        <div className="panel">
          <div className="panel-header">{t('Market prices')}</div>
          {market.length === 0 ? <div className="hint pad">{t('No drop-only loot yet. Items that monsters drop and no shop sells are traded here.')}</div> : (
            <table className="data-table">
              <thead><tr><th>{t('Item')}</th><th>{t('Base value')}</th><th>{t('Market price')}</th><th>{t('Cheapest lot')}</th><th>{t('Listed')}</th><th>{t('Sold recently')}</th></tr></thead>
              <tbody>
                {market.map((m) => (
                  <tr key={m.item.id}>
                    <td><ItemIcon item={m.item} size={16} /> <span style={{ color: rarityColor(m.item.rarity) }}>{m.item.name}</span></td>
                    <td>{m.item.value}</td>
                    <td className={m.price > m.item.value * 1.5 ? 'good-text' : m.price < m.item.value ? 'bad-text' : ''}>{m.price}</td>
                    <td>{m.cheapest ?? '—'}</td>
                    <td>{m.listed}</td>
                    <td>{m.sold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="panel">
          <div className="panel-header">{t('Recent sales')}</div>
          <div className="review-list scroll">
            {a.sales.length === 0 && <div className="hint pad">{t('No sales yet.')}</div>}
            {[...a.sales].reverse().slice(0, 40).map((s, i) => (
              <div key={i} className="raid-row">
                <b>{items.get('items', s.itemId)?.name ?? '?'} ×{s.qty}</b>
                <span>{s.price * s.qty} {cur}</span>
                <span className="hint">{s.seller} → {s.buyer} · {formatGameTime(s.at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="panel tab-detail scroll">
        <div className="panel-header">{t('Auction house')}</div>
        <div className="section form">
          <div className="hint">{t('Loot that only monsters drop is not sold to merchants: players list it here. Others buy gear upgrades and quest items, traders flip cheap lots, craftsmen NPCs buy materials. Prices follow supply and demand.')}</div>
          <div className="field">
            <label>{t('House fee')}: {a.feePct}%</label>
            <input type="range" min={0} max={MAX_FEE_PCT} step={1} value={a.feePct} onChange={(e) => setFee(+e.target.value)} />
            <span className="hint">{t('The fee goes to the world treasury, which pays quest rewards. Above 10% sellers start to complain.')}</span>
          </div>
        </div>
        <div className="panel-header">{t('Latest lots')}</div>
        <div className="section">
          {lots.length === 0 && <div className="hint">{t('Nothing listed.')}</div>}
          {lots.map((l) => {
            const it = items.get('items', l.itemId);
            return (
              <div key={l.id} className="kv">
                <span>{it && <ItemIcon item={it} size={14} />} {it?.name ?? '?'} ×{l.qty} <span className="hint">{l.sellerName}</span></span>
                <span>{l.price} {cur}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
