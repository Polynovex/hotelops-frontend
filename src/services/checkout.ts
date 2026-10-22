import { api } from './api';

/** Check-out charges: late fee, damage, additional charges, minibar, inspection. */

export type ChargeCategory =
  | 'LATE_CHECKOUT'
  | 'DAMAGE'
  | 'MINIBAR'
  | 'FOOD_BEVERAGE'
  | 'LAUNDRY'
  | 'LOST_KEY'
  | 'LINEN'
  | 'EXTRA_BED'
  | 'ACCOMMODATION'
  | 'SERVICE'
  | 'POLICY'
  | 'OTHER';
export type ChargeStatus = 'PENDING_APPROVAL' | 'POSTED' | 'DISPUTED' | 'WAIVED' | 'REJECTED' | 'REVERSED';
export type DamageStatus = 'REPORTED' | 'UNDER_ASSESSMENT' | 'AWAITING_APPROVAL' | 'APPROVED' | 'DISPUTED' | 'WAIVED' | 'CLOSED';
export type InspectionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ISSUES_FOUND' | 'NOT_REQUIRED';

/** Categories staff can add directly; late fee, damage and minibar have their own steps. */
export const ADDABLE_CATEGORIES: Array<[ChargeCategory, string]> = [
  ['LAUNDRY', 'Laundry'],
  ['FOOD_BEVERAGE', 'Food and beverage (not yet posted)'],
  ['EXTRA_BED', 'Extra bed / additional guest'],
  ['ACCOMMODATION', 'Additional accommodation'],
  ['LOST_KEY', 'Lost key / access card'],
  ['LINEN', 'Linen loss or damage'],
  ['SERVICE', 'Service charge'],
  ['POLICY', 'Cancellation / no-show (policy)'],
  ['OTHER', 'Miscellaneous charge']
];

export const CHARGE_STATUS_LABEL: Record<ChargeStatus, string> = {
  PENDING_APPROVAL: 'Waiting for manager',
  POSTED: 'On the bill',
  DISPUTED: 'Disputed',
  WAIVED: 'Waived',
  REJECTED: 'Rejected',
  REVERSED: 'Reversed'
};
export const DAMAGE_STATUS_LABEL: Record<DamageStatus, string> = {
  REPORTED: 'Reported',
  UNDER_ASSESSMENT: 'Under assessment',
  AWAITING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Approved',
  DISPUTED: 'Disputed',
  WAIVED: 'Waived',
  CLOSED: 'Closed'
};
export const INSPECTION_LABEL: Record<InspectionStatus, string> = {
  PENDING: 'Not inspected',
  IN_PROGRESS: 'Inspection in progress',
  COMPLETED: 'Inspected',
  ISSUES_FOUND: 'Inspected — issues found',
  NOT_REQUIRED: 'No inspection needed'
};
export const DAMAGE_LOCATIONS: Array<[string, string]> = [
  ['GUEST_ROOM', 'Guest room'],
  ['BATHROOM', 'Bathroom'],
  ['RESTAURANT', 'Restaurant'],
  ['BAR', 'Bar'],
  ['POOLSIDE', 'Poolside'],
  ['BANQUET_HALL', 'Banquet hall'],
  ['LOBBY', 'Lobby'],
  ['CORRIDOR', 'Corridor'],
  ['OTHER', 'Other']
];
export const DAMAGE_CATEGORIES: Array<[string, string]> = [
  ['FURNITURE', 'Furniture'],
  ['ELECTRICAL', 'Electrical equipment'],
  ['PLUMBING', 'Plumbing'],
  ['GLASSWARE', 'Glassware'],
  ['LINEN', 'Linen'],
  ['ELECTRONICS', 'Electronics'],
  ['FITTINGS', 'Fittings'],
  ['OTHER', 'Other']
];

export interface CheckoutPolicy {
  standardTime: string;
  graceMinutes: number;
  method: 'NONE' | 'FIXED' | 'HOURLY' | 'HALF_DAY' | 'FULL_DAY';
  rate: number;
  incrementMinutes: number;
  maxCharge: number | null;
  approvalThreshold: number;
  inspection: 'OFF' | 'ADVISORY' | 'MANDATORY';
}

export interface CheckoutCharge {
  id: string;
  reference: string;
  category: ChargeCategory;
  categoryLabel: string;
  description: string;
  serviceLocation: string | null;
  serviceDate: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  supportingRef: string | null;
  remarks: string | null;
  status: ChargeStatus;
  decisionReason: string | null;
  createdAt: string;
  bookingNumber?: string;
  guestName?: string;
  roomNumber?: string | null;
  bookingId: string;
}

export interface DamageIncident {
  id: string;
  reference: string;
  bookingId: string | null;
  roomId: string | null;
  roomNumber?: string | null;
  bookingNumber?: string | null;
  guestName: string | null;
  locationCategory: string;
  specificLocation: string | null;
  itemDamaged: string;
  category: string;
  description: string;
  occurredAt: string;
  assessment: string | null;
  assessmentMethod: string | null;
  assessedCost: number | null;
  recoveryCharge: number | null;
  status: DamageStatus;
  disputeNote: string | null;
  remarks: string | null;
  reportedByName?: string | null;
  createdAt: string;
}

export interface MinibarItem {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
}

export interface MinibarCountLine {
  itemId: string;
  name: string;
  par: number;
  remaining: number;
  consumed: number;
  price: number;
  amount: number;
}

export interface MinibarCount {
  id: string;
  roomId: string;
  roomNumber?: string;
  bookingId: string | null;
  bookingNumber?: string | null;
  guestName?: string | null;
  lines: MinibarCountLine[];
  total: number;
  status: 'PENDING_REVIEW' | 'CHARGED' | 'NO_CHARGE';
  createdAt: string;
}

