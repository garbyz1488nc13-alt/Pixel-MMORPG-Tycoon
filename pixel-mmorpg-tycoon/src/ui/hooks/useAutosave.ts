import { useEffect } from 'react';
import type { GameSession } from '@/session/GameSession';
import { useSettingsStore } from '@/stores/settingsStore';

/** Periodically saves to the "auto" slot when there are unsaved changes. */
export function useAutosave(session: GameSession) {
  const minutes = useSettingsStore((s) => s.autosaveMinutes);
  useEffect(() => {
    if (!minutes) return;
    const id = window.setInterval(() => {
      if (session.runtime.dirty) session.save('auto', true);
    }, minutes * 60_000);
    return () => window.clearInterval(id);
  }, [session, minutes]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (session.runtime.dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [session]);
}
