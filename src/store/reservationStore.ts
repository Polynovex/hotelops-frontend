import { create } from 'zustand';
import { BookingSummary } from '../services/api';

interface ReservationFilters {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

interface ReservationState {
  filters: ReservationFilters;
  selectedReservation: BookingSummary | null;
  setFilters: (filters: Partial<ReservationFilters>) => void;
  clearFilters: () => void;
  selectReservation: (reservation: BookingSummary | null) => void;
}

const initialFilters: ReservationFilters = {};

export const useReservationStore = create<ReservationState>((set) => ({
  filters: initialFilters,
  selectedReservation: null,
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  clearFilters: () => set({ filters: initialFilters }),
  selectReservation: (reservation) => set({ selectedReservation: reservation })
}));
