import { api } from './api';

export type DiscountType = 'PERCENTAGE' | 'FIXED';
export type DiscountScope = 'RECEIVER' | 'ITEM';
export type DiscountAppliedTo = 'POS_ORDER' | 'POS_ORDER_ITEM' | 'FOLIO' | 'FOLIO_ITEM';

export interface Promotion {
  id: string;
  hotelId: string;
  code: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  value: number;
  scope: DiscountScope;
  startsAt: string;
  endsAt?: string;
  maxRedemptions?: number;
  redemptionCount: number;
  minOrderAmount?: number;
  applicableOutletIds: string[];
  applicableCategoryIds: string[];
  applicableMenuItemIds: string[];
  requiresApproval: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface PromotionPayload {
  code: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  value: number;
  scope: DiscountScope;
  startsAt: string;
  endsAt?: string;
  maxRedemptions?: number;
  minOrderAmount?: number;
  applicableOutletIds?: string[];
  applicableCategoryIds?: string[];
  applicableMenuItemIds?: string[];
  requiresApproval?: boolean;
  isActive?: boolean;
}

export interface ApplyDiscountPayload {
  appliedToType: DiscountAppliedTo;
  appliedToId: string;
  scope: DiscountScope;
  promotionId?: string;
  discountType?: DiscountType;
  value?: number;
  reason?: string;
  targetItemIds?: string[];
  approvalPin?: string;
}

export interface DiscountApplication {
  id: string;
  hotelId: string;
  promotionId?: string;
  shiftId?: string;
  appliedToType: DiscountAppliedTo;
  appliedToId: string;
  scope: DiscountScope;
  discountType: DiscountType;
  value: number;
  amountSaved: number;
  reason?: string;
  approvedBy?: string;
  appliedBy: string;
  appliedAt: string;
  voidedAt?: string;
  promotion?: { code: string; name: string };
}

export const promotionService = {
  list: async (active?: boolean): Promise<Promotion[]> => {
    const { data } = await api.get('/promotions', { params: active ? { active: true } : {} });
    return data;
  },
  create: async (payload: PromotionPayload): Promise<Promotion> => {
    const { data } = await api.post('/promotions', payload);
    return data;
  },
  update: async (id: string, payload: Partial<PromotionPayload>): Promise<Promotion> => {
    const { data } = await api.put(`/promotions/${id}`, payload);
    return data;
  },
  deactivate: async (id: string): Promise<{ ok: true }> => {
    const { data } = await api.delete(`/promotions/${id}`);
    return data;
  }
};

export const discountService = {
  apply: async (payload: ApplyDiscountPayload) => {
    const { data } = await api.post('/discounts/apply', payload);
    return data as { application: DiscountApplication; entity: any };
  },
  void: async (id: string, reason?: string) => {
    const { data } = await api.post(`/discounts/${id}/void`, { reason });
    return data;
  },
  list: async (params: {
    from?: string;
    to?: string;
    appliedBy?: string;
    voided?: boolean;
  } = {}) => {
    const { data } = await api.get('/discounts', { params });
    return data as DiscountApplication[];
  }
};
