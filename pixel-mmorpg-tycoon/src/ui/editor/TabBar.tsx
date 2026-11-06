import { useSettingsStore } from '@/stores/settingsStore';
import { useEditorStore, type EditorTab } from '@/stores/editorStore';
import { t as tr } from '@/i18n';
import { PixelIcon } from '../components/PixelIcon';
import { useSessionStore } from '@/stores/sessionStore';
import { useSimTick } from '../sim/useSimTick';

/** Tabs that need a researched feature in standard mode. */
const NEEDS: Partial<Record<EditorTab, string>> = { clans: 'clans', auction: 'auction', seasons: 'seasons', events: 'events' };

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
  { key: 'clans', label: 'Clans' },
  { key: 'auction', label: 'Auction' },
  { key: 'seasons', label: 'Seasons' },
  { key: 'patches', label: 'Patches' },
  { key: 'events', label: 'Events' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'settings', label: 'Settings' },
];

export function TabBar() {
  const current = useEditorStore((s) => s.tab);
  const setTab = useEditorStore((s) => s.setTab);
  const session = useSessionStore((s) => s.session);
  useSimTick(2000);
  const locked = (k: EditorTab) => !!NEEDS[k] && !!session && !session.runtime.feature(NEEDS[k]!);
  return (
    <div className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={`tab ${current === tab.key ? 'active' : ''} ${tab.phase || locked(tab.key) ? 'locked' : ''}`}
          disabled={!!tab.phase}
          title={tab.phase ? tr('Not built yet — arrives in Phase {n}', { n: tab.phase }) : locked(tab.key) ? tr('Not released yet: develop it in the Studio tab.') : undefined}
          onClick={() => setTab(tab.key)}
        >
          {(tab.phase || locked(tab.key)) && <PixelIcon name="lock" size={10} />}
          {tr(tab.label)}
          {tab.phase && <span className="badge">P{tab.phase}</span>}
        </button>
      ))}
      <LayoutToggles />
    </div>
  );
}

/** Collapse side panels / the log to give tabs more room. */
function LayoutToggles() {
  const s = useSettingsStore();
  const btn = (on: boolean, label: string, title: string, toggle: () => void) => (
    <button className={`btn small layout-toggle ${on ? '' : 'active'}`} title={title} onClick={toggle}>{label}</button>
  );
  return (
    <div className="layout-toggles">
      {btn(s.hideLeft, '◧', tr('Show / hide the tools panel'), () => s.update({ hideLeft: !s.hideLeft }))}
      {btn(s.hideLog, '▭', tr('Show / hide the log'), () => s.update({ hideLog: !s.hideLog }))}
      {btn(s.hideRight, '◨', tr('Show / hide the minimap & selection panel'), () => s.update({ hideRight: !s.hideRight }))}
    </div>
  );
}
