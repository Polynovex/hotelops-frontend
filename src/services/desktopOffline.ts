import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { api } from './api';
import { desktopBridge } from './desktopBridge';

/**
 * Offline-first on the desktop app.
 *
 * The Electron shell has an SQLite queue that replays changes when the
 * connection returns, and a cache it refreshes from the API while online. The
 * web app never used either, so on a till with no connection every action
 * failed and every screen came up empty.
 *
 * This interceptor uses them — only inside the desktop app, and only when a
 * request never reached the server. A server refusal is still shown as one.
 *
 *  - Reads of cached resources are answered from the local cache.
 *  - Order steps (new order, send to kitchen, mark ready, payment, close,
 *    void) and room status changes are queued and acknowledged with 202, and
 *    the cached copy is updated so the screen reflects the change.
 *
 * Orders created offline carry a clientId and are queued through the bulk
 * order-sync endpoint, which deduplicates by clientId; later steps name the
 * order by that clientId, which the server accepts. The queue replays oldest
 * first and stops at the first connection failure, so an order always reaches
 * the server before its steps.
 */

type CachedRead = { table: string; filter?: Record<string, unknown> };

/** Maps a GET to the cache table the desktop shell keeps for it. */
const cacheFor = (path: string, params: Record<string, unknown> | undefined): CachedRead | null => {
  const outletMenu = path.match(/^\/(?:pos\/)?outlets\/([^/]+)\/menu$/);
  if (outletMenu) return { table: 'menu', filter: { outletId: outletMenu[1] } };

  const tables: Record<string, string> = {
    '/rooms': 'rooms',
    '/reservations': 'reservations',
    '/outlets': 'outlets',
    '/pos/outlets': 'outlets',
    '/pos/tables': 'pos_tables',
    '/pos/orders': 'pos_orders',
    '/orders': 'orders',
    '/kds/orders': 'kds_orders',
    '/menu': 'menu',
    '/menu/active': 'menu_active',
    '/menu/categories': 'menu_categories',
    '/inventory/items': 'inventory_items',
    '/inventory/categories': 'inventory_categories',
    '/profiles': 'profiles',
    '/guests': 'guests'
  };
  const table = tables[path];
  if (!table) return null;
  const filter = params?.outletId ? { outletId: params.outletId } : undefined;
  return { table, filter };
};

/** Order steps and room changes that may be queued, with how each shows locally. */
const QUEUEABLE: Array<{
  method: string;
  pattern: RegExp;
  patch?: (match: RegExpMatchArray, body: Record<string, unknown>) => { table: string; id: string; changes: Record<string, unknown> } | null;
}> = [
  { method: 'post', pattern: /^\/pos\/orders$/ },
  { method: 'post', pattern: /^\/pos\/orders\/([^/]+)\/send-to-kds$/, patch: (m) => ({ table: 'pos_orders', id: m[1], changes: { orderStatus: 'SENT_TO_KITCHEN' } }) },
  { method: 'post', pattern: /^\/kds\/orders\/([^/]+)\/complete-preparation$/, patch: (m) => ({ table: 'pos_orders', id: m[1], changes: { orderStatus: 'READY' } }) },
  { method: 'post', pattern: /^\/pos\/orders\/([^/]+)\/payments$/, patch: (m) => ({ table: 'pos_orders', id: m[1], changes: { paymentStatus: 'COMPLETED' } }) },
  { method: 'post', pattern: /^\/pos\/orders\/([^/]+)\/complete$/, patch: (m) => ({ table: 'pos_orders', id: m[1], changes: { orderStatus: 'COMPLETED' } }) },
  { method: 'post', pattern: /^\/pos\/orders\/([^/]+)\/void$/, patch: (m) => ({ table: 'pos_orders', id: m[1], changes: { orderStatus: 'VOIDED' } }) },
  { method: 'put', pattern: /^\/rooms\/([^/]+)\/status$/, patch: (m, body) => ({ table: 'rooms', id: m[1], changes: { status: body.status } }) },
  { method: 'patch', pattern: /^\/rooms\/([^/]+)\/status$/, patch: (m, body) => ({ table: 'rooms', id: m[1], changes: { status: body.status } }) }
];

const reachedServer = (error: AxiosError) => Boolean(error.response);

const pathOf = (config: InternalAxiosRequestConfig) => (config.url || '').split('?')[0].replace(/^https?:\/\/[^/]+(\/api)?/, '');

const parseBody = (config: InternalAxiosRequestConfig): Record<string, unknown> => {
  if (!config.data) return {};
  if (typeof config.data === 'string') {
    try {
      return JSON.parse(config.data);
    } catch {
      return {};
    }
  }
  return config.data as Record<string, unknown>;
};

const respond = (config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse => ({
  data,
  status,
  statusText: status === 202 ? 'Queued offline' : 'Offline cache',
  headers: { 'x-hotelopx-offline': '1' },
  config
});

/** Patches a cached row so lists reflect a queued change straight away. */
const patchCached = async (table: string, id: string, changes: Record<string, unknown>) => {
  if (!desktopBridge) return;
  const rows = (await desktopBridge.read(table).catch(() => [])) as Array<Record<string, unknown>>;
  const row = rows.find((entry) => entry.id === id || entry.clientId === id);
  if (row) await desktopBridge.write(table, { ...row, ...changes });
};

export const installDesktopOffline = () => {
  const bridge = desktopBridge;
  if (!bridge) return;

  api.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config;
    if (!config || reachedServer(error)) throw error;

    const method = (config.method || 'get').toLowerCase();
    const path = pathOf(config);

    if (method === 'get') {
      const cached = cacheFor(path, config.params as Record<string, unknown> | undefined);
      if (!cached) throw error;
      const rows = await bridge.read(cached.table, cached.filter).catch(() => null);
      if (!rows) throw error;
      return respond(config, 200, rows);
    }

    const rule = QUEUEABLE.find((entry) => entry.method === method && entry.pattern.test(path));
    if (!rule) throw error;
    const body = parseBody(config);

    // A new order goes through the bulk sync endpoint, which deduplicates by
    // clientId and skips the live shift check (the shift was open when it was
    // rung up). Its id offline is its clientId, which later steps use.
    if (path === '/pos/orders') {
      const clientId = String(body.clientId || `desktop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      const order = { ...body, clientId, clientTimestamp: new Date().toISOString() };
      await bridge.queue({ resource: '/pos/orders/sync', method: 'POST', payload: { orders: [order] }, clientId });
      const placeholder = {
        id: clientId,
        clientId,
        orderNumber: `Offline ${clientId.slice(-6)}`,
        outletId: body.outletId,
        orderType: body.orderType ?? 'DINE_IN',
        orderStatus: 'OPEN',
        tableNumber: body.tableNumber ?? null,
        items: body.items ?? [],
        subtotal: 0,
        tax: 0,
        serviceCharge: 0,
        total: 0,
        paymentStatus: 'PENDING',
        isQrOrder: false,
        createdAt: new Date().toISOString(),
        queuedOffline: true
      };
      await bridge.write('pos_orders', placeholder).catch(() => undefined);
      return respond(config, 202, { order: placeholder, queued: true });
    }

    const match = path.match(rule.pattern)!;
    await bridge.queue({ resource: path, method: method.toUpperCase(), payload: body, clientId: String(body.idempotencyKey ?? '') || undefined });
    const patch = rule.patch?.(match, body);
    if (patch) await patchCached(patch.table, patch.id, patch.changes).catch(() => undefined);
    return respond(config, 202, { queued: true });
  });
};
