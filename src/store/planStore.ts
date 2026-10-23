import { create } from 'zustand';

/**
 * What the business's plan includes, for the signed-in user.
 *
 * Banquet & events, promotions and full finance (the ledger, statements, USALI
 * and forecasting) are Enterprise only; guest feedback, PMS, POS and basic
 * finance are on every plan. The server enforces this on every request; this
 * store only hides what the plan does not include, so nobody lands on a page
 * that will be refused.
 */

export type PlanFeature = 'EVENTS' | 'PROMOTIONS' | 'FULL_FINANCE' | 'HR' | 'INVENTORY' | 'LOYALTY' | 'FEEDBACK' | string;

interface PlanState {
  plan: { code: string; name: string } | null;
  features: Record<string, boolean>;
  loaded: boolean;
  loadedForUserId: string | null;
  load: (userId: string) => Promise<void>;
  reset: () => void;
  /** True until the plan has loaded, so nothing flickers away and back. */
  has: (feature: PlanFeature) => boolean;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  plan: null,
  features: {},
  loaded: false,
  loadedForUserId: null,

  load: async (userId: string) => {
    if (get().loaded && get().loadedForUserId === userId) return;
    try {
      // Imported here, not at the top: the API client imports the auth store,
      // and a top-level import from App created a circular load.
      const { api } = await import('../services/api');
      const { data } = await api.get('/me/plan');
      set({ plan: data.plan ?? null, features: data.features ?? {}, loaded: true, loadedForUserId: userId });
    } catch {
      // Presentation only: on failure show everything and let the server decide.
      set({ plan: null, features: {}, loaded: false, loadedForUserId: userId });
    }
  },

  reset: () => set({ plan: null, features: {}, loaded: false, loadedForUserId: null }),

  has: (feature) => {
    const state = get();
    if (!state.loaded) return true;
    return state.features[feature] !== false;
  }
}));

/** Which plan feature a dashboard address needs, if any. */
export const featureForPath = (path: string): PlanFeature | null => {
  const p = path.split('?')[0];
  if (p.startsWith('/business/events')) return 'EVENTS';
  if (p.startsWith('/business/promotions')) return 'PROMOTIONS';
  if (
    [
      '/business/accounting/forecasting',
      '/business/accounting/chart-of-accounts',
      '/business/accounting/journals',
      '/business/accounting/bank-reconciliation',
      '/business/accounting/budgets',
      '/business/accounting/fixed-assets',
      '/business/accounting/reports',
      '/accountant/aging',
      '/accountant/vat',
      '/accountant/trial-balance'
    ].some((prefix) => p === prefix || p.startsWith(`${prefix}/`))
  ) {
    return 'FULL_FINANCE';
  }
  return null;
};

export const FEATURE_LABEL: Record<string, string> = {
  EVENTS: 'Banquet & events',
  PROMOTIONS: 'Promotions',
  FULL_FINANCE: 'Full finance (ledger, statements, USALI and forecasting)'
};
