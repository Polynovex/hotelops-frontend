import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api/auth';
import { syncAuthTokenToDesktop } from '../services/desktopBridge';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: string;
  hotelId?: string;
  hotelName?: string;
  logoUrl?: string | null;
  pmsEnabled?: boolean;
  posEnabled?: boolean;
  financeEnabled?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string, refreshToken?: string | null) => void;
  setUser: (user: Partial<User>) => void;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  verifyMfa: (_code: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      setAuth: (user, token, refreshToken) => {
        void syncAuthTokenToDesktop(token);
        set({
          user,
          token,
          refreshToken: refreshToken ?? null,
          isAuthenticated: true
        });
      },
      setUser: (changes) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...changes } : state.user
        })),
      login: async (email, password, remember) => {
        set({ isLoading: true });
        try {
          const response = await authApi.login(email, password);
          const persistedRefresh =
            remember && response.refreshToken
              ? response.refreshToken
              : remember
                ? `remember-${Date.now()}`
                : null;
          set({
            user: response.user,
            token: response.token,
            refreshToken: persistedRefresh,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
      refreshAccessToken: async () => {
        const current = get();
        if (!current.token) {
          throw new Error('No active session');
        }

        set({ token: current.token });
      },
      verifyMfa: async (_code) => {
        // Placeholder for MFA flow; backend endpoint can be wired when available.
        return Promise.resolve();
      },
      logout: () => {
        void syncAuthTokenToDesktop(null);
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false
        });
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
