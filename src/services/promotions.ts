import { api } from './api';

/**
 * The promotion engine (rooms and food & beverage share one model):
 * setup, rules, approval and analytics.
 */

export type PromotionKind = 'ROOM' | 'FOOD_BEVERAGE';
export type PromotionStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED';
export type Mechanism = 'PERCENTAGE' | 'FIXED' | 'SPECIAL_PRICE' | 'BUY_X_GET_Y' | 'COMBO';
export type Transition = 'approve' | 'reject' | 'publish' | 'pause' | 'resume' | 'archive';

export interface PromotionInput {
  kind: PromotionKind;
  name: string;
  code?: string;
  description?: string;
  promotionType?: string;
  mechanism: Mechanism;
  value: number;
  specialPrice?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  rewardMenuItemIds: string[];
  discountAppliesTo?: string | null;
  maxDiscount?: number | null;
  stackable: boolean;
  autoApply: boolean;
  imageUrl?: string | null;
  roomIds: string[];
  roomTypeCodes: string[];
  ratePlanIds: string[];
  applicableOutletIds: string[];
  applicableCategoryIds: string[];
  applicableMenuItemIds: string[];
  channels: string[];
  orderTypes: string[];
  tableNumbers: string[];
  minNights?: number | null;
  maxNights?: number | null;
  minQuantity?: number | null;
  minOrderAmount?: number | null;
  startsAt?: string;
  endsAt?: string | null;
  stayStartsAt?: string | null;
  stayEndsAt?: string | null;
  bookingCutoffHours?: number | null;
  blackoutDates: string[];
  applicableDays: number[];
  startTime?: string | null;
  endTime?: string | null;
  eligibleGuests: 'ALL' | 'NEW' | 'RETURNING' | 'LOYALTY';
  minGuestAge?: number | null;
  maxRedemptions?: number | null;
  perGuestLimit?: number | null;
  stockLimit?: number | null;
  cancellationPolicy?: string | null;
  terms?: string | null;
  action?: 'DRAFT' | 'PUBLISH';
}

export interface Performance {
  redemptions: number;
  discountCost: number;
  grossRevenue: number;
  netRevenue: number;
  units: number;
  margin: number | null;
}

export interface PromotionRecord extends Omit<PromotionInput, 'action'> {
  id: string;
  code: string;
  status: PromotionStatus;
  effectiveStatus: PromotionStatus;
  isQuick: boolean;
  redemptionCount: number;
  stockRedeemed: number;
  requiresApproval: boolean;
  submittedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  performance?: Performance;
  history?: Array<{ action: string; at: string; by: string; changes: unknown }>;
  approval?: ApprovalCheck | null;
}

export interface ApprovalCheck {
  requiresApproval: boolean;
  reasons: string[];
  discountPercent: number | null;
  marginPercent: number | null;
}

export interface PreviewResult {
  kind: PromotionKind;
  approval: ApprovalCheck;
  policy?: { maxDiscountPercent: number; minMarginPercent: number };
  rows: Array<Record<string, any>>;
}

export interface Lookups {
  rooms: Array<{ id: string; roomNumber: string; name: string | null; roomType: string; rate: number }>;
  roomTypes: Array<{ code: string; name: string; baseRate: number | null }>;
  ratePlans: Array<{ id: string; code: string; name: string; roomTypeCode: string; baseRate: number }>;
  outlets: Array<{ id: string; name: string; type: string }>;
  categories: Array<{ id: string; name: string }>;
  items: Array<{ id: string; name: string; price: number; cost: number | null; categoryId: string | null; outletId: string }>;
}

export interface ApplicableRoomPromotion {
  id: string;
  name: string;
  code: string;
  description: string | null;
  imageUrl: string | null;
  isQuick: boolean;
  autoApply: boolean;
  stackable: boolean;
  terms: string | null;
  eligible: boolean;
  reasons: string[];
  discount: number;
  total: number;
}

export const promotionsApi = {
  list: async (params: { kind?: PromotionKind; status?: PromotionStatus; withPerformance?: boolean } = {}) =>
    (await api.get<PromotionRecord[]>('/promotions', { params })).data,
  get: async (id: string) => (await api.get<PromotionRecord>(`/promotions/${id}`)).data,
  lookups: async () => (await api.get<Lookups>('/promotions/lookups')).data,
  create: async (input: PromotionInput) => (await api.post<PromotionRecord>('/promotions', input)).data,
  update: async (id: string, input: PromotionInput) => (await api.put<PromotionRecord>(`/promotions/${id}`, input)).data,
  quick: async (input: { kind: PromotionKind; name: string; discountPercent?: number; discountAmount?: number }) =>
    (await api.post<PromotionRecord>('/promotions/quick', input)).data,
  preview: async (input: PromotionInput) => (await api.post<PreviewResult>('/promotions/preview', input)).data,
  transition: async (id: string, transition: Transition, note?: string) =>
    (await api.post<PromotionRecord>(`/promotions/${id}/${transition}`, { note })).data,
  remove: async (id: string) => (await api.delete(`/promotions/${id}`)).data,
  uploadImage: async (id: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return (await api.post<PromotionRecord>(`/promotions/${id}/image`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
  },
  analytics: async (params: { kind?: PromotionKind; from?: string; to?: string } = {}) =>
    (await api.get<{ rows: Array<Performance & { id: string; name: string; code: string; kind: PromotionKind; status: PromotionStatus }>; totals: Omit<Performance, 'margin'> }>(
      '/promotions/analytics',
      { params }
    )).data,
  policy: async () => (await api.get<{ maxDiscountPercent: number; minMarginPercent: number }>('/promotions/policy')).data,
  savePolicy: async (policy: { maxDiscountPercent: number; minMarginPercent: number }) => (await api.put('/promotions/policy', policy)).data,
  applicableRoom: async (params: { roomTypeCode: string; arrival: string; departure: string; roomId?: string; guestId?: string; code?: string }) =>
    (await api.get<{ nightlyRate: number; gross: number; promotions: ApplicableRoomPromotion[] }>('/promotions/applicable/room', { params })).data
};
