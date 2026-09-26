import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>, durationMs?: number) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast, durationMs = 4000) => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-3), { ...toast, id }] });
    if (durationMs > 0) setTimeout(() => get().dismiss(id), durationMs);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  success: (title: string, body?: string) => useToasts.getState().push({ title, body, tone: 'success' }),
  error: (title: string, body?: string) => useToasts.getState().push({ title, body, tone: 'error' }, 6000),
  info: (title: string, body?: string, action?: Toast['action']) => useToasts.getState().push({ title, body, tone: 'info', action }),
};
