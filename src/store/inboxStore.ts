import { create } from 'zustand';
import { api } from '../services/api';

/**
 * The header notification centre's data.
 *
 * Server-backed, unlike `notificationStore` (which holds transient UI
 * messages): these survive a reload and are marked read per user. The server
 * merges housekeeping notifications with HR, POS and finance ones into one
 * newest-first list.
 */

export interface InboxItem {
  id: string;
  category: 'HOUSEKEEPING' | 'HR' | 'POS' | 'FINANCE' | 'SYSTEM' | string;
  type: string;
  title: string | null;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface InboxState {
  items: InboxItem[];
  unreadCount: number;
  loaded: boolean;
  /** Fetches the inbox and returns the unread items that were not seen before. */
  refresh: () => Promise<InboxItem[]>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  reset: () => void;
}

export const useInboxStore = create<InboxState>((set, get) => ({
  items: [],
  unreadCount: 0,
  loaded: false,

  refresh: async () => {
    const { data } = await api.get('/notifications/inbox');
    const items: InboxItem[] = Array.isArray(data?.items) ? data.items : [];
    const known = new Set(get().items.map((item) => item.id));
    const wasLoaded = get().loaded;

    set({ items, unreadCount: Number(data?.unreadCount) || 0, loaded: true });

    // Nothing is "new" on the first load — that is just the backlog, and
    // chiming for all of it on sign-in would be noise.
    return wasLoaded ? items.filter((item) => !item.isRead && !known.has(item.id)) : [];
  },

  markRead: async (id) => {
    const target = get().items.find((item) => item.id === id);
    if (!target || target.isRead) return;

    // Optimistic: the bell should respond to the click, not to the network.
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
      unreadCount: Math.max(state.unreadCount - 1, 0)
    }));
    await api.put(`/notifications/inbox/${id}/read`).catch(() => undefined);
  },

  markAllRead: async () => {
    set((state) => ({
      items: state.items.map((item) => ({ ...item, isRead: true })),
      unreadCount: 0
    }));
    await api.put('/notifications/inbox/read-all').catch(() => undefined);
  },

  reset: () => set({ items: [], unreadCount: 0, loaded: false })
}));
