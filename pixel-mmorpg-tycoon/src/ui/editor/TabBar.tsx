import { useEditorStore, type EditorTab } from '@/stores/editorStore';
import { t as tr } from '@/i18n';
import { PixelIcon } from '../components/PixelIcon';

/** Tabs not yet implemented are shown locked with the phase that delivers them. */
const TABS: { key: EditorTab; label: string; phase?: number }[] = [
  { key: 'map', label: 'Map' },
  { key: 'npc', label: 'NPC' },
  { key: 'creatures', label: 'Creatures' },
  { key: 'economy', label: 'Economy' },
  { key: 'items', label: 'Items' },
  { key: 'quests', label: 'Quests' },
  { key: 'progression', label: 'Progression' },
  { key: 'players', label: 'Players' },
  { key: 'studio', label: 'Studio' },
  { key: 'community', label: 'Community' },
  { key: 'events', label: 'Events' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'settings', label: 'Settings' },
];

export function TabBar() {
  const current = useEditorStore((s) => s.tab);
  const setTab = useEditorStore((s) => s.setTab);
  return (
    <div className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={`tab ${current === tab.key ? 'active' : ''} ${tab.phase ? 'locked' : ''}`}
          disabled={!!tab.phase}
          title={tab.phase ? tr('Not built yet — arrives in Phase {n}', { n: tab.phase }) : undefined}
          onClick={() => setTab(tab.key)}
        >
          {tab.phase && <PixelIcon name="lock" size={10} />}
          {tr(tab.label)}
          {tab.phase && <span className="badge">P{tab.phase}</span>}
        </button>
      ))}
    </div>
  );
}
