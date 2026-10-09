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
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string;
  kitchenStation?: string | null;
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

export interface PaymentOptions {
  online: Array<{ provider: string; publicKey: string | null; testMode: boolean }>;
  manual: Array<'CARD' | 'TRANSFER' | 'CASH'>;
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
    items: Array<{ menuItemId: string; quantity: number; notes?: string }>;
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
  async timetable(): Promise<TimetableEntry[]> {
    return list<TimetableEntry>((await api.get('/kitchen/timetable')).data);
  },
  async addTimetableEntry(payload: Omit<TimetableEntry, 'id' | 'stationCode' | 'notes'> & { stationCode?: string; notes?: string }) {
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
