import { api } from './api';

/**
 * Daily financial records and the owner (Business Admin) approval gate.
 * Reports read approved figures only; see the backend controller for rules.
 */

export interface RevenueLine {
  source: string;
  label?: string;
  cash: number;
  card: number;
  transfer: number;
  online: number;
  other: number;
}
export interface ExpenseLine {
  category: string;
  description?: string;
  amount: number;
}
export interface PositionLine {
  account: string;
  type: 'CASH' | 'BANK' | 'POS_TERMINAL';
  opening: number;
  moneyIn: number;
  moneyOut: number;
  closing: number;
}
export interface DailyRecordData {
  revenue: RevenueLine[];
  cogs: number;
  expenses: ExpenseLine[];
  belowTheLine: { loanTaken: number; loanRepaid: number; ownerWithdrawal: number; capitalExpenditure: number; taxes: number };
  positions: PositionLine[];
  rooms: {
    available: number;
    sold: number;
    complimentary: number;
    outOfOrder: number;
    topRoomTypes: Array<{ roomType: string; sold: number; revenue: number }>;
    topRooms: Array<{ roomNumber: string; nights: number }>;
  };
  notes?: string;
}
export interface DailyTotals {
  revenueBySource: Record<string, number>;
  totalRevenue: number;
  cogs: number;
  grossProfit: number;
  expensesByCategory: Record<string, number>;
  operatingExpenses: number;
  netOperatingProfit: number;
  belowTheLine: DailyRecordData['belowTheLine'];
  rooms: { available: number; sold: number; complimentary: number; outOfOrder: number; occupancyPercent: number; averageRoomRate: number; roomRevenue: number };
  positions: Array<PositionLine & { expectedClosing: number; variance: number }>;
  cashVariance: number;
}
export type RecordStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'EDIT_REQUESTED';
export interface DailyRecord {
  id: string;
  businessDate: string;
  status: RecordStatus;
  version: number;
  data: DailyRecordData | null;
  totals: DailyTotals | null;
  pendingData: DailyRecordData | null;
  pendingTotals: DailyTotals | null;
  submittedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  editReason: string | null;
  revisions?: Array<{
    id: string;
    action: string;
    actor: string;
    requestedBy: string | null;
    note: string | null;
    createdAt: string;
    changes: Array<{ field: string; before: unknown; after: unknown }>;
  }>;
}
export interface CalendarDay {
  date: string;
  recordId: string | null;
  status: RecordStatus | null;
  colour: 'GREEN' | 'RED' | 'YELLOW' | 'NONE';
  hidden: boolean;
}
export interface AccessRequest {
  id: string;
  requestedBy: string;
  fromDate: string;
  toDate: string;
  scope: 'VIEW' | 'EDIT';
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  expiresAt: string | null;
  createdAt: string;
}
export interface Meta {
  revenueSources: Array<{ key: string; label: string }>;
  expenseCategories: Array<{ key: string; label: string }>;
  visibleFrom: string;
}

export const dailyRecords = {
  meta: async () => (await api.get('/finance/daily-records/meta')).data as Meta,
  prefill: async (date: string) => (await api.get('/finance/daily-records/prefill', { params: { date } })).data as { data: DailyRecordData; totals: DailyTotals },
  calendar: async (month: string) => (await api.get('/finance/daily-records/calendar', { params: { month } })).data as { month: string; visibleFrom: string; days: CalendarDay[] },
  list: async (from?: string, to?: string) => (await api.get('/finance/daily-records', { params: { from, to } })).data as { visibleFrom: string; truncated: boolean; records: DailyRecord[] },
  get: async (date: string) => (await api.get(`/finance/daily-records/${date}`)).data as DailyRecord,
  submit: async (businessDate: string, data: DailyRecordData) => (await api.post('/finance/daily-records', { businessDate, data })).data as DailyRecord,
  edit: async (id: string, data: DailyRecordData, reason: string) => (await api.put(`/finance/daily-records/${id}`, { data, reason })).data as DailyRecord,
  approve: async (id: string, note?: string) => (await api.post(`/finance/daily-records/${id}/approve`, { note })).data as DailyRecord,
  reject: async (id: string, note: string) => (await api.post(`/finance/daily-records/${id}/reject`, { note })).data as DailyRecord,
  pending: async () => (await api.get('/finance/approvals')).data as { records: DailyRecord[]; accessRequests: AccessRequest[] },
  summary: async (period: string, from?: string, to?: string) => (await api.get('/finance/reports/summary', { params: { period, from, to } })).data,
  accessRequests: async () => (await api.get('/finance/access-requests')).data as AccessRequest[],
  requestAccess: async (payload: { fromDate: string; toDate: string; scope: 'VIEW' | 'EDIT'; reason: string }) => (await api.post('/finance/access-requests', payload)).data as AccessRequest,
  decideAccess: async (id: string, decision: 'APPROVE' | 'REJECT', days?: number) => (await api.post(`/finance/access-requests/${id}/decide`, { decision, days })).data as AccessRequest
};

export const naira = (value: number) => `₦${(Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export const STATUS_LABEL: Record<RecordStatus, string> = {
  SUBMITTED: 'Awaiting approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EDIT_REQUESTED: 'Edit requested'
};
