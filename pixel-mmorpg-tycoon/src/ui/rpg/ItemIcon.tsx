import type { EntityId } from '@/core/ids';
import { rarityColor } from '@/data/rpgDefaults';
import type { ItemDef } from '@/models/rpg';
import { t } from '@/i18n';
import type { GameSession } from '@/session/GameSession';
import { SpritePreview } from '../components/SpritePreview';
import { useEntityList } from '../hooks/useEntities';

/** Item icon framed in its rarity colour. */
export function ItemIcon({ item, size = 28 }: { item: Pick<ItemDef, 'icon' | 'rarity'> | undefined; size?: number }) {
  return (
    <span className="item-icon" style={{ width: size + 4, height: size + 4, borderColor: item ? rarityColor(item.rarity) : '#3a2f57' }}>
      {item && <SpritePreview frame={`icon:${item.icon}`} box={size} />}
    </span>
  );
}

/** Item dropdown grouped by category. */
export function ItemSelect({ session, value, onChange, allowEmpty = false, id }: { session: GameSession; value: EntityId | null; onChange: (id: EntityId) => void; allowEmpty?: boolean; id?: string }) {
  const items = useEntityList(session, 'items');
  const cats = [...new Set(items.map((i) => i.category))];
  return (
    <select id={id} className="input" value={value ?? ''} onChange={(e) => e.target.value && onChange(e.target.value)}>
      {(allowEmpty || !value) && <option value="">— {t('choose item')} —</option>}
      {cats.map((c) => (
        <optgroup key={c} label={t(c)}>
          {items.filter((i) => i.category === c).sort((a, b) => a.name.localeCompare(b.name)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
