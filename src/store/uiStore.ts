import { create } from 'zustand';

export interface UINotification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  notifications: UINotification[];
  addNotification: (notification: UINotification) => void;
  removeNotification: (id: string) => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'light',
  notifications: [],
  addNotification: (notification) =>
    set((state) => ({ notifications: [notification, ...state.notifications] })),
  removeNotification: (id) =>
    set((state) => ({ notifications: state.notifications.filter((item) => item.id !== id) })),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => set({ theme })
}));
