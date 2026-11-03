import { useEditorStore, type EditorTab } from '@/stores/editorStore';
import { PixelIcon } from '../components/PixelIcon';

/** Tabs not yet implemented are shown locked with the phase that delivers them. */
const TABS: { key: EditorTab; label: string; phase?: number }[] = [
  { key: 'map', label: 'Map' },
  { key: 'npc', label: 'NPC', phase: 2 },
  { key: 'creatures', label: 'Creatures', phase: 2 },
  { key: 'economy', label: 'Economy', phase: 3 },
  { key: 'items', label: 'Items', phase: 3 },
  { key: 'quests', label: 'Quests', phase: 3 },
  { key: 'progression', label: 'Progression', phase: 3 },
  { key: 'players', label: 'Players', phase: 4 },
  { key: 'events', label: 'Events', phase: 5 },
  { key: 'analytics', label: 'Analytics', phase: 5 },
  { key: 'settings', label: 'Settings' },
];

export function TabBar() {
  const tab = useEditorStore((s) => s.tab);
  const setTab = useEditorStore((s) => s.setTab);
  return (
    <div className="tabbar">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`tab ${tab === t.key ? 'active' : ''} ${t.phase ? 'locked' : ''}`}
          disabled={!!t.phase}
          title={t.phase ? `Not built yet — arrives in Phase ${t.phase}` : undefined}
          onClick={() => setTab(t.key)}
        >
          {t.phase && <PixelIcon name="lock" size={10} />}
          {t.label}
          {t.phase && <span className="badge">P{t.phase}</span>}
        </button>
      ))}
    </div>
  );
}
