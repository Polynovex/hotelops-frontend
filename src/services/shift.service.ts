import { api } from './api';
import { useAuthStore } from '../store/authStore';

const isDemoMode = () => useAuthStore.getState().token?.startsWith('demo-token');
const DEMO_SHIFT_KEY = 'hotelopx.v3.demo-shift';

const getDemoShift = (): Shift | null => {
  const raw = localStorage.getItem(DEMO_SHIFT_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Shift; } catch { return null; }
};
const setDemoShift = (shift: Shift | null) =>
  shift ? localStorage.setItem(DEMO_SHIFT_KEY, JSON.stringify(shift)) : localStorage.removeItem(DEMO_SHIFT_KEY);

const makeDemoShift = (openingCash: number, notes?: string): Shift => {
  const user = useAuthStore.getState().user;
  return {
    id: `demo-shift-${Date.now()}`,
    hotelId: user?.hotelId || 'demo-hotel-1',
    userId: user?.id || 'demo-user',
    status: 'OPEN',
    openedAt: new Date().toISOString(),
    openingCash,
    totalSales: 0,
    totalRefunds: 0,
    totalDiscounts: 0,
    notes
  };
};

export type ShiftStatus = 'OPEN' | 'ON_BREAK' | 'CLOSED';
export type ShiftEventType = 'OPEN' | 'BREAK_START' | 'BREAK_END' | 'CLOSE' | 'FORCE_CLOSE';

export interface Shift {
  id: string;
  hotelId: string;
  userId: string;
  outletId?: string;
  terminalId?: string;
  status: ShiftStatus;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  cashVariance?: number;
  totalSales: number;
  totalRefunds: number;
  totalDiscounts: number;
  notes?: string;
}

export interface ShiftEvent {
  id: string;
  shiftId: string;
  userId: string;
  eventType: ShiftEventType;
  occurredAt: string;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
}

export interface ShiftListParams {
  userId?: string;
  status?: ShiftStatus;
  from?: string;
  to?: string;
  outletId?: string;
  page?: number;
  pageSize?: number;
}

export const shiftService = {
  getMine: async (): Promise<{ shift: Shift | null }> => {
    if (isDemoMode()) return { shift: getDemoShift() };
    const { data } = await api.get('/shifts/me');
    return data;
  },
  open: async (payload: {
    openingCash: number;
    outletId?: string;
    terminalId?: string;
    notes?: string;
  }): Promise<Shift> => {
    if (isDemoMode()) {
      const user = useAuthStore.getState().user;
      const canOpenShift = user?.role === 'POS_STAFF' || user?.role === 'RECEPTIONIST' || user?.role === 'ACCOUNTANT';
      if (!canOpenShift) {
        throw new Error('Your role does not have permission to open shifts. Only POS staff, receptionists, and accountants can open shifts.');
      }
      const shift = makeDemoShift(payload.openingCash, payload.notes);
      setDemoShift(shift);
      return shift;
    }
    const { data } = await api.post('/shifts/open', payload);
    return data;
  },
  startBreak: async (notes?: string): Promise<{ shift: Shift; message: string }> => {
    if (isDemoMode()) {
      const shift = getDemoShift();
      if (shift) { shift.status = 'ON_BREAK'; setDemoShift(shift); }
      return { shift: shift!, message: 'Break started' };
    }
    const { data } = await api.post('/shifts/break/start', { notes });
    return data;
  },
  endBreak: async (): Promise<{ shift: Shift }> => {
    if (isDemoMode()) {
      const shift = getDemoShift();
      if (shift) { shift.status = 'OPEN'; setDemoShift(shift); }
      return { shift: shift! };
    }
    const { data } = await api.post('/shifts/break/end', {});
    return data;
  },
  close: async (payload: {
    closingCash: number;
    notes?: string;
  }): Promise<{
    shift: Shift;
    summary: {
      totalSales: number;
      totalDiscounts: number;
      expectedCash: number;
      cashVariance: number;
    };
  }> => {
    if (isDemoMode()) {
      const shift = getDemoShift();
      const closed: Shift = {
        ...(shift || makeDemoShift(0)),
        status: 'CLOSED',
        closedAt: new Date().toISOString(),
        closingCash: payload.closingCash
      };
      setDemoShift(null);
      return {
        shift: closed,
        summary: {
          totalSales: closed.totalSales,
          totalDiscounts: closed.totalDiscounts,
          expectedCash: closed.openingCash + closed.totalSales,
          cashVariance: payload.closingCash - (closed.openingCash + closed.totalSales)
        }
      };
    }
    const { data } = await api.post('/shifts/close', payload);
    return data;
  },
  list: async (params: ShiftListParams = {}) => {
    if (isDemoMode()) {
      const shift = getDemoShift();
      return { items: shift ? [shift] : [], total: shift ? 1 : 0, page: 1, pageSize: 50 };
    }
    const { data } = await api.get('/shifts', { params });
    return data as { items: Array<Shift & { user: any; _count: { events: number } }>; total: number; page: number; pageSize: number };
  },
  get: async (id: string) => {
    if (isDemoMode()) {
      const shift = getDemoShift();
      return { ...(shift || makeDemoShift(0)), events: [], user: null, posOrders: [] };
    }
    const { data } = await api.get(`/shifts/${id}`);
    return data as Shift & { events: ShiftEvent[]; user: any; posOrders: any[] };
  },
  forceClose: async (id: string) => {
    if (isDemoMode()) {
      setDemoShift(null);
      return { ...(getDemoShift() || makeDemoShift(0)), status: 'CLOSED' as ShiftStatus };
    }
    const { data } = await api.post(`/shifts/${id}/force-close`, {});
    return data as Shift;
  }
};