export interface CheckoutReview {
  booking: {
    id: string;
    bookingNumber: string;
    status: string;
    guestName: string;
    roomNumber: string | null;
    roomId: string | null;
    checkIn: string;
    checkOut: string;
    lateCheckoutUntil: string | null;
    inspectionStatus: InspectionStatus;
    inspectionNotes: string | null;
    eventBookingId: string | null;
  };
  policy: CheckoutPolicy;
  lateCheckout: {
    deadline: string;
    standardDeadline: string;
    extended: boolean;
    minutesLate: number;
    chargeableMinutes: number;
    units: number;
    method: string;
    rate: number;
    amount: number;
    capped: boolean;
    alreadyCharged: boolean;
  };
  bill: {
    charges: Array<{ id: string; description: string; items: string | null; outlet: string | null; source: string; totalAmount: number; postedAt: string; status: 'PENDING' | 'SETTLED' }>;
    totals: { charges: number; pending: number; paid: number; balance: number };
    accommodation: { total: number; outstanding: number };
  } | null;
  charges: CheckoutCharge[];
  damages: DamageIncident[];
  minibarCounts: MinibarCount[];
  summary: {
    accommodation: number;
    outletBills: number;
    lateCheckout: number;
    damage: number;
    additional: number;
    totalCharges: number;
    paid: number;
    balance: number;
    refundDue: number;
  };
  blockers: string[];
}

export const checkoutApi = {
  review: async (id: string) => (await api.get(`/reservations/${id}/checkout-review`)).data as CheckoutReview,
  policy: async () => (await api.get('/checkout-policy')).data as CheckoutPolicy,
  savePolicy: async (policy: Partial<CheckoutPolicy>) => (await api.put('/checkout-policy', policy)).data as CheckoutPolicy,
  extend: async (id: string, until: string) => (await api.post(`/reservations/${id}/late-checkout/extend`, { until })).data,
  assessLate: async (id: string, payload: { actualTime?: string; waiveAmount?: number; reason?: string }) =>
    (await api.post(`/reservations/${id}/late-checkout/assess`, payload)).data as { charged: boolean; waived?: boolean; charge?: CheckoutCharge },
  addCharge: async (
    id: string,
    payload: { category: ChargeCategory; description: string; serviceLocation?: string; serviceDate?: string; quantity: number; unitPrice: number; supportingRef?: string; remarks?: string; confirmDuplicate?: boolean }
  ) => (await api.post(`/reservations/${id}/checkout-charges`, payload)).data as CheckoutCharge,
  decideCharge: async (id: string, action: 'approve' | 'reject' | 'waive' | 'dispute' | 'reverse', reason?: string) =>
    (await api.post(`/checkout-charges/${id}/${action}`, { reason })).data as CheckoutCharge,
  listCharges: async (status?: ChargeStatus) => (await api.get('/checkout-charges', { params: status ? { status } : {} })).data as CheckoutCharge[],
  refund: async (id: string, payload: { amount: number; method: string; reason: string }) => (await api.post(`/reservations/${id}/refund`, payload)).data,
  setInspection: async (id: string, status: InspectionStatus, notes?: string) => (await api.put(`/reservations/${id}/inspection`, { status, notes })).data,
  reportDamage: async (payload: {
    bookingId?: string | null;
    roomId?: string | null;
    locationCategory: string;
    specificLocation?: string;
    itemDamaged: string;
    category: string;
    description: string;
    occurredAt?: string;
    remarks?: string;
  }) => (await api.post('/damages', payload)).data as DamageIncident,
  listDamages: async (params: { status?: DamageStatus; bookingId?: string } = {}) => (await api.get('/damages', { params })).data as DamageIncident[],
  assessDamage: async (id: string, payload: { assessmentMethod: string; assessedCost: number; recoveryCharge: number; assessment: string }) =>
    (await api.put(`/damages/${id}/assess`, payload)).data as DamageIncident,
  decideDamage: async (id: string, action: 'approve' | 'dispute' | 'waive' | 'close', reason?: string) =>
    (await api.post(`/damages/${id}/${action}`, { reason })).data as DamageIncident,
  minibarItems: async () => (await api.get('/minibar/items')).data as MinibarItem[],
  createMinibarItem: async (payload: { name: string; price: number }) => (await api.post('/minibar/items', payload)).data as MinibarItem,
  updateMinibarItem: async (id: string, payload: Partial<MinibarItem>) => (await api.put(`/minibar/items/${id}`, payload)).data as MinibarItem,
  roomMinibar: async (roomId: string) =>
    (await api.get(`/rooms/${roomId}/minibar`)).data as {
      room: { id: string; roomNumber: string };
      items: Array<{ itemId: string; name: string; price: number; isActive: boolean; parQuantity: number }>;
      lastCount: MinibarCount | null;
    },
  setRoomMinibar: async (roomId: string, items: Array<{ itemId: string; parQuantity: number }>) => (await api.put(`/rooms/${roomId}/minibar`, { items })).data,
  applyToRoomType: async (roomTypeCode: string, items: Array<{ itemId: string; parQuantity: number }>) =>
    (await api.post('/minibar/apply-room-type', { roomTypeCode, items })).data as { rooms: number },
  countMinibar: async (roomId: string, lines: Array<{ itemId: string; remaining: number }>) => (await api.post(`/rooms/${roomId}/minibar/count`, { lines })).data as MinibarCount,
  minibarCounts: async (status?: MinibarCount['status']) => (await api.get('/minibar/counts', { params: status ? { status } : {} })).data as MinibarCount[],
  decideMinibarCount: async (id: string, action: 'charge' | 'no-charge', reason?: string) => (await api.post(`/minibar/counts/${id}/${action}`, { reason })).data
};
