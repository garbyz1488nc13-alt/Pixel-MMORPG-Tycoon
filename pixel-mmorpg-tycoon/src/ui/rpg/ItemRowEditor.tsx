import type { ReactNode } from 'react';
import type { EntityId } from '@/core/ids';
import { t } from '@/i18n';
import type { GameSession } from '@/session/GameSession';
import { NumberInput } from '../components/Fields';
import { ItemIcon, ItemSelect } from './ItemIcon';

interface NumCol<T> { key: keyof T; label: string; min?: number; max?: number; width?: number }

/** Editable list of rows that reference an item (inventory, shop, loot, rewards). */
export function ItemRowEditor<T extends { itemId: EntityId }>({
  session, rows, columns, make, onChange, empty, extra,
}: {
  session: GameSession;
  rows: T[];
  columns: NumCol<T>[];
  make: (itemId: EntityId) => T;
  onChange: (rows: T[]) => void;
  empty: string;
  /** Optional read-only cell (e.g. live price). */
  extra?: { label: string; render: (row: T) => ReactNode; width?: number };
}) {
  const items = session.runtime.entities;
  const grid = `34px minmax(0, 1fr) ${columns.map((c) => `${c.width ?? 58}px`).join(' ')}${extra ? ` ${extra.width ?? 60}px` : ''} 26px`;
  const set = (i: number, patch: Partial<T>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const firstItem = items.list('items')[0]?.id;
  return (
    <div className="row-editor">
      {rows.length === 0 && <div className="hint">{empty}</div>}
      {rows.length > 0 && (
        <div className="re-row re-head" style={{ gridTemplateColumns: grid }}>
          <span /><span>{t('Item')}</span>
          {columns.map((c) => <span key={String(c.key)}>{c.label}</span>)}
          {extra && <span>{extra.label}</span>}
          <span />
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} className="re-row" style={{ gridTemplateColumns: grid }}>
          <ItemIcon item={items.get('items', r.itemId)} size={24} />
          <ItemSelect session={session} value={r.itemId} onChange={(itemId) => set(i, { itemId } as Partial<T>)} />
          {columns.map((c) => (
            <NumberInput key={String(c.key)} value={r[c.key] as number} min={c.min} max={c.max} onChange={(v) => set(i, { [c.key]: v } as Partial<T>)} />
          ))}
          {extra && <span className="re-extra">{extra.render(r)}</span>}
          <button className="btn small icon" title={t('Remove')} onClick={() => onChange(rows.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button className="btn small" disabled={!firstItem} onClick={() => firstItem && onChange([...rows, make(firstItem)])}>+ {t('Add')}</button>
    </div>
  );
}
