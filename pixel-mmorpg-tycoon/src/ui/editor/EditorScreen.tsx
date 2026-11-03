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
import type { GameSession } from '@/session/GameSession';

export function EditorScreen() {
  const session = useSessionStore((s) => s.session);
  if (!session) return null;
  return <Editor session={session} key={session.uid} />;
}

function Editor({ session }: { session: GameSession }) {
  const tab = useEditorStore((s) => s.tab);
  useEditorHotkeys(session);
  useAutosave(session);

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
        </div>
        <RightPanel session={session} />
      </div>
      <BottomLog />
    </div>
  );
}
