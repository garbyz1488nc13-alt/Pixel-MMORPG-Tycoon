import { useEffect, useState } from 'react';
import { WorldRepository } from '@/persistence/WorldRepository';
import { loadAndOpenWorld } from '@/session/sessionActions';
import { useSessionStore } from '@/stores/sessionStore';
import { toast } from '@/stores/toastStore';
import type { WorldMeta } from '@/models/world';
import { PixelIcon } from '../components/PixelIcon';

export function MainMenu() {
  const go = useSessionStore((s) => s.go);
  const [latest, setLatest] = useState<WorldMeta | null>(null);

  useEffect(() => {
    WorldRepository.listWorlds()
      .then((w) => setLatest(w[0] ?? null))
      .catch((e) => toast(`Storage unavailable: ${(e as Error).message}`, 'error'));
  }, []);

  const resume = async () => {
    if (latest && !(await loadAndOpenWorld(latest.id))) toast('Could not load that world.', 'error');
  };

  return (
    <div className="menu-center">
      <div className="menu-title">
        <div className="pixel-title title-main">PIXEL</div>
        <div className="pixel-title title-sub">MMORPG TYCOON</div>
        <div className="title-tag">Build a world. Watch it live.</div>
      </div>
      <div className="panel menu-buttons">
        {latest && (
          <button className="btn big primary" onClick={resume} title={`Continue "${latest.name}"`}>
            <PixelIcon name="play" /> Continue
          </button>
        )}
        <button className="btn big" onClick={() => go('create')}>
          <PixelIcon name="map" /> Create New World
        </button>
        <button className="btn big" onClick={() => go('worlds')}>
          <PixelIcon name="folder" /> My Worlds
        </button>
        <button className="btn big" onClick={() => go('load')}>
          <PixelIcon name="import" /> Load World
        </button>
        <button className="btn big" onClick={() => go('settings')}>
          <PixelIcon name="gear" /> Settings
        </button>
        {latest && <div className="hint center">Last played: {latest.name}</div>}
      </div>
      <div className="menu-version">v0.1.0 · Phase 1 — Foundation</div>
    </div>
  );
}
