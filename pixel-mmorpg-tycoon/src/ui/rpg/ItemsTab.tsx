import { useMemo, useState } from 'react';
import type { EntityId } from '@/core/ids';
import { EQUIP_SLOTS, ITEM_CATEGORIES, ITEM_ICONS, RARITIES, STAT_KEYS, rarityColor } from '@/data/rpgDefaults';
import { t } from '@/i18n';
import type { ItemCategory, ItemDef, ItemStats } from '@/models/rpg';
import type { GameSession } from '@/session/GameSession';
import { baseValue, buyPrice, sellPrice } from '@/systems/rpg/pricing';
import { confirmDialog } from '@/stores/dialogStore';
import { Field, NumberInput, Select, TextInput } from '../components/Fields';
import { SpritePreview } from '../components/SpritePreview';
import { useEntityList } from '../hooks/useEntities';
import { ItemIcon } from './ItemIcon';
import { itemUsage, usageCount } from './usage';

export function ItemsTab({ session }: { session: GameSession }) {
  const items = useEntityList(session, 'items');
  useEntityList(session, 'npcs');
  const [cat, setCat] = useState<ItemCategory | 'all'>('all');
  const [q, setQ] = useState('');
  const [current, setCurrent] = useState<EntityId | null>(null);
  const shown = useMemo(
    () => items.filter((i) => (cat === 'all' || i.category === cat) && i.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.category.localeCompare(b.category) || a.levelReq - b.levelReq || a.name.localeCompare(b.name)),
    [items, cat, q],
  );
  const item = items.find((i) => i.id === current) ?? shown[0];
  const eco = session.runtime.rpg.economy;

  return (
    <div className="tab-page">
      <div className="panel tab-list">
        <div className="panel-header">{t('Item database')} ({items.length})
          <button className="btn small primary" onClick={() => setCurrent(session.entities.addItem(cat === 'all' ? 'misc' : cat).id)}>+ {t('New item')}</button>
        </div>
        <div className="section">
          <input className="input" placeholder={t('Search by name…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chip-row">
            <button className={`btn small ${cat === 'all' ? 'active' : ''}`} onClick={() => setCat('all')}>{t('All')} {items.length}</button>
            {ITEM_CATEGORIES.map((c) => (
              <button key={c.key} className={`btn small ${cat === c.key ? 'active' : ''}`} onClick={() => setCat(c.key)}>{t(c.label)} {items.filter((i) => i.category === c.key).length}</button>
            ))}
          </div>
        </div>
        <div className="table-scroll scroll">
          <table className="data-table">
            <thead><tr><th /><th>{t('Name')}</th><th>{t('Category')}</th><th>{t('Rarity')}</th><th>{t('Value')}</th><th>{t('Lv')}</th><th>{t('Used')}</th></tr></thead>
            <tbody>
              {shown.map((i) => (
                <tr key={i.id} className={item?.id === i.id ? 'active' : ''} onClick={() => setCurrent(i.id)}>
                  <td><ItemIcon item={i} size={18} /></td>
                  <td style={{ color: rarityColor(i.rarity) }}>{i.name}</td>
                  <td>{t(i.category)}</td>
                  <td>{t(RARITIES.find((r) => r.key === i.rarity)!.label)}</td>
                  <td>{i.value}</td>
                  <td>{i.levelReq}</td>
                  <td>{usageCount(itemUsage(session.runtime.entities, i.id)) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <div className="hint pad">{t('No items match.')}</div>}
        </div>
      </div>
      <div className="panel tab-detail scroll">
        <div className="panel-header">{item ? item.name : t('Item')}</div>
        <div className="section">
          {item ? <ItemForm session={session} item={item} onDeleted={() => setCurrent(null)} onDuplicated={setCurrent} /> : <div className="hint">{t('Create an item to edit it.')}</div>}
          {item && (
            <div className="price-box">
              <div className="kv"><span>{t('Base value × rarity')}</span><span>{Math.round(baseValue(item, eco))} {eco.currencyName}</span></div>
              <div className="kv"><span>{t('Shop price (balanced stock)')}</span><span>{sellPrice(item, null, eco)}</span></div>
              <div className="kv"><span>{t('Merchant buys for')}</span><span>{buyPrice(item, null, eco)}</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemForm({ session, item, onDeleted, onDuplicated }: { session: GameSession; item: ItemDef; onDeleted: () => void; onDuplicated: (id: EntityId) => void }) {
  const up = (patch: Partial<ItemDef>, label = t('Edit item')) => session.entities.update('items', item.id, patch, label);
  const setStat = (k: keyof ItemStats, v: number) => {
    const stats = { ...item.stats };
    if (v === 0) delete stats[k];
    else stats[k] = v;
    up({ stats }, t('Edit item stats'));
  };
  const usage = itemUsage(session.runtime.entities, item.id);
  const remove = async () => {
    const n = usageCount(usage);
    const ok = await confirmDialog({
      title: t('Delete item'),
      message: n ? t('"{name}" is used in {n} place(s). It will be removed from shops, inventories, loot tables and quests.', { name: item.name, n }) : t('Delete "{name}"?', { name: item.name }),
      confirmLabel: t('Delete'), danger: true,
    });
    if (!ok) return;
    session.entities.remove('items', [item.id]);
    onDeleted();
  };
  const equippable = item.slot !== 'none';

  return (
    <div className="form">
      <div className="row">
        <ItemIcon item={item} size={40} />
        <div className="grow">
          <TextInput value={item.name} onChange={(name) => up({ name }, t('Rename item'))} />
        </div>
      </div>
      <Field label={t('Description')}>
        <textarea className="input" rows={2} value={item.description} maxLength={200} onChange={(e) => up({ description: e.target.value }, t('Edit description'))} />
      </Field>
      <Field label={t('Icon')}>
        <div className="icon-grid">
          {ITEM_ICONS.map((ic) => (
            <button key={ic} className={`icon-btn ${item.icon === ic ? 'active' : ''}`} title={ic} onClick={() => up({ icon: ic }, t('Change icon'))}>
              <SpritePreview frame={`icon:${ic}`} box={24} />
            </button>
          ))}
        </div>
      </Field>
      <div className="two-col">
        <Field label={t('Category')}><Select value={item.category} options={ITEM_CATEGORIES.map((c) => ({ key: c.key, label: t(c.label) }))} onChange={(category) => up({ category })} /></Field>
        <Field label={t('Equip slot')}><Select value={item.slot} options={EQUIP_SLOTS.map((s) => ({ key: s.key, label: t(s.label) }))} onChange={(slot) => up({ slot, stackSize: slot !== 'none' ? 1 : item.stackSize })} /></Field>
        <Field label={t('Value')}><NumberInput value={item.value} min={0} max={1e8} onChange={(value) => up({ value })} /></Field>
        <Field label={t('Level requirement')}><NumberInput value={item.levelReq} min={1} max={session.runtime.rpg.progression.maxLevel} onChange={(levelReq) => up({ levelReq })} /></Field>
        <Field label={t('Stack size')}><NumberInput value={item.stackSize} min={1} max={999} onChange={(stackSize) => up({ stackSize: equippable ? 1 : stackSize })} /></Field>
      </div>
      <Field label={t('Rarity')}>
        <div className="chip-row">
          {RARITIES.map((r) => (
            <button key={r.key} className={`btn small ${item.rarity === r.key ? 'active' : ''}`} style={{ color: item.rarity === r.key ? undefined : r.color }} onClick={() => up({ rarity: r.key })}>{t(r.label)}</button>
          ))}
        </div>
      </Field>
      <Field label={t('Stats')} hint={equippable ? t('Applied while equipped (if the level requirement is met).') : t('Consumables use Heals HP / Restores mana.')}>
        <div className="stat-grid">
          {STAT_KEYS.map((s) => (
            <label key={s.key} className="stat-cell">
              <span>{t(s.label)}</span>
              <NumberInput value={item.stats[s.key] ?? 0} min={-999} max={99999} onChange={(v) => setStat(s.key, v)} />
            </label>
          ))}
        </div>
      </Field>
      <Field label={t('Where used')}>
        {usageCount(usage) === 0 ? <div className="hint">{t('Not used anywhere yet.')}</div> : (
          <div className="usage">
            {usage.shops.length > 0 && <div><b>{t('Sold by')}:</b> {usage.shops.join(', ')}</div>}
            {usage.inventories.length > 0 && <div><b>{t('Carried by')}:</b> {usage.inventories.join(', ')}</div>}
            {usage.loot.length > 0 && <div><b>{t('Dropped by')}:</b> {usage.loot.join(', ')}</div>}
            {usage.quests.length > 0 && <div><b>{t('Quests')}:</b> {usage.quests.join(', ')}</div>}
          </div>
        )}
      </Field>
      <div className="chip-row">
        <button className="btn small" onClick={() => { const c = session.entities.duplicateItem(item.id); if (c) onDuplicated(c.id); }}>{t('Duplicate')}</button>
        <button className="btn small danger" onClick={remove}>{t('Delete')}</button>
      </div>
    </div>
  );
}
