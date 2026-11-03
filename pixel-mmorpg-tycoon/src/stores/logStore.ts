import { create } from 'zustand';

export type LogChannel = 'event' | 'sim' | 'system';
export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  channel: LogChannel;
  level: LogLevel;
  text: string;
  /** Real timestamp. */
  at: number;
  /** In-game minutes at the moment of logging, if a world is open. */
  gameMinutes?: number;
}

const MAX_ENTRIES = 300;
let nextId = 1;

interface LogState {
  entries: LogEntry[];
  push: (e: Omit<LogEntry, 'id' | 'at'>) => void;
  clear: () => void;
}

export const useLogStore = create<LogState>((set) => ({
  entries: [],
  push: (e) =>
    set((s) => {
      const entries = [...s.entries, { ...e, id: nextId++, at: Date.now() }];
      return { entries: entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries };
    }),
  clear: () => set({ entries: [] }),
}));

/** Convenience logger usable outside React. */
export const log = {
  system: (text: string, level: LogLevel = 'info', gameMinutes?: number) => useLogStore.getState().push({ channel: 'system', level, text, gameMinutes }),
  sim: (text: string, level: LogLevel = 'info', gameMinutes?: number) => useLogStore.getState().push({ channel: 'sim', level, text, gameMinutes }),
  event: (text: string, level: LogLevel = 'info', gameMinutes?: number) => useLogStore.getState().push({ channel: 'event', level, text, gameMinutes }),
};
