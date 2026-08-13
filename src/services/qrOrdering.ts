import axios from 'axios';
import { api } from './api';

/**
 * QR ordering (Part 1).
 *
 * Public calls use their own axios instance: the shared `api` client attaches
 * a bearer token and redirects to /login on 401, neither of which is correct
 * for a customer who has simply scanned a printed code.
 */

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

const publicApi = axios.create({ baseURL: API_URL });

export interface QrCodeRecord {
  id: string;
  code: string;
  label: string | null;
  outlet: { id: string; name: string };
  qrImageUrl: string | null;
  orderUrl: string;
  isActive: boolean;
  isUsable: boolean;
  expiresAt: string | null;
  orderCount: number;
  createdAt: string;
}

export interface QrOutlet {
  id: string;
  name: string;
  type: string;
}

export interface PublicMenuItem {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  taxRate: number;
  imageUrl: string | null;
  modifiers: unknown[];
}

export interface PublicMenu {
  code: string;
  business: { name: string; logoUrl: string | null; currency: string };
  outlet: { id: string; name: string };
  categories: Array<{ id: string; name: string; items: PublicMenuItem[] }>;
}

export interface PublicOrderResult {
  orderId: string;
  orderNumber: string;
  status: string;
  total: number;
  currency: string;
  estimatedMinutes: number;
}

export interface PublicOrderStatus {
  orderId: string;
  orderNumber: string;
  status: string;
  outletName: string;
  total: number;
  placedAt: string;
  acceptedAt: string | null;
}

/** Turns an axios error into a message safe to show a customer. */
const toMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; message?: string; issues?: Array<{ message: string }> };
    if (data?.issues?.length) {
      return data.issues[0].message;
    }
    return data?.message || data?.error || fallback;
  }
  return fallback;
};

export const qrOrderingService = {
  async listOutlets(): Promise<QrOutlet[]> {
    const { data } = await api.get('/pos/outlets');
    return Array.isArray(data) ? data : [];
  },

  async listQrCodes(): Promise<QrCodeRecord[]> {
    const { data } = await api.get('/pos/qr-codes');
    return Array.isArray(data) ? data : [];
  },

  async createQrCode(payload: { outletId: string; label?: string; expiresAt?: string }) {
    const { data } = await api.post('/pos/qr-codes', payload);
    return data as QrCodeRecord;
  },

  async deactivateQrCode(id: string) {
    const { data } = await api.delete(`/pos/qr-codes/${id}`);
    return data;
  },

  async reactivateQrCode(id: string) {
    const { data } = await api.patch(`/pos/qr-codes/${id}/reactivate`);
    return data;
  },

  // --- public (no auth) ---

  async getPublicMenu(code: string): Promise<PublicMenu> {
    try {
      const { data } = await publicApi.get(`/public/order/${encodeURIComponent(code)}`);
      return data as PublicMenu;
    } catch (error) {
      throw new Error(toMessage(error, 'This menu is not available right now'));
    }
  },

  async placePublicOrder(
    code: string,
    payload: {
      customerName: string;
      customerPhone?: string;
      tableNumber?: string;
      notes?: string;
      items: Array<{ menuItemId: string; quantity: number; notes?: string }>;
    }
  ): Promise<PublicOrderResult> {
    try {
      const { data } = await publicApi.post(`/public/order/${encodeURIComponent(code)}`, payload);
      return data as PublicOrderResult;
    } catch (error) {
      throw new Error(toMessage(error, 'We could not place your order. Please try again.'));
    }
  },

  async getPublicOrderStatus(orderId: string): Promise<PublicOrderStatus> {
    const { data } = await publicApi.get(`/public/order/${encodeURIComponent(orderId)}/status`);
    return data as PublicOrderStatus;
  }
};
