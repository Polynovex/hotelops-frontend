import { api } from './api';

/**
 * Banquet & events. The server prices every booking (venue, rooms, catering,
 * corkage, promotion, service charge, VAT); the form only sends choices.
 */

export type EventPricingUnit = 'PER_DAY' | 'PER_EVENT';
export type EventStatus = 'DRAFT' | 'PENDING' | 'QUOTATION_SENT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PART_PAID' | 'PAID';
export type CateringService = 'TEA_BREAK' | 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACKS' | 'DRINKS' | 'CUSTOM';
export type EventLineType = 'VENUE' | 'ACCOMMODATION' | 'CATERING' | 'CORKAGE' | 'OTHER';

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  QUOTATION_SENT: 'Quotation sent',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

/** Calendar and chip colours by status. */
export const EVENT_STATUS_COLOR: Record<EventStatus, string> = {
  DRAFT: '#94A3B8',
  PENDING: '#D97706',
  QUOTATION_SENT: '#7C3AED',
  CONFIRMED: '#2563EB',
  IN_PROGRESS: '#0D9488',
  COMPLETED: '#16A34A',
  CANCELLED: '#DC2626'
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = { UNPAID: 'Unpaid', PART_PAID: 'Part paid', PAID: 'Paid' };

export const CATERING_LABEL: Record<CateringService, string> = {
  TEA_BREAK: 'Tea break',
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACKS: 'Snacks and refreshments',
  DRINKS: 'Drinks and beverages',
  CUSTOM: 'Custom catering'
};

export interface EventType {
  id: string;
  name: string;
  description: string | null;
  location: string;
  capacity: number | null;
  isActive: boolean;
  price: number;
  pricingUnit: EventPricingUnit;
  serviceChargeRate: number;
  bufferMinutes: number;
  moveable: boolean;
  bookingCount?: number;
}

export type EventTypeInput = Omit<EventType, 'id' | 'bookingCount'>;

export interface BanquetMenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  outletId: string;
}

export interface CateringInput {
  service: CateringService;
  menuItemId?: string | null;
  description?: string | null;
  serviceDate: string;
  serviceTime?: string | null;
  people: number;
  unitPrice?: number | null;
  notes?: string | null;
}

export interface AccommodationInput {
  roomTypeCode: string;
  rooms: number;
  guests: number;
  checkIn: string;
  checkOut: string;
  rate?: number | null;
}

export interface EventInput {
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  organization?: string | null;
  billingAddress?: string | null;
  eventName: string;
  eventTypeId: string;
  location?: string | null;
  expectedGuests: number;
  startAt: string;
  endAt: string;
  specialRequirements?: string | null;
  venuePrice?: number | null;
  catering: CateringInput[];
  outsideFoodAllowed: boolean;
  corkage?: { description?: string | null; amount: number; quantity: number; notes?: string | null } | null;
  accommodation?: AccommodationInput[];
  promotionId?: string | null;
  promotionCode?: string | null;
  manualDiscount?: number | null;
  terms?: string | null;
  status?: 'DRAFT' | 'PENDING' | 'QUOTATION_SENT' | 'CONFIRMED';
}

export interface EventLine {
  id?: string;
  addOn?: boolean;
  addedAt?: string | null;
  type: EventLineType;
  description: string;
  serviceDate?: string | null;
  serviceTime?: string | null;
  menuItemId?: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  notes?: string | null;
}

export interface EventQuote {
  location: string;
  days: number;
  lines: EventLine[];
  subtotal: number;
  promotion: { id: string; name: string; code: string; discount: number } | null;
  promotionReasons: string[];
  manualDiscount: number;
  discount: number;
  serviceCharge: number;
  serviceChargeRate: number;
  vatRate: number;
  tax: number;
  total: number;
  overrides: string[];
  warnings: string[];
  conflicts: Array<{ id: string; reference: string; eventName: string; status: EventStatus; startAt: string; endAt: string }>;
  roomShortfall: number;
  needsPricingPermission: boolean;
}

export interface EventBooking {
  id: string;
  reference: string;
  status: EventStatus;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  organization: string | null;
  billingAddress: string | null;
  eventName: string;
  eventTypeId: string;
  eventTypeName: string;
  location: string;
  expectedGuests: number;
  startAt: string;
  endAt: string;
  specialRequirements: string | null;
  outsideFoodAllowed: boolean;
  accommodation: AccommodationInput[] | AccommodationInput | null;
  promotionId: string | null;
  originalTotal: number | null;
  manualDiscount: number;
  subtotal: number;
  discount: number;
  serviceCharge: number;
  tax: number;
  total: number;
  paidAmount: number;
  balance: number;
  paymentStatus: PaymentStatus;
  terms: string | null;
  cancelReason: string | null;
  createdAt: string;
}

export interface EventPayment {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  notes: string | null;
  receivedByName: string | null;
  createdAt: string;
}

export interface EventDetail extends EventBooking {
  days: number;
  lines: EventLine[];
  payments: EventPayment[];
  rooms: Array<{ id: string; bookingNumber: string; status: string; requestedRoomType: string | null; checkIn: string; checkOut: string; room: { roomNumber: string } | null }>;
  promotion: { name: string; code: string } | null;
  createdByName: string | null;
  eventType: { name: string; serviceChargeRate: number; moveable: boolean; location: string; capacity: number | null };
  hotel: { displayName: string; address: string; phone: string; email: string; logoUrl: string | null; vatRate: number; currency: string } | null;
}

export const eventsApi = {
  async listTypes(activeOnly = false) {
    return (await api.get('/events/types', { params: activeOnly ? { active: 'true' } : {} })).data as EventType[];
  },
  async createType(input: EventTypeInput) {
    return (await api.post('/events/types', input)).data as EventType;
  },
  async updateType(id: string, input: Partial<EventTypeInput>) {
    return (await api.put(`/events/types/${id}`, input)).data as EventType;
  },
  async deleteType(id: string) {
    return (await api.delete(`/events/types/${id}`)).data as { deactivated: boolean };
  },
  async menu() {
    return (await api.get('/events/menu')).data as { fromBanquetOutlet: boolean; items: BanquetMenuItem[] };
  },
  async quote(input: EventInput, excludeId?: string) {
    return (await api.post('/events/quote', input, { params: excludeId ? { excludeId } : {} })).data as EventQuote;
  },
  async list(params: { from?: string; to?: string; status?: EventStatus; q?: string } = {}) {
    return (await api.get('/events', { params })).data as EventBooking[];
  },
  async get(id: string) {
    return (await api.get(`/events/${id}`)).data as EventDetail;
  },
  async create(input: EventInput) {
    return (await api.post('/events', input)).data as EventBooking & { warnings: string[] };
  },
  async update(id: string, input: Partial<EventInput>) {
    return (await api.put(`/events/${id}`, input)).data as EventBooking & { warnings: string[] };
  },
  async setStatus(id: string, status: EventStatus, reason?: string) {
    return (await api.post(`/events/${id}/status`, { status, reason })).data as EventBooking;
  },
  async addOns(id: string, payload: { extendTo?: string | null; catering: CateringInput[]; corkage?: EventInput['corkage']; accommodation: AccommodationInput[]; manualDiscount?: number | null; note?: string | null }) {
    return (await api.post(`/events/${id}/add-ons`, payload)).data as EventBooking & { addOnSubtotal: number; warnings: string[] };
  },
  async pay(id: string, payload: { amount: number; method: string; reference?: string; notes?: string }) {
    return (await api.post(`/events/${id}/payments`, payload)).data as EventPayment & { balance: number; paymentStatus: PaymentStatus };
  }
};
