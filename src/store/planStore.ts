import { create } from 'zustand';

/**
 * What the business's plan includes, for the signed-in user.
 *
 * Promotions and full finance (the ledger, statements, USALI and forecasting)
 * come with Professional and Enterprise; the loyalty programme with Enterprise
 * only; guest feedback, PMS, POS and basic finance are on every plan. Banquet
 * & events, minibar and HR are switched per business. The server enforces this on every request; this
 * store only hides what the plan does not include, so nobody lands on a page
 * that will be refused.
 */

export type PlanFeature = 'EVENTS' | 'PROMOTIONS' | 'FULL_FINANCE' | 'HR' | 'INVENTORY' | 'LOYALTY' | 'FEEDBACK' | string;

/** An add-on the business has switched on (pool, spa, a custom one...). */
export interface ActiveAddOn {
  code: string;
  name: string;
  icon: string;
  behavior: 'OUTLET' | 'MINIBAR' | 'EVENTS';
  outletId: string | null;
}

interface PlanState {
  plan: { code: string; name: string } | null;
  features: Record<string, boolean>;
  /** Which core products the business runs. Finance is always on. */
  products: { pms: boolean; pos: boolean; finance: boolean; hr: boolean } | null;
  addOns: ActiveAddOn[];
  /** Name and contacts printed on receipts. */
  business: { name: string; address: string | null; phone: string | null; email: string | null; website: string | null; logoUrl: string | null } | null;
  loaded: boolean;
  loadedForUserId: string | null;
  /** Loads once per user; `force` reloads, so changes made by HotelOpX show without signing out. */
  load: (userId: string, force?: boolean) => Promise<void>;
  reset: () => void;
  /** True until the plan has loaded, so nothing flickers away and back. */
  has: (feature: PlanFeature) => boolean;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  plan: null,
  features: {},
  products: null,
  addOns: [],
  business: null,
  loaded: false,
  loadedForUserId: null,

  load: async (userId: string, force = false) => {
    if (!force && get().loaded && get().loadedForUserId === userId) return;
    try {
      // Imported here, not at the top: the API client imports the auth store,
      // and a top-level import from App created a circular load.
      const { api } = await import('../services/api');
      const { data } = await api.get('/me/plan');
      set({
        plan: data.plan ?? null,
        features: data.features ?? {},
        products: data.products ?? null,
        addOns: Array.isArray(data.addOns) ? data.addOns : [],
        business: data.business ?? null,
        loaded: true,
        loadedForUserId: userId
      });
    } catch {
      // Presentation only: on failure keep what we had, or show everything,
      // and let the server decide.
      if (!get().loaded) set({ plan: null, features: {}, products: null, addOns: [], loaded: false, loadedForUserId: userId });
    }
  },

  reset: () => set({ plan: null, features: {}, products: null, addOns: [], loaded: false, loadedForUserId: null }),

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
  if (p.startsWith('/business/minibar')) return 'MINIBAR';
  // HR & payroll is switched per business.
  if (p.startsWith('/business/hr')) return 'HR';
  if (p.startsWith('/business/promotions')) return 'PROMOTIONS';
  if (p.startsWith('/business/loyalty')) return 'LOYALTY';
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
  MINIBAR: 'Minibar',
  HR: 'HR & payroll',
  EVENTS: 'Banquet & events',
  PROMOTIONS: 'Promotions',
  FULL_FINANCE: 'Full finance (ledger, statements, USALI and forecasting)',
  LOYALTY: 'The loyalty programme'
};
