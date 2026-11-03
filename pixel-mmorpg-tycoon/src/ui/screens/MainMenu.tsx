import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import { WorldRepository } from '@/persistence/WorldRepository';
import { loadAndOpenWorld } from '@/session/sessionActions';
import { useSessionStore } from '@/stores/sessionStore';
import { toast } from '@/stores/toastStore';
import type { WorldMeta } from '@/models/world';
import { PixelIcon } from '../components/PixelIcon';
import { LanguageSwitch } from '../components/LanguageSwitch';

export function MainMenu() {
  const go = useSessionStore((s) => s.go);
  const [latest, setLatest] = useState<WorldMeta | null>(null);

  useEffect(() => {
    WorldRepository.listWorlds()
      .then((w) => setLatest(w[0] ?? null))
      .catch((e) => toast(t('Storage unavailable: {msg}', { msg: (e as Error).message }), 'error'));
  }, []);

  const resume = async () => {
    if (latest && !(await loadAndOpenWorld(latest.id))) toast(t('Could not load that world.'), 'error');
  };

  return (
    <div className="menu-center">
      <div className="menu-title">
        <div className="pixel-title title-main">PIXEL</div>
        <div className="pixel-title title-sub">MMORPG TYCOON</div>
        <div className="title-tag">{t('Build a world. Watch it live.')}</div>
      </div>
      <div className="panel menu-buttons">
        {latest && (
          <button className="btn big primary" onClick={resume} title={t('Continue "{name}"', { name: latest.name })}>
            <PixelIcon name="play" /> {t('Continue')}
          </button>
        )}
        <button className="btn big" onClick={() => go('create')}>
          <PixelIcon name="map" /> {t('Create New World')}
        </button>
        <button className="btn big" onClick={() => go('worlds')}>
          <PixelIcon name="folder" /> {t('My Worlds')}
        </button>
        <button className="btn big" onClick={() => go('load')}>
          <PixelIcon name="import" /> {t('Load World')}
        </button>
        <button className="btn big" onClick={() => go('settings')}>
          <PixelIcon name="gear" /> {t('Settings')}
        </button>
        {latest && <div className="hint center">{t('Last played: {name}', { name: latest.name })}</div>}
      </div>
      <div className="menu-lang"><LanguageSwitch compact /></div>
      <div className="menu-version">v0.3.0 · {t('Phase 3 — RPG Systems')}</div>
    </div>
  );
}
