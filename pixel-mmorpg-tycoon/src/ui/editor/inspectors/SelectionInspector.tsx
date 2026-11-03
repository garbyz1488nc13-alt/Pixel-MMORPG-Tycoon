import { getObjectDef } from '@/data/objects';
import { getRegionType, REGION_TYPES } from '@/data/regionTypes';
import type { GameSession } from '@/session/GameSession';
import { populateRegion } from '@/systems/generation/Populate';
import { confirmDialog } from '@/stores/dialogStore';
import { useEditorStore } from '@/stores/editorStore';
import { log } from '@/stores/logStore';
import { toast } from '@/stores/toastStore';
import { Field, NumberInput, Select, TextInput } from '../../components/Fields';
import { SpritePreview } from '../../components/SpritePreview';
import { useEntity, useEntityList, useLiveCounts } from '../../hooks/useEntities';
import { NpcForm } from './NpcForm';

/** Properties / actions for whatever is selected on the map. */
export function SelectionInspector({ session }: { session: GameSession }) {
  const sel = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);
  if (!sel) return <div className="hint">Nothing selected. Use the Select tool (V) to pick objects, NPCs, regions or spawn areas.</div>;

  const del = () => {
    const n = session.entities.remove(sel.col, sel.ids);
    select(null);
    if (n) toast(`Deleted ${sel.ids.length}`, 'success');
  };
  const actions = (
    <div className="chip-row">
      {sel.col === 'objects' && <button className="btn small" onClick={() => { const ids = session.entities.duplicateObjects(sel.ids, 1, 1); if (ids.length) select({ col: 'objects', ids }); else toast('No room for the copy', 'error'); }}>Duplicate (Ctrl+D)</button>}
      {sel.col === 'npcs' && <button className="btn small" onClick={() => { const n = session.entities.duplicateNpc(sel.ids[0]); if (n) select({ col: 'npcs', ids: [n.id] }); }}>Duplicate</button>}
      <button className="btn small danger" onClick={del}>Delete (Del)</button>
    </div>
  );

  switch (sel.col) {
    case 'objects':
      return sel.ids.length === 1 ? <ObjectInspector session={session} id={sel.ids[0]} actions={actions} /> : (
        <div className="form">
          <div className="inspect-title">{sel.ids.length} objects</div>
          <div className="hint">Drag to move them together. Ctrl+C / Ctrl+V copies to the cursor.</div>
          {actions}
        </div>
      );
    case 'npcs':
      return <NpcInspector session={session} id={sel.ids[0]} actions={actions} />;
    case 'regions':
      return <RegionInspector session={session} id={sel.ids[0]} actions={actions} />;
    case 'spawnAreas':
      return <SpawnAreaInspector session={session} id={sel.ids[0]} actions={actions} />;
  }
}

function ObjectInspector({ session, id, actions }: { session: GameSession; id: string; actions: JSX.Element }) {
  const o = useEntity(session, 'objects', id);
  const all = useEntityList(session, 'objects');
  if (!o) return null;
  const def = getObjectDef(o.kind);
  const portals = all.filter((p) => p.kind === 'portal' && p.id !== o.id);
  return (
    <div className="form">
      <div className="row">
        <SpritePreview frame={`obj:${o.kind}`} box={44} />
        <div className="grow">
          <div className="inspect-title">{o.name ?? def?.name}</div>
          <div className="hint">{def?.name} · ({o.x}, {o.y}) · {def?.w}×{def?.h}{def?.blocks ? ' · solid' : ''}</div>
        </div>
      </div>
      <Field label="Label"><TextInput value={o.name ?? ''} onChange={(name) => session.entities.update('objects', o.id, { name }, 'Rename object')} /></Field>
      {o.kind === 'portal' && (
        <Field label="Destination portal" hint={portals.length ? 'Players will travel between linked portals (Phase 4).' : 'Place a second portal to link to.'}>
          <select className="input" value={o.linkId ?? ''} onChange={(e) => {
            const target = e.target.value || undefined;
            session.entities.update('objects', o.id, { linkId: target }, 'Link portal');
            if (target) session.entities.update('objects', target, { linkId: o.id }, 'Link portal');
          }}>
            <option value="">— not linked —</option>
            {portals.map((p) => <option key={p.id} value={p.id}>{p.name ?? 'Portal'} ({p.x}, {p.y})</option>)}
          </select>
        </Field>
      )}
      {actions}
    </div>
  );
}

