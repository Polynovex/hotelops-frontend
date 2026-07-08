import { create } from 'zustand';
import { BusinessSummary, superAdminService } from '../services/api';

interface BusinessState {
  currentBusiness: BusinessSummary | null;
  businesses: BusinessSummary[];
  setCurrentBusiness: (business: BusinessSummary) => void;
  loadBusinesses: () => Promise<void>;
  updateBusiness: (id: string, data: Partial<BusinessSummary>) => Promise<void>;
}

export const useBusinessStore = create<BusinessState>((set) => ({
  currentBusiness: null,
  businesses: [],
  setCurrentBusiness: (business) => set({ currentBusiness: business }),
  loadBusinesses: async () => {
    const businesses = await superAdminService.getBusinesses();
    set({ businesses });
  },
  updateBusiness: async (id, data) => {
    await superAdminService.updateBusiness(id, data);
    set((state) => ({
      businesses: state.businesses.map((business) =>
        business.id === id ? { ...business, ...data } : business
      ),
      currentBusiness:
        state.currentBusiness?.id === id
          ? { ...state.currentBusiness, ...data }
          : state.currentBusiness
    }));
  }
}));
