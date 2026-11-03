import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      reset: () => set(DEFAULT_SETTINGS),
    }),
    { name: 'pmt-settings', version: 2, migrate: (s) => ({ ...DEFAULT_SETTINGS, ...(s as object) }) },
  ),
);
