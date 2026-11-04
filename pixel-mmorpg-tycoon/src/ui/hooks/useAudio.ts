import { useEffect } from 'react';
import { audio } from '@/audio/AudioEngine';
import type { GameSession } from '@/session/GameSession';
import { useSettingsStore } from '@/stores/settingsStore';

/** Keep the audio engine in sync with settings; unlock it on the first user gesture. */
export function useAudioSettings(): void {
  const sfx = useSettingsStore((s) => s.sfxVolume);
  const music = useSettingsStore((s) => s.musicVolume);
  useEffect(() => audio.setVolumes(sfx, music), [sfx, music]);
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
}

/** Background music while a world is open; battle music while a raid fights a boss. */
export function useWorldMusic(session: GameSession): void {
  useEffect(() => {
    audio.startMusic();
    const timer = window.setInterval(() => {
      const fighting = session.runtime.sim.raids.some((r) => r.phase === 'fighting') && session.engine.isRunning;
      audio.setMood(fighting ? 'battle' : 'calm');
    }, 1000);
    return () => {
      window.clearInterval(timer);
      audio.stopMusic();
    };
  }, [session]);
}
