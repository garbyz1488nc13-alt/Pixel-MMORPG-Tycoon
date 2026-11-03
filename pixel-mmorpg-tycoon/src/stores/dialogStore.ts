import { create } from 'zustand';

interface DialogRequest {
  kind: 'confirm' | 'prompt';
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  defaultValue?: string;
  resolve: (value: string | boolean | null) => void;
}

interface DialogState {
  current: DialogRequest | null;
  open: (r: DialogRequest) => void;
  close: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  current: null,
  open: (current) => set({ current }),
  close: () => set({ current: null }),
}));

export function confirmDialog(opts: { title: string; message?: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => useDialogStore.getState().open({ kind: 'confirm', ...opts, resolve: (v) => resolve(v === true) }));
}

export function promptDialog(opts: { title: string; message?: string; defaultValue?: string; confirmLabel?: string }): Promise<string | null> {
  return new Promise((resolve) =>
    useDialogStore.getState().open({ kind: 'prompt', ...opts, resolve: (v) => resolve(typeof v === 'string' ? v : null) }),
  );
}
