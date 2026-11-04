import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { detectLang, setLang, type Lang } from '@/i18n';

export interface Settings {
  /** 0 = autosave disabled. */
  autosaveMinutes: number;
  showGrid: boolean;
  /** Keyboard camera pan speed in screen pixels per second. */
  panSpeed: number;
  /** Zoom multiplier per mouse-wheel notch. */
  zoomStep: number;
  showFps: boolean;
  animateTiles: boolean;
  dayNightTint: boolean;
  showRegions: boolean;
  language: Lang;
  /** 0..1 */
  sfxVolume: number;
  /** 0..1 */
  musicVolume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  autosaveMinutes: 2,
  showGrid: true,
  panSpeed: 700,
  zoomStep: 1.15,
  showFps: true,
  animateTiles: true,
  dayNightTint: true,
  showRegions: true,
  language: detectLang(),
  sfxVolume: 0.5,
  musicVolume: 0.3,
};

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
      reset: () => set((s) => ({ ...DEFAULT_SETTINGS, language: s.language })),
    }),
    {
      name: 'pmt-settings',
      version: 4,
      migrate: (s) => ({ ...DEFAULT_SETTINGS, ...(s as object) }),
      onRehydrateStorage: () => (state) => state && setLang(state.language),
    },
  ),
);

// Keep the translator in sync with the stored language.
setLang(useSettingsStore.getState().language);
useSettingsStore.subscribe((s) => setLang(s.language));
