import { create } from 'zustand';
import { uid } from '@/utils/id';

export interface ToastItem {
  id: string;
  message: string;
  tone: 'default' | 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

interface UiState {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, 'id'>) => string;
  dismiss: (id: string) => void;
}

export const useUi = create<UiState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts.slice(-1), { ...t, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  show: (message: string, opts: Partial<Omit<ToastItem, 'id' | 'message'>> = {}) =>
    useUi.getState().push({ message, tone: 'default', ...opts }),
  success: (message: string, opts: Partial<Omit<ToastItem, 'id' | 'message' | 'tone'>> = {}) =>
    useUi.getState().push({ message, tone: 'success', ...opts }),
  error: (message: string) => useUi.getState().push({ message, tone: 'error' }),
};
