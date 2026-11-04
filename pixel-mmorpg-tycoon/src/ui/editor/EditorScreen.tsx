import { useSessionStore } from '@/stores/sessionStore';
import { useEditorStore } from '@/stores/editorStore';
import { useAutosave } from '../hooks/useAutosave';
import { useEditorHotkeys } from '../hooks/useEditorHotkeys';
import { BottomLog } from './BottomLog';
import { LeftPanel } from './LeftPanel';
import { PhaserView } from './PhaserView';
import { RightPanel } from './RightPanel';
import { TabBar } from './TabBar';
import { TopBar } from './TopBar';
import { WorldSettingsPanel } from './WorldSettingsPanel';
import { NpcTab } from './NpcTab';
import { CreaturesTab } from './CreaturesTab';
import { ItemsTab } from '../rpg/ItemsTab';
import { EconomyTab } from '../rpg/EconomyTab';
import { QuestsTab } from '../rpg/QuestsTab';
import { ProgressionTab } from '../rpg/ProgressionTab';
import { PlayersTab } from '../sim/PlayersTab';
import { StudioTab } from '../sim/StudioTab';
import { CommunityTab } from '../sim/CommunityTab';
import { AnalyticsTab } from '../sim/AnalyticsTab';
import { EventsTab } from '../sim/EventsTab';
import { ClansTab } from '../sim/ClansTab';
import { AuctionTab } from '../sim/AuctionTab';
import { SeasonsTab } from '../sim/SeasonsTab';
import { PatchesTab } from '../sim/PatchesTab';
import type { GameSession } from '@/session/GameSession';
import { useWorldMusic } from '../hooks/useAudio';

export function EditorScreen() {
  const session = useSessionStore((s) => s.session);
  if (!session) return null;
  return <Editor session={session} key={session.uid} />;
}

function Editor({ session }: { session: GameSession }) {
  const tab = useEditorStore((s) => s.tab);
  useEditorHotkeys(session);
  useAutosave(session);
  useWorldMusic(session);

  return (
    <div className="editor">
      <TopBar />
      <TabBar />
      <div className="editor-main">
        <LeftPanel session={session} />
        <div className="center-area">
          <PhaserView session={session} />
          {tab === 'settings' && (
            <div className="center-overlay">
              <WorldSettingsPanel session={session} />
            </div>
          )}
          {tab === 'npc' && <div className="center-overlay"><NpcTab session={session} /></div>}
          {tab === 'creatures' && <div className="center-overlay"><CreaturesTab session={session} /></div>}
          {tab === 'items' && <div className="center-overlay"><ItemsTab session={session} /></div>}
          {tab === 'economy' && <div className="center-overlay"><EconomyTab session={session} /></div>}
          {tab === 'quests' && <div className="center-overlay"><QuestsTab session={session} /></div>}
          {tab === 'progression' && <div className="center-overlay"><ProgressionTab session={session} /></div>}
          {tab === 'players' && <div className="center-overlay"><PlayersTab session={session} /></div>}
          {tab === 'studio' && <div className="center-overlay"><StudioTab session={session} /></div>}
          {tab === 'community' && <div className="center-overlay"><CommunityTab session={session} /></div>}
          {tab === 'clans' && <div className="center-overlay"><ClansTab session={session} /></div>}
          {tab === 'auction' && <div className="center-overlay"><AuctionTab session={session} /></div>}
          {tab === 'seasons' && <div className="center-overlay"><SeasonsTab session={session} /></div>}
          {tab === 'patches' && <div className="center-overlay"><PatchesTab session={session} /></div>}
          {tab === 'events' && <div className="center-overlay"><EventsTab session={session} /></div>}
          {tab === 'analytics' && <div className="center-overlay"><AnalyticsTab session={session} /></div>}
        </div>
        <RightPanel session={session} />
      </div>
      <BottomLog />
    </div>
  );
}
