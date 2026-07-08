import { api } from './api';
import { useAuthStore } from '../store/authStore';

export type AnomalyType =
  | 'CASH_VARIANCE_HIGH'
  | 'DISCOUNT_RATE_OUTLIER'
  | 'VOID_RATE_HIGH'
  | 'LOGIN_FROM_NEW_IP'
  | 'FORCED_SHIFT_CLOSE'
  | 'SHIFT_TOO_LONG';

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AnomalyStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';

export interface AnomalyFlag {
  id: string;
  hotelId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  subjectUserId?: string | null;
  shiftId?: string | null;
  title: string;
  detail: string;
  evidence: Record<string, unknown>;
  detectedAt: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  subjectUser?: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    userCode?: string | null;
  } | null;
}

export interface AnomalyListResponse {
  items: AnomalyFlag[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<AnomalyStatus, number>;
}

const DEMO_MODE_ENABLED = import.meta.env.VITE_ENABLE_DEMO_MODE !== 'false';
const isDemoMode = () => DEMO_MODE_ENABLED && useAuthStore.getState().token?.startsWith('demo-token');

// Demo fixtures — six representative anomalies so the page tells a story.
const DEMO_FLAGS: AnomalyFlag[] = [
  {
    id: 'demo-anom-1',
    hotelId: 'demo-hotel-1',
    type: 'CASH_VARIANCE_HIGH',
    severity: 'CRITICAL',
    status: 'OPEN',
    subjectUserId: 'demo-u-pos',
    shiftId: 'demo-shift-1',
    title: 'Cash variance 8.2% on shift',
    detail: 'POS Staff closed with ₦24,500 difference between expected (₦298,500) and counted cash.',
    evidence: {
      openingCash: 20000,
      totalSales: 278500,
      expectedCash: 298500,
      closingCash: 274000,
      variance: -24500,
      ratio: 0.082
    },
    detectedAt: new Date(Date.now() - 3600_000 * 6).toISOString(),
    subjectUser: { id: 'demo-u-pos', firstName: 'POS', lastName: 'Staff', role: 'POS_STAFF', userCode: '40001' }
  },
  {
    id: 'demo-anom-2',
    hotelId: 'demo-hotel-1',
    type: 'DISCOUNT_RATE_OUTLIER',
    severity: 'HIGH',
    status: 'OPEN',
    subjectUserId: 'demo-u-rcp',
    title: 'Discount rate above peer median',
    detail: 'Front Desk applied ₦42,000 of discounts (3.5× the peer median of ₦12,000).',
    evidence: { totalSaved: 42000, peerMedian: 12000, applications: 14, multiplier: 3.5 },
    detectedAt: new Date(Date.now() - 3600_000 * 10).toISOString(),
    subjectUser: { id: 'demo-u-rcp', firstName: 'Front', lastName: 'Desk', role: 'RECEPTIONIST', userCode: '30001' }
  },
  {
    id: 'demo-anom-3',
    hotelId: 'demo-hotel-1',
    type: 'VOID_RATE_HIGH',
    severity: 'MEDIUM',
    status: 'ACKNOWLEDGED',
    subjectUserId: 'demo-u-pos',
    shiftId: 'demo-shift-2',
    title: '32% voided orders on shift',
    detail: 'POS Staff voided 8 of 25 orders during their shift.',
    evidence: { totalOrders: 25, voided: 8, ratio: 0.32 },
    detectedAt: new Date(Date.now() - 3600_000 * 22).toISOString(),
    acknowledgedAt: new Date(Date.now() - 3600_000 * 5).toISOString(),
    acknowledgedBy: 'demo-u-mgr',
    subjectUser: { id: 'demo-u-pos', firstName: 'POS', lastName: 'Staff', role: 'POS_STAFF', userCode: '40001' }
  },
  {
    id: 'demo-anom-4',
    hotelId: 'demo-hotel-1',
    type: 'LOGIN_FROM_NEW_IP',
    severity: 'LOW',
    status: 'OPEN',
    subjectUserId: 'demo-u-acc',
    title: 'Login from a new IP address',
    detail: 'Successful login by 60001 from a previously unseen IP (102.89.34.17).',
    evidence: { ipAddress: '102.89.34.17', identifier: '60001' },
    detectedAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
    subjectUser: { id: 'demo-u-acc', firstName: 'Finance', lastName: 'Officer', role: 'ACCOUNTANT', userCode: '60001' }
  },
  {
    id: 'demo-anom-5',
    hotelId: 'demo-hotel-1',
    type: 'SHIFT_TOO_LONG',
    severity: 'MEDIUM',
    status: 'OPEN',
    subjectUserId: 'demo-u-rcp',
    shiftId: 'demo-shift-3',
    title: 'Shift open 18.4 hours without close',
    detail: 'Front Desk has not closed their shift. Likely a forgot-to-close.',
    evidence: { hours: 18.4, openedAt: new Date(Date.now() - 18.4 * 3600_000).toISOString() },
    detectedAt: new Date(Date.now() - 1800_000).toISOString(),
    subjectUser: { id: 'demo-u-rcp', firstName: 'Front', lastName: 'Desk', role: 'RECEPTIONIST', userCode: '30001' }
  },
  {
    id: 'demo-anom-6',
    hotelId: 'demo-hotel-1',
    type: 'FORCED_SHIFT_CLOSE',
    severity: 'MEDIUM',
    status: 'RESOLVED',
    subjectUserId: 'demo-u-pos',
    shiftId: 'demo-shift-4',
    title: 'Shift force-closed by admin',
    detail: "An admin force-closed POS Staff's shift on Tuesday morning.",
    evidence: { forcedAt: new Date(Date.now() - 86400_000).toISOString() },
    detectedAt: new Date(Date.now() - 86400_000).toISOString(),
    resolvedAt: new Date(Date.now() - 86000_000).toISOString(),
    resolutionNote: 'Tablet battery died — confirmed with staff member.',
    subjectUser: { id: 'demo-u-pos', firstName: 'POS', lastName: 'Staff', role: 'POS_STAFF', userCode: '40001' }
  }
];

let demoState: AnomalyFlag[] = [...DEMO_FLAGS];

export const anomalyService = {
  async list(params: {
    status?: AnomalyStatus;
    severity?: AnomalySeverity;
    type?: AnomalyType;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<AnomalyListResponse> {
    if (isDemoMode()) {
      const filtered = demoState.filter((f) => {
        if (params.status && f.status !== params.status) return false;
        if (params.severity && f.severity !== params.severity) return false;
        if (params.type && f.type !== params.type) return false;
        return true;
      });
      const counts: Record<AnomalyStatus, number> = { OPEN: 0, ACKNOWLEDGED: 0, RESOLVED: 0, DISMISSED: 0 };
      for (const f of demoState) counts[f.status]++;
      return {
        items: filtered,
        total: filtered.length,
        page: 1,
        pageSize: 50,
        counts
      };
    }
    const { data } = await api.get<AnomalyListResponse>('/anomalies', { params });
    return data;
  },

  async acknowledge(id: string, note?: string): Promise<AnomalyFlag> {
    if (isDemoMode()) {
      demoState = demoState.map((f) =>
        f.id === id
          ? {
              ...f,
              status: 'ACKNOWLEDGED',
              acknowledgedAt: new Date().toISOString(),
              acknowledgedBy: 'demo-u-mgr',
              resolutionNote: note
            }
          : f
      );
      return demoState.find((f) => f.id === id)!;
    }
    const { data } = await api.post<AnomalyFlag>(`/anomalies/${id}/acknowledge`, { note });
    return data;
  },

  async resolve(id: string, resolution: 'RESOLVED' | 'DISMISSED', note?: string): Promise<AnomalyFlag> {
    if (isDemoMode()) {
      demoState = demoState.map((f) =>
        f.id === id
          ? {
              ...f,
              status: resolution,
              resolvedAt: new Date().toISOString(),
              resolutionNote: note
            }
          : f
      );
      return demoState.find((f) => f.id === id)!;
    }
    const { data } = await api.post<AnomalyFlag>(`/anomalies/${id}/resolve`, { resolution, note });
    return data;
  },

  async runNow(windowHours = 24): Promise<{ created: number; skipped: number }> {
    if (isDemoMode()) {
      // Pretend we ran detection — return small synthetic numbers
      return { created: Math.floor(Math.random() * 2), skipped: 5 };
    }
    const { data } = await api.post<{ created: number; skipped: number }>('/anomalies/run', null, {
      params: { windowHours }
    });
    return data;
  }
};
