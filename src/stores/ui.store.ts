import { create } from 'zustand';
import type { Theme, ViewMode, MobileMode, ConfirmState, ToastItem } from '../types/models';
import { THEME_STORAGE_KEY, TOAST_DURATION_MS } from '../config/constants';

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* 忽略 */
  }
  return 'system';
}

let toastSeq = 0;

interface UiState {
  theme: Theme;
  setTheme: (theme: Theme) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  mobileMode: MobileMode;
  setMobileMode: (mode: MobileMode) => void;

  splitRatio: number;
  setSplitRatio: (ratio: number) => void;

  confirm: ConfirmState | null;
  openConfirm: (state: ConfirmState) => void;
  closeConfirm: () => void;

  toasts: ToastItem[];
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: number) => void;
}

export const useUiStore = create<UiState>()((set, get) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => set({ theme }),

  sidebarCollapsed: false,
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
  mobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),

  viewMode: 'split',
  setViewMode: (mode) => set({ viewMode: mode }),
  mobileMode: 'edit',
  setMobileMode: (mode) => set({ mobileMode: mode }),

  splitRatio: 0.5,
  setSplitRatio: (ratio) => set({ splitRatio: Math.min(0.7, Math.max(0.3, ratio)) }),

  confirm: null,
  openConfirm: (state) => set({ confirm: state }),
  closeConfirm: () => set({ confirm: null }),

  toasts: [],
  pushToast: (toast) => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts, { ...toast, id }] });
    if (toast.kind !== 'error') {
      setTimeout(() => get().dismissToast(id), TOAST_DURATION_MS);
    }
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