function NpcInspector({ session, id, actions }: { session: GameSession; id: string; actions: JSX.Element }) {
  const npc = useEntity(session, 'npcs', id);
  const setTab = useEditorStore((s) => s.setTab);
  if (!npc) return null;
  return (
    <div className="form">
      <NpcForm session={session} npc={npc} compact />
      <div className="chip-row">
        <button className="btn small" onClick={() => setTab('npc')}>Inventory & shop…</button>
      </div>
      {actions}
    </div>
  );
}

function RegionInspector({ session, id, actions }: { session: GameSession; id: string; actions: JSX.Element }) {
  const r = useEntity(session, 'regions', id);
  if (!r) return null;
  const up = (patch: Partial<typeof r>, label = 'Edit region') => session.entities.update('regions', r.id, patch, label);
  const t = getRegionType(r.type);
  const populate = async () => {
    const ok = await confirmDialog({ title: `Populate ${r.name}`, message: `Generate ${t.name.toLowerCase()} content inside this region?\nExisting objects stay; new ones fill free space. Undo with Ctrl+Z.`, confirmLabel: 'Populate' });
    if (!ok) return;
    const summary = populateRegion(session.runtime, session.history, r);
    log.event(`${r.name} populated: ${summary}.`, 'success', session.runtime.clock.totalMinutes);
    toast(`Populated: ${summary}`, 'success');
  };
  return (
    <div className="form">
      <Field label="Name"><TextInput value={r.name} onChange={(name) => up({ name }, 'Rename region')} /></Field>
      <Field label="Type"><Select value={r.type} options={REGION_TYPES.map((x) => ({ key: x.key, label: x.name }))} onChange={(type) => up({ type })} /></Field>
      <div className="two-col">
        <Field label="Min level"><NumberInput value={r.minLevel} min={1} max={100} onChange={(minLevel) => up({ minLevel, maxLevel: Math.max(minLevel, r.maxLevel) })} /></Field>
        <Field label="Max level"><NumberInput value={r.maxLevel} min={1} max={100} onChange={(maxLevel) => up({ maxLevel, minLevel: Math.min(maxLevel, r.minLevel) })} /></Field>
        <Field label="Width"><NumberInput value={r.w} min={2} max={session.runtime.grid.width - r.x} onChange={(w) => up({ w }, 'Resize region')} /></Field>
        <Field label="Height"><NumberInput value={r.h} min={2} max={session.runtime.grid.height - r.y} onChange={(h) => up({ h }, 'Resize region')} /></Field>
      </div>
      <div className="hint">{t.safe ? 'Safe zone: players can rest here.' : 'Hostile zone.'} Drag the region with Select to move it.</div>
      {t.populate && <button className="btn primary" onClick={populate}>Populate as {t.name}</button>}
      {actions}
    </div>
  );
}

function SpawnAreaInspector({ session, id, actions }: { session: GameSession; id: string; actions: JSX.Element }) {
  const a = useEntity(session, 'spawnAreas', id);
  const templates = useEntityList(session, 'creatureTemplates');
  useLiveCounts(session);
  if (!a) return null;
  const up = (patch: Partial<typeof a>, label = 'Edit spawn area') => session.entities.update('spawnAreas', a.id, patch, label);
  const members = [...session.actors.actors.values()].filter((m) => m.spawnAreaId === a.id);
  const alive = members.filter((m) => m.state !== 'dead').length;
  return (
    <div className="form">
      <Field label="Name"><TextInput value={a.name} onChange={(name) => up({ name }, 'Rename spawn area')} /></Field>
      <Field label="Creature">
        <Select value={a.templateId} options={templates.map((t) => ({ key: t.id, label: `${t.name} (Lv ${t.level})` }))} onChange={(templateId) => up({ templateId }, 'Change spawn creature')} />
      </Field>
      <div className="two-col">
        <Field label="Max alive"><NumberInput value={a.maxCount} min={0} max={50} onChange={(maxCount) => up({ maxCount })} /></Field>
        <Field label="Size">
          <div className="row"><NumberInput value={a.w} min={1} max={session.runtime.grid.width - a.x} onChange={(w) => up({ w }, 'Resize spawn area')} />×<NumberInput value={a.h} min={1} max={session.runtime.grid.height - a.y} onChange={(h) => up({ h }, 'Resize spawn area')} /></div>
        </Field>
      </div>
      <div className="kv"><span>Alive now</span><span>{alive} / {members.length}</span></div>
      <div className="kv"><span>Waiting to respawn</span><span>{members.length - alive}</span></div>
      {actions}
    </div>
  );
}
