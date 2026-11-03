import { NPC_BEHAVIORS, NPC_TYPES, getNpcType, npcCombatStats } from '@/data/npcTypes';
import type { NpcDef } from '@/models/entities';
import type { GameSession } from '@/session/GameSession';
import { useEditorStore } from '@/stores/editorStore';
import { Field, NumberInput, RowEditor, Select, TextInput } from '../../components/Fields';
import { SpritePreview } from '../../components/SpritePreview';

/** Full NPC editor; every change is one (merged) undo step and applies to the live NPC immediately. */
export function NpcForm({ session, npc, compact = false }: { session: GameSession; npc: NpcDef; compact?: boolean }) {
  const up = (patch: Partial<NpcDef>, label = 'Edit NPC') => session.entities.update('npcs', npc.id, patch, label);
  const setTool = useEditorStore((s) => s.setTool);
  const actor = session.actors.actors.get(npc.id);
  const stats = npcCombatStats(npc.level);

  return (
    <div className="form">
      <div className="row">
        <SpritePreview frame={`npc:${npc.type}:0`} box={40} />
        <div className="grow">
          <TextInput value={npc.name} onChange={(name) => up({ name }, 'Rename NPC')} />
          <div className="hint">{actor ? `${actor.state} · ${actor.hp}/${actor.maxHp} HP` : '—'} · DMG {stats.damage} · DEF {stats.defense}</div>
        </div>
      </div>
      <div className="two-col">
        <Field label="Type">
          <Select value={npc.type} options={NPC_TYPES.map((t) => ({ key: t.key, label: t.name }))} onChange={(type) => up({ type, shop: { ...npc.shop, enabled: npc.shop.enabled || getNpcType(type).defaults.hasShop } }, 'Change NPC type')} />
        </Field>
        <Field label="Level"><NumberInput value={npc.level} min={1} max={100} onChange={(level) => up({ level })} /></Field>
        <Field label="Health"><NumberInput value={npc.maxHp} min={1} max={100000} onChange={(maxHp) => up({ maxHp })} /></Field>
        <Field label="Speed (tiles/s)"><NumberInput value={npc.speed} min={0.2} max={6} step={0.1} onChange={(speed) => up({ speed })} /></Field>
        <Field label="Home X"><NumberInput value={npc.x} min={0} max={session.runtime.grid.width - 1} onChange={(x) => session.runtime.nav.isWalkable(x, npc.y) && up({ x }, 'Move NPC')} /></Field>
        <Field label="Home Y"><NumberInput value={npc.y} min={0} max={session.runtime.grid.height - 1} onChange={(y) => session.runtime.nav.isWalkable(npc.x, y) && up({ y }, 'Move NPC')} /></Field>
      </div>
      <Field label="Behavior" hint={NPC_BEHAVIORS.find((b) => b.key === npc.behavior)?.hint}>
        <div className="chip-row">
          {NPC_BEHAVIORS.map((b) => (
            <button key={b.key} className={`btn small ${npc.behavior === b.key ? 'active' : ''}`} onClick={() => up({ behavior: b.key }, 'NPC behavior')}>{b.label}</button>
          ))}
        </div>
      </Field>
      {npc.behavior === 'wander' && <Field label={`Wander radius: ${npc.wanderRadius}`}><input type="range" min={1} max={20} value={npc.wanderRadius} onChange={(e) => up({ wanderRadius: +e.target.value })} /></Field>}
      {npc.behavior === 'patrol' && (
        <Field label={`Waypoints (${npc.waypoints.length})`} hint="The NPC loops home → waypoint 1 → 2 → … → home.">
          <div className="chip-row">
            <button className="btn small" onClick={() => setTool('waypoint')}>+ Add on map</button>
            <button className="btn small" disabled={!npc.waypoints.length} onClick={() => up({ waypoints: npc.waypoints.slice(0, -1) }, 'Remove waypoint')}>Remove last</button>
            <button className="btn small" disabled={!npc.waypoints.length} onClick={() => up({ waypoints: [] }, 'Clear waypoints')}>Clear</button>
          </div>
        </Field>
      )}
      <div className="two-col">
        <Field label="Works from (h)"><NumberInput value={npc.workStart} min={0} max={24} onChange={(workStart) => up({ workStart })} /></Field>
        <Field label="Works until (h)"><NumberInput value={npc.workEnd} min={0} max={24} onChange={(workEnd) => up({ workEnd })} /></Field>
      </div>
      <Field label={`Interaction radius: ${npc.interactionRadius} tiles`} hint={getNpcType(npc.type).defender ? 'Guards attack monsters inside this radius.' : 'Players interact within this radius (Phase 4).'}>
        <input type="range" min={1} max={15} value={npc.interactionRadius} onChange={(e) => up({ interactionRadius: +e.target.value })} />
      </Field>
      {!compact && (
        <>
          <Field label="Inventory" hint="Item names link to the item database in Phase 3.">
            <RowEditor rows={npc.inventory} empty="Empty inventory." make={() => ({ name: 'Bread', qty: 1 })} onChange={(inventory) => up({ inventory }, 'Edit inventory')}
              columns={[{ key: 'name', label: 'Item', type: 'text' }, { key: 'qty', label: 'Qty', type: 'number', min: 1, max: 9999, width: 64 }]} />
          </Field>
          <Field label="Shop">
            <label className="check"><input type="checkbox" checked={npc.shop.enabled} onChange={(e) => up({ shop: { ...npc.shop, enabled: e.target.checked } }, 'Toggle shop')} /> Sells items</label>
            {npc.shop.enabled && (
              <RowEditor rows={npc.shop.items} empty="Nothing for sale yet." make={() => ({ name: 'Health Potion', price: 25, stock: 10 })} onChange={(items) => up({ shop: { ...npc.shop, items } }, 'Edit shop')}
                columns={[{ key: 'name', label: 'Item', type: 'text' }, { key: 'price', label: 'Price', type: 'number', min: 0, max: 1e7, width: 70 }, { key: 'stock', label: 'Stock', type: 'number', min: 0, max: 9999, width: 60 }]} />
            )}
          </Field>
        </>
      )}
    </div>
  );
}
