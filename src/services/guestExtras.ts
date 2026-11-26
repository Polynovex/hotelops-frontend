import { api } from './api';

/**
 * Add-ons by scope:
 * - PROPERTY add-ons are facilities (spa, pool, gym, laundry, events) run by
 *   one department and sold through their outlet in the POS.
 * - GUEST add-ons ("guest extras") are sold to one stay — breakfast, late
 *   check-out, extra bed — and charged to the guest's bill.
 * The server groups both by department and filters them to what the
 * signed-in user may work with.
 */

export type AddOnScope = 'PROPERTY' | 'GUEST';
export type GuestExtraPricing = 'PER_STAY' | 'PER_NIGHT';

export const DEPARTMENTS: Array<{ value: string; label: string }> = [
  { value: 'FRONT_DESK', label: 'Front Desk' },
  { value: 'HOUSEKEEPING', label: 'Housekeeping' },
  { value: 'FOOD_BEVERAGE', label: 'Food & Beverage' },
  { value: 'KITCHEN', label: 'Kitchen' },
  { value: 'POS', label: 'POS' },
  { value: 'LAUNDRY', label: 'Laundry' },
  { value: 'SPA_WELLNESS', label: 'Spa & Wellness' },
  { value: 'GROUNDS', label: 'Pool & Grounds' },
  { value: 'EVENTS', label: 'Events' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'CONCIERGE', label: 'Concierge' },
  { value: 'MANAGEMENT', label: 'Management' }
];
export const departmentLabel = (value: string) => DEPARTMENTS.find((d) => d.value === value)?.label ?? value;

export interface GuestExtra {
  id: string;
  name: string;
  description: string | null;
  price: number;
  pricing: GuestExtraPricing;
  responsibleDepartment: string;
  departmentLabel?: string;
  isActive: boolean;
  sortOrder: number;
  activeOnStays?: number;
}

export interface AvailableAddOns {
  property: Array<{ department: string; label: string; items: Array<{ code: string; name: string; icon: string; outletId: string | null; department: string }> }>;
  guest: Array<{ department: string; label: string; items: Array<{ id: string; name: string; description: string | null; price: number; pricing: GuestExtraPricing; department: string }> }>;
}

export interface BookingExtra {
  id: string;
  guestExtraId: string;
  name: string;
  quantity: number;
  nights: number;
  unitPrice: number;
  amount: number;
  status: 'ACTIVE' | 'REMOVED';
  addedAt: string;
  removeReason: string | null;
}

export type GuestExtraInput = Pick<GuestExtra, 'name' | 'price' | 'pricing' | 'responsibleDepartment'> & { description?: string | null; sortOrder?: number; isActive?: boolean };

export const guestExtrasApi = {
  available: async () => (await api.get('/add-ons/available')).data as AvailableAddOns,
  list: async (includeInactive = true) => (await api.get('/guest-extras', { params: { includeInactive } })).data as GuestExtra[],
  create: async (input: GuestExtraInput) => (await api.post('/guest-extras', input)).data as GuestExtra,
  update: async (id: string, input: Partial<GuestExtraInput>) => (await api.put(`/guest-extras/${id}`, input)).data as GuestExtra,
  remove: async (id: string) => (await api.delete(`/guest-extras/${id}`)).data as { deleted?: boolean; deactivated?: boolean; message?: string },
  access: async (userId: string) =>
    (await api.get(`/add-ons/access/${userId}`)).data as { ownDepartment: string | null; grants: Array<{ scope: AddOnScope; department: string }> },
  setAccess: async (userId: string, grants: Array<{ scope: AddOnScope; department: string }>) =>
    (await api.put(`/add-ons/access/${userId}`, { grants })).data,
  forStay: async (bookingId: string) => (await api.get(`/reservations/${bookingId}/extras`)).data as BookingExtra[],
  addToStay: async (bookingId: string, guestExtraId: string, quantity: number) =>
    (await api.post(`/reservations/${bookingId}/extras`, { guestExtraId, quantity })).data as BookingExtra,
  removeFromStay: async (bookingId: string, extraId: string, reason: string) =>
    (await api.delete(`/reservations/${bookingId}/extras/${extraId}`, { data: { reason } })).data
};
