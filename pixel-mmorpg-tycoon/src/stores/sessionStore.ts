import { create } from 'zustand';
import type { GameSession } from '@/session/GameSession';
import type { SaveSlotKey } from '@/models/world';
import type { SimSpeed } from '@/simulation/types';

export type Screen = 'menu' | 'create' | 'worlds' | 'load' | 'settings' | 'editor';

interface SessionState {
  screen: Screen;
  session: GameSession | null;
  worldName: string;
  /** Mirrors of simulation state for the UI (updated by GameSession). */
  running: boolean;
  speed: SimSpeed;
  gameMinutes: number;
  dirty: boolean;
  lastSavedAt: number | null;
  slot: SaveSlotKey;
  saving: boolean;
  go: (screen: Screen) => void;
  patch: (p: Partial<SessionState>) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  screen: 'menu',
  session: null,
  worldName: '',
  running: false,
  speed: 1,
  gameMinutes: 0,
  dirty: false,
  lastSavedAt: null,
  slot: 'slot1',
  saving: false,
  go: (screen) => set({ screen }),
  patch: (p) => set(p),
}));
