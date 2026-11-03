import { useSessionStore } from '@/stores/sessionStore';
import { DialogHost } from '@/ui/components/DialogHost';
import { Toasts } from '@/ui/components/Toasts';
import { EditorScreen } from '@/ui/editor/EditorScreen';
import { CreateWorldScreen } from '@/ui/screens/CreateWorldScreen';
import { LoadWorldScreen } from '@/ui/screens/LoadWorldScreen';
import { MainMenu } from '@/ui/screens/MainMenu';
import { MenuBackdrop } from '@/ui/screens/MenuBackdrop';
import { MyWorldsScreen } from '@/ui/screens/MyWorldsScreen';
import { SettingsScreen } from '@/ui/screens/SettingsScreen';

export function App() {
  const screen = useSessionStore((s) => s.screen);
  return (
    <>
      {screen === 'editor' ? (
        <EditorScreen />
      ) : (
        <div className="menu-root">
          <MenuBackdrop />
          {screen === 'menu' && <MainMenu />}
          {screen === 'create' && <CreateWorldScreen />}
          {screen === 'worlds' && <MyWorldsScreen />}
          {screen === 'load' && <LoadWorldScreen />}
          {screen === 'settings' && <SettingsScreen />}
        </div>
      )}
      <DialogHost />
      <Toasts />
    </>
  );
}
