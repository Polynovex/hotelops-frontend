import { api } from './api';

/** Add-ons (super admin): the catalogue, and each business's products and add-ons. */

export type AddOnBehavior = 'OUTLET' | 'MINIBAR' | 'EVENTS';

export interface AddOnRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string;
  behavior: AddOnBehavior;
  isBuiltIn: boolean;
  isActive: boolean;
  isPublic: boolean;
  monthlyPriceNgn: number | null;
  revenueLine: string;
  sortOrder: number;
  businesses?: number;
  enabled?: boolean;
  outletId?: string | null;
}

export interface AddOnInput {
  name: string;
  description?: string | null;
  icon?: string;
  monthlyPriceNgn?: number | null;
  isPublic?: boolean;
  revenueLine?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export const addOnApi = {
  catalogue: async () => (await api.get('/admin/add-ons')).data as AddOnRecord[],
  create: async (input: AddOnInput) => (await api.post('/admin/add-ons', input)).data as AddOnRecord,
  update: async (id: string, input: Partial<AddOnInput>) => (await api.put(`/admin/add-ons/${id}`, input)).data as AddOnRecord,
  remove: async (id: string) => (await api.delete(`/admin/add-ons/${id}`)).data as { deleted?: boolean; retired?: boolean; message?: string },
  forBusiness: async (businessId: string) => (await api.get(`/admin/businesses/${businessId}/add-ons`)).data as AddOnRecord[],
  setForBusiness: async (businessId: string, addOnId: string, enabled: boolean) =>
    (await api.put(`/admin/businesses/${businessId}/add-ons/${addOnId}`, { enabled })).data,
  setProducts: async (businessId: string, products: { pms: boolean; pos: boolean; hr: boolean }) =>
    (await api.put(`/admin/businesses/${businessId}/products`, products)).data as { pmsEnabled: boolean; posEnabled: boolean; hrEnabled: boolean }
};

export const BEHAVIOR_LABEL: Record<AddOnBehavior, string> = {
  OUTLET: 'Sold through its own POS outlet',
  MINIBAR: 'Room minibars, charged at check-out',
  EVENTS: 'Venues, event bookings and catering'
};
