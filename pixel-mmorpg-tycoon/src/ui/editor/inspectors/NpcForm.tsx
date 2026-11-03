import { NPC_BEHAVIORS, NPC_TYPES, getNpcType, npcCombatStats } from '@/data/npcTypes';
import { t } from '@/i18n';
import type { NpcDef } from '@/models/entities';
import type { GameSession } from '@/session/GameSession';
import { useEditorStore } from '@/stores/editorStore';
import { Field, NumberInput, Select, TextInput } from '../../components/Fields';
import { ItemRowEditor } from '../../rpg/ItemRowEditor';
import { compact as compactInv } from '@/systems/rpg/inventory';
import { sellPrice } from '@/systems/rpg/pricing';
import { SpritePreview } from '../../components/SpritePreview';

/** Full NPC editor; every change is one (merged) undo step and applies to the live NPC immediately. */
export function NpcForm({ session, npc, compact = false }: { session: GameSession; npc: NpcDef; compact?: boolean }) {
  const up = (patch: Partial<NpcDef>, label = t('Edit NPC')) => session.entities.update('npcs', npc.id, patch, label);
  const setTool = useEditorStore((s) => s.setTool);
  const actor = session.actors.actors.get(npc.id);
  const stats = npcCombatStats(npc.level);

  return (
    <div className="form">
      <div className="row">
        <SpritePreview frame={`npc:${npc.type}:0`} box={40} />
        <div className="grow">
          <TextInput value={npc.name} onChange={(name) => up({ name }, t('Rename NPC'))} />
          <div className="hint">{actor ? `${t(actor.state)} · ${actor.hp}/${actor.maxHp} ${t('HP')}` : '—'} · {t('DMG')} {stats.damage} · {t('DEF')} {stats.defense}</div>
        </div>
      </div>
      <div className="two-col">
        <Field label={t('Type')}>
          <Select value={npc.type} options={NPC_TYPES.map((x) => ({ key: x.key, label: t(x.name) }))} onChange={(type) => up({ type, shop: { ...npc.shop, enabled: npc.shop.enabled || getNpcType(type).defaults.hasShop } }, t('Change NPC type'))} />
        </Field>
        <Field label={t('Level')}><NumberInput value={npc.level} min={1} max={100} onChange={(level) => up({ level })} /></Field>
        <Field label={t('Health')}><NumberInput value={npc.maxHp} min={1} max={100000} onChange={(maxHp) => up({ maxHp })} /></Field>
        <Field label={t('Speed (tiles/s)')}><NumberInput value={npc.speed} min={0.2} max={6} step={0.1} onChange={(speed) => up({ speed })} /></Field>
        <Field label={t('Home X')}><NumberInput value={npc.x} min={0} max={session.runtime.grid.width - 1} onChange={(x) => session.runtime.nav.isWalkable(x, npc.y) && up({ x }, t('Move NPC'))} /></Field>
        <Field label={t('Home Y')}><NumberInput value={npc.y} min={0} max={session.runtime.grid.height - 1} onChange={(y) => session.runtime.nav.isWalkable(npc.x, y) && up({ y }, t('Move NPC'))} /></Field>
      </div>
      <Field label={t('Behavior')} hint={t(NPC_BEHAVIORS.find((b) => b.key === npc.behavior)?.hint ?? '')}>
        <div className="chip-row">
          {NPC_BEHAVIORS.map((b) => (
            <button key={b.key} className={`btn small ${npc.behavior === b.key ? 'active' : ''}`} onClick={() => up({ behavior: b.key }, t('NPC behavior'))}>{t(b.label)}</button>
          ))}
        </div>
      </Field>
      {npc.behavior === 'wander' && <Field label={`${t('Wander radius')}: ${npc.wanderRadius}`}><input type="range" min={1} max={20} value={npc.wanderRadius} onChange={(e) => up({ wanderRadius: +e.target.value })} /></Field>}
      {npc.behavior === 'patrol' && (
        <Field label={`${t('Waypoints')} (${npc.waypoints.length})`} hint={t('The NPC loops home → waypoint 1 → 2 → … → home.')}>
          <div className="chip-row">
            <button className="btn small" onClick={() => setTool('waypoint')}>+ {t('Add on map')}</button>
            <button className="btn small" disabled={!npc.waypoints.length} onClick={() => up({ waypoints: npc.waypoints.slice(0, -1) }, t('Remove waypoint'))}>{t('Remove last')}</button>
            <button className="btn small" disabled={!npc.waypoints.length} onClick={() => up({ waypoints: [] }, t('Clear waypoints'))}>{t('Clear')}</button>
          </div>
        </Field>
      )}
      <div className="two-col">
        <Field label={t('Works from (h)')}><NumberInput value={npc.workStart} min={0} max={24} onChange={(workStart) => up({ workStart })} /></Field>
        <Field label={t('Works until (h)')}><NumberInput value={npc.workEnd} min={0} max={24} onChange={(workEnd) => up({ workEnd })} /></Field>
      </div>
      <Field label={t('Interaction radius: {n} tiles', { n: npc.interactionRadius })} hint={getNpcType(npc.type).defender ? t('Guards attack monsters inside this radius.') : t('Players interact within this radius (Phase 4).')}>
        <input type="range" min={1} max={15} value={npc.interactionRadius} onChange={(e) => up({ interactionRadius: +e.target.value })} />
      </Field>
      {!compact && (
        <>
          <Field label={`${t('Gold')} (${session.runtime.rpg.economy.currencyName})`} hint={t('Coins this NPC carries. Changes as it trades.')}>
            <NumberInput value={npc.gold} min={0} max={1e9} onChange={(gold) => up({ gold }, t('Edit gold'))} />
          </Field>
          <Field label={t('Inventory')} hint={t('Stacks respect each item\'s stack size (max 24 slots).')}>
            <ItemRowEditor session={session} rows={npc.inventory} empty={t('Empty inventory.')} make={(itemId) => ({ itemId, qty: 1 })}
              onChange={(rows) => up({ inventory: compactInv(rows, (id) => session.runtime.entities.get('items', id)) }, t('Edit inventory'))}
              columns={[{ key: 'qty', label: t('Qty'), min: 1, max: 9999 }]} />
          </Field>
          <Field label={t('Shop')} hint={npc.shop.enabled ? t('Prices follow supply and demand: low stock is pricier. Merchants restock towards Max stock.') : undefined}>
            <label className="check"><input type="checkbox" checked={npc.shop.enabled} onChange={(e) => up({ shop: { ...npc.shop, enabled: e.target.checked } }, t('Toggle shop'))} /> {t('Sells items')}</label>
            {npc.shop.enabled && (
              <ItemRowEditor session={session} rows={npc.shop.items} empty={t('Nothing for sale yet.')} make={(itemId) => ({ itemId, stock: 10, maxStock: 10 })}
                onChange={(items) => up({ shop: { ...npc.shop, items } }, t('Edit shop'))}
                columns={[{ key: 'stock', label: t('Stock'), min: 0, max: 9999 }, { key: 'maxStock', label: t('Max'), min: 0, max: 9999 }]}
                extra={{ label: t('Price'), render: (row) => { const it = session.runtime.entities.get('items', row.itemId); return it ? sellPrice(it, row, session.runtime.rpg.economy) : '—'; } }} />
            )}
          </Field>
        </>
      )}
    </div>
  );
}
