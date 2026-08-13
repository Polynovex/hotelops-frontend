import { api } from './api';

/** Loyalty (Part 7 #11) and staff scheduling (Part 7 #12). */

export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
export type LoyaltyTxnType = 'EARN' | 'REDEEM' | 'ADJUST' | 'EXPIRE';
export type ScheduleStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'ABSENT' | 'CANCELLED';

export interface LoyaltyProgram {
  id: string;
  name: string;
  isActive: boolean;
  pointsPerNaira: number;
  nairaPerPoint: number;
  minRedemption: number;
  expiryMonths: number;
  silverThreshold: number;
  goldThreshold: number;
  platinumThreshold: number;
  stats: { members: number; pointsOutstanding: number; liabilityNgn: number };
}

export interface LoyaltyAccount {
  id: string;
  memberNumber: string;
  pointsBalance: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  enrolledAt: string;
  guest?: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null };
  transactions?: Array<{
    id: string;
    type: LoyaltyTxnType;
    points: number;
    balanceAfter: number;
    description: string | null;
    createdAt: string;
  }>;
  redeemableNgn?: number;
  canRedeem?: boolean;
}

export interface ShiftScheduleRecord {
  id: string;
  date: string;
  startsAt: string;
  endsAt: string;
  position: string | null;
  notes: string | null;
  status: ScheduleStatus;
  staff?: { id: string; firstName: string; lastName: string; jobTitle: string | null };
}

const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export const loyaltyService = {
  async getProgram(): Promise<LoyaltyProgram> {
    const { data } = await api.get('/loyalty/program');
    return data as LoyaltyProgram;
  },
  async updateProgram(payload: Partial<LoyaltyProgram>) {
    const { data } = await api.put('/loyalty/program', payload);
    return data as LoyaltyProgram;
  },
  async listAccounts() {
    const { data } = await api.get('/loyalty/accounts');
    return list<LoyaltyAccount>(data);
  },
  async getAccount(id: string) {
    const { data } = await api.get(`/loyalty/accounts/${id}`);
    return data as LoyaltyAccount;
  },
  async enroll(guestId: string) {
    const { data } = await api.post('/loyalty/enroll', { guestId });
    return data as LoyaltyAccount;
  },
  async earn(id: string, payload: { amountNgn?: number; points?: number; description?: string }) {
    const { data } = await api.post(`/loyalty/accounts/${id}/earn`, payload);
    return data;
  },
  async redeem(id: string, points: number, description?: string) {
    const { data } = await api.post(`/loyalty/accounts/${id}/redeem`, { points, description });
    return data;
  },
  async adjust(id: string, points: number, reason: string) {
    const { data } = await api.post(`/loyalty/accounts/${id}/adjust`, { points, reason });
    return data;
  }
};

export const scheduleService = {
  async list(params?: { from?: string; to?: string; staffId?: string }) {
    const { data } = await api.get('/schedules', { params });
    return list<ShiftScheduleRecord>(data);
  },
  async mine() {
    const { data } = await api.get('/schedules/my');
    return {
      staffId: (data?.staffId as string | null) ?? null,
      schedules: list<ShiftScheduleRecord>(data?.schedules)
    };
  },
  async create(payload: {
    staffId: string;
    startsAt: string;
    endsAt: string;
    position?: string;
    notes?: string;
  }) {
    const { data } = await api.post('/schedules', payload);
    return data as ShiftScheduleRecord;
  },
  async update(id: string, payload: Partial<ShiftScheduleRecord>) {
    const { data } = await api.put(`/schedules/${id}`, payload);
    return data as ShiftScheduleRecord;
  },
  async remove(id: string) {
    const { data } = await api.delete(`/schedules/${id}`);
    return data;
  }
};

export const TIER_COLOR: Record<LoyaltyTier, 'default' | 'info' | 'warning' | 'secondary'> = {
  BRONZE: 'default',
  SILVER: 'info',
  GOLD: 'warning',
  PLATINUM: 'secondary'
};

export const SCHEDULE_STATUS_COLOR: Record<
  ScheduleStatus,
  'default' | 'info' | 'success' | 'error' | 'warning'
> = {
  SCHEDULED: 'default',
  CONFIRMED: 'info',
  COMPLETED: 'success',
  ABSENT: 'error',
  CANCELLED: 'warning'
};
