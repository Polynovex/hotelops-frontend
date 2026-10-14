import { api } from './api';

/**
 * Client for the POS order lifecycle, kitchen dashboard and payments.
 *
 * Consumer -> POS agent -> POS: orders are rung up from real menu items (the
 * server prices them), sent to the kitchen, marked ready there, then served
 * and paid at the POS. The kitchen never takes payment.
 */

export interface Outlet {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  taxRate: number;
  category?: string;
  kitchenStation?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  isAvailable: boolean;
  /** Priced add-ons configured on the item: [{ id, name, price }]. */
  modifiers?: unknown;
}

export interface PosTable {
  id: string;
  outletId: string;
  tableNumber: string;
  capacity: number;
  isActive: boolean;
  outlet?: { name: string };
}

export interface OrderLine {
  /** Stable id, used to void or edit a single item. */
  lineId?: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string;
  kitchenStation?: string | null;
  addOns?: Array<{ id: string; name: string; price: number }>;
  addOnUnitPrice?: number;
}

export type OrderStatus = 'OPEN' | 'SENT_TO_KITCHEN' | 'READY' | 'COMPLETED' | 'VOIDED';

export interface PosOrderRow {
  id: string;
  orderNumber: string;
  outletId: string;
  outlet?: { name: string; type: string };
  orderType: string;
  orderStatus: OrderStatus;
  tableNumber: string | null;
  items: OrderLine[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod?: string | null;
  isQrOrder: boolean;
  customerName?: string | null;
  customerPhone?: string | null;
  acceptedAt?: string | null;
  readyAt?: string | null;
  metadata?: { roomNumber?: string; paymentPreference?: string; notes?: string; bookingId?: string } | null;
  createdAt: string;
}

export interface RoomBill {
  id: string;
  roomNumber: string | null;
  guestName: string;
  bookingNumber: string;
  orderNumber: string | null;
  outlet: string | null;
  /** Items separated by commas. */
  items: string;
  totalAmount: number;
  source: string;
  status: 'PENDING' | 'SETTLED';
  postedAt: string;
  settledAt: string | null;
}

export interface PaymentOptions {
  online: Array<{ provider: string; publicKey: string | null; testMode: boolean }>;
  /** ROOM = send the bill to a checked-in guest's room. */
  manual: Array<'CARD' | 'TRANSFER' | 'CASH' | 'ROOM'>;
  acceptCash: boolean;
}

export interface PaymentLogRow {
  id: string;
  reference: string;
  amount: number;
  method: string;
  provider: string | null;
  status: string;
  createdAt: string;
  orderId: string;
  orderNumber?: string;
  outlet?: string;
  outletType?: string;
  tableNumber?: string | null;
  isQrOrder: boolean;
  account: string;
  recordedBy: string | null;
}

export interface KitchenStation {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'OUT_OF_ORDER';
  remark: string | null;
}

export interface TimetableEntry {
  id: string;
  dayOfWeek: number;
  mealPeriod: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  dishName: string;
  stationCode: string | null;
  notes: string | null;
  /** How much the timetable expects to be made, e.g. 40 portions. */
  plannedQuantity?: number | null;
  unit?: string | null;
  outletId?: string | null;
  menuItemId?: string | null;
}

/** One entry in an outlet kitchen's production table. */
export interface ProductionLogRow {
  id: string;
  date: string;
  outletId: string | null;
  menuItemId: string | null;
  dishName: string;
  mealPeriod: string | null;
  portions: number;
  wasted: number;
  planned: number | null;
  notes: string | null;
  recordedBy: string;
  shift: { id: string; openedAt: string; closedAt: string | null } | null;
  recordedAt: string;
}

/** Planned vs actually made, for one day. */
export interface KitchenProduction {
  date: string;
  rows: Array<{
    timetableEntryId: string;
    dishName: string;
    mealPeriod: TimetableEntry['mealPeriod'];
    unit: string;
    planned: number | null;
    produced: number;
    wasted: number;
    variance: number | null;
  }>;
  unplanned: Array<{ id: string; dishName: string; producedQuantity: number; wastedQuantity: number; unit: string; notes: string | null }>;
}

export interface KitchenOverview {
  date: string;
  dayOfWeek: number;
  timetable: Array<{ mealPeriod: TimetableEntry['mealPeriod']; entries: TimetableEntry[] }>;
  stations: KitchenStation[];
  orders: { inKitchen: number; ready: number; served: number; averagePrepMinutes: number | null };
  stock: Array<{
    id: string;
    name: string;
    unit: string;
    category?: string;
    currentStock: number;
    reorderLevel: number;
    low: boolean;
    receivedToday: number;
    usedToday: number;
  }>;
}

const list = <T>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : Array.isArray((data as { data?: unknown })?.data) ? ((data as { data: T[] }).data) : [];

export const posFlow = {
  async outlets(): Promise<Outlet[]> {
    return list<Outlet>((await api.get('/outlets')).data).filter((outlet) => outlet.isActive !== false);
  },
  async menu(outletId: string): Promise<MenuItem[]> {
    return list<MenuItem>((await api.get(`/pos/outlets/${outletId}/menu`)).data).filter(
      (item) => item.isActive !== false && item.isAvailable !== false
    );
  },

  async tables(outletId?: string): Promise<PosTable[]> {
    return list<PosTable>((await api.get('/pos/tables', { params: outletId ? { outletId } : undefined })).data);
  },
  async createTable(payload: { outletId: string; tableNumber: string; capacity: number }) {
    return (await api.post('/pos/tables', payload)).data as PosTable;
  },
  async updateTable(id: string, payload: Partial<{ tableNumber: string; capacity: number; isActive: boolean }>) {
    return (await api.put(`/pos/tables/${id}`, payload)).data as PosTable;
  },
  async deleteTable(id: string) {
    return (await api.delete(`/pos/tables/${id}`)).data;
  },

  async orders(params?: { outletId?: string; orderStatus?: string }): Promise<PosOrderRow[]> {
    return list<PosOrderRow>((await api.get('/pos/orders', { params })).data);
  },
  /** Lines name menu items only; the server prices them. */
  async createOrder(payload: {
    outletId: string;
    orderType: string;
    tableNumber?: string;
    bookingId?: string;
    /** Codes the guest presented; auto-apply promotions need none. */
    promotionCodes?: string[];
    items: Array<{ menuItemId: string; quantity: number; notes?: string; addOns?: string[] }>;
  }) {
    const { data } = await api.post('/pos/orders', { ...payload, clientId: `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    return (data?.order ?? data) as PosOrderRow;
  },
  /** Failed offline replays (desktop app only), for staff to resolve. */
  async offlineFailures(): Promise<Array<{ id: string; resource: string; method: string; reason: string; createdAt: number }>> {
    const bridge = (window as { hotelopsxDesktop?: { failedItems?: () => Promise<unknown> } }).hotelopsxDesktop;
    return bridge?.failedItems ? ((await bridge.failedItems()) as never) : [];
  },
  async sendToKitchen(orderId: string, force = false) {
    return (await api.post(`/pos/orders/${orderId}/send-to-kds`, force ? { force: true } : {})).data as PosOrderRow;
  },
  /**
   * Every payment carries a one-time key and the time it was taken, so if it
   * is queued offline (desktop) and replayed, it is recorded exactly once and
   * on the right business day.
   */
  async takePayment(orderId: string, payload: { method: string; amount?: number; reference?: string }) {
    const idempotencyKey = `pay-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    return (await api.post(`/pos/orders/${orderId}/payments`, { ...payload, idempotencyKey, occurredAt: new Date().toISOString() })).data;
  },
  async complete(orderId: string) {
    return (await api.post(`/pos/orders/${orderId}/complete`, {})).data as PosOrderRow;
  },
  /** Replaces a placed order's lines (needs Manage sales orders). */
  async editOrder(orderId: string, items: Array<{ lineId?: string; menuItemId: string; quantity: number; notes?: string; addOns?: string[] }>, reason: string) {
    return (await api.put(`/pos/orders/${orderId}`, { items, reason })).data as PosOrderRow;
  },
  /** Voids one item on a placed order; the last item voids the order. */
  async voidOrderItem(orderId: string, lineId: string, reason: string) {
    return (await api.post(`/pos/orders/${orderId}/items/${lineId}/void`, { reason })).data as PosOrderRow;
  },
  /** Checked-in rooms an order can be billed to. */
  async chargeableRooms(): Promise<Array<{ bookingId: string; roomNumber: string; guestName: string }>> {
    return list((await api.get('/pos/room-charge/rooms')).data);
  },
  /** "Send bill to room": posts the order to the guest's room bill. */
  async chargeToRoom(orderId: string, roomNumber: string) {
    return (await api.post(`/pos/orders/${orderId}/charge-to-room`, { roomNumber })).data as { roomNumber: string; guestName: string };
  },
  /** Bills sent to rooms, with items, total, room and settlement status. */
  async roomBills(params?: { status?: 'PENDING' | 'SETTLED'; roomNumber?: string; from?: string; to?: string }): Promise<RoomBill[]> {
    return list((await api.get('/room-bills', { params })).data);
  },
  async voidOrder(orderId: string, reason: string) {
    return (await api.post(`/pos/orders/${orderId}/void`, { reason })).data as PosOrderRow;
  },
  async payments(params?: { from?: string; to?: string; outletId?: string; method?: string }) {
    return (await api.get('/pos/payments', { params })).data as {
      totals: Record<string, number>;
      grandTotal: number;
      payments: PaymentLogRow[];
    };
  },
  async paymentOptions(): Promise<PaymentOptions> {
    return (await api.get('/settings/payment-methods')).data as PaymentOptions;
  },
  async setAcceptCash(acceptCash: boolean): Promise<PaymentOptions> {
    return (await api.put('/settings/payment-methods', { acceptCash })).data as PaymentOptions;
  },

  // Kitchen
  async kdsOrders(includeCompleted = false): Promise<PosOrderRow[]> {
    return list<PosOrderRow>((await api.get('/kds/orders', { params: includeCompleted ? { includeCompleted: true } : undefined })).data);
  },
  async markReady(orderId: string) {
    return (await api.post(`/kds/orders/${orderId}/complete-preparation`)).data as PosOrderRow;
  },
  async stations(): Promise<KitchenStation[]> {
    return list<KitchenStation>((await api.get('/kds/stations')).data);
  },
  async setStationStatus(id: string, status: KitchenStation['status'], remark?: string) {
    return (await api.put(`/pos/kitchen-stations/${id}/status`, { status, remark })).data as KitchenStation;
  },
  async kitchenOverview(date?: string): Promise<KitchenOverview> {
    return (await api.get('/kitchen/overview', { params: date ? { date } : undefined })).data as KitchenOverview;
  },
  /** An outlet's weekly plan (plus older hotel-wide entries). */
  async timetable(outletId?: string): Promise<TimetableEntry[]> {
    return list<TimetableEntry>((await api.get('/kitchen/timetable', { params: outletId ? { outletId } : undefined })).data);
  },
  async production(date?: string, outletId?: string): Promise<KitchenProduction> {
    return (await api.get('/kitchen/production', { params: { ...(date ? { date } : {}), ...(outletId ? { outletId } : {}) } })).data as KitchenProduction;
  },
  /** Logs portions made: the dish comes from the outlet's menu. */
  async recordProduction(payload: {
    outletId?: string;
    menuItemId?: string;
    timetableEntryId?: string;
    dishName?: string;
    portions: number;
    wasted?: number;
    notes?: string;
    date?: string;
  }) {
    return (await api.post('/kitchen/production', payload)).data;
  },
  async updateProduction(id: string, changes: { portions?: number; wasted?: number; notes?: string }) {
    return (await api.put(`/kitchen/production/${id}`, changes)).data;
  },
  /** An outlet kitchen's daily production table. */
  async productionLog(params: { outletId?: string; from?: string; to?: string }): Promise<ProductionLogRow[]> {
    return list<ProductionLogRow>((await api.get('/kitchen/production/log', { params })).data);
  },
  async addTimetableEntry(payload: Omit<TimetableEntry, 'id' | 'stationCode' | 'notes'> & { stationCode?: string; notes?: string; outletId?: string; menuItemId?: string }) {
    return (await api.post('/kitchen/timetable', payload)).data as TimetableEntry;
  },
  async deleteTimetableEntry(id: string) {
    return (await api.delete(`/kitchen/timetable/${id}`)).data;
  },
  async logUsage(itemId: string, quantity: number, notes?: string) {
    return (await api.post('/kitchen/stock-usage', { itemId, quantity, notes })).data;
  }
};

export const formatNaira = (value: number) =>
  `₦${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
