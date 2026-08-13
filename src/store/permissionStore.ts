import { create } from 'zustand';
import { permissionService } from '../services/permission.service';

/**
 * Effective permissions for the signed-in user (Part 2).
 *
 * Loaded once after login and cached in memory. The backend is the authority —
 * this exists to hide navigation and disable controls the user cannot use, not
 * to enforce anything. Every guarded action is still checked server-side.
 */

interface PermissionState {
  permissions: string[];
  isSuperUser: boolean;
  roleName: string | null;
  loaded: boolean;
  loading: boolean;
  /** Which user the cached permissions belong to. */
  loadedForUserId: string | null;
  load: (userId: string) => Promise<void>;
  reset: () => void;
  can: (...codes: string[]) => boolean;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: [],
  isSuperUser: false,
  roleName: null,
  loaded: false,
  loading: false,
  loadedForUserId: null,

  load: async (userId: string) => {
    const state = get();
    if (state.loading) {
      return;
    }

    // Re-fetch when a different user signs in on the same browser, otherwise
    // the second user would inherit the first user's cached permissions.
    if (state.loaded && state.loadedForUserId === userId) {
      return;
    }

    set({ loading: true });
    try {
      const result = await permissionService.getMine();
      set({
        permissions: result.permissions,
        isSuperUser: result.isSuperUser,
        roleName: result.role?.name ?? null,
        loaded: true,
        loadedForUserId: userId
      });
    } catch {
      // A failure here must not lock the user out of the UI; the server still
      // enforces every action, so we fail open on presentation only.
      set({ permissions: [], isSuperUser: false, loaded: true, loadedForUserId: userId });
    } finally {
      set({ loading: false });
    }
  },

  reset: () =>
    set({ permissions: [], isSuperUser: false, roleName: null, loaded: false, loadedForUserId: null }),

  /** True if the user holds ANY of the given permission codes. */
  can: (...codes: string[]) => {
    const state = get();
    if (state.isSuperUser) {
      return true;
    }
    // Before permissions load, don't hide anything — avoids a nav flicker.
    if (!state.loaded) {
      return true;
    }
    return codes.some((code) => state.permissions.includes(code));
  }
}));
