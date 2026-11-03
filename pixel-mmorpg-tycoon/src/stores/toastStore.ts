import { create } from 'zustand';

export interface Toast { id: number; text: string; kind: 'info' | 'success' | 'error' }
let id = 1;

interface ToastState {
  toasts: Toast[];
  show: (text: string, kind?: Toast['kind']) => void;
  dismiss: (id: number) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (text, kind = 'info') => {
    const t = { id: id++, text, kind };
    set({ toasts: [...get().toasts.slice(-3), t] });
    setTimeout(() => get().dismiss(t.id), 2600);
  },
  dismiss: (tid) => set({ toasts: get().toasts.filter((t) => t.id !== tid) }),
}));

export const toast = (text: string, kind?: Toast['kind']) => useToastStore.getState().show(text, kind);
