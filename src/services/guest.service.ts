import axios from 'axios';
import { api } from './api';

export type GuestType = 'ONE_TIME' | 'REGULAR';
export type GuestSource = 'STAFF' | 'SELF_REGISTRATION' | 'BOOKING_ENGINE' | 'IMPORT';

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  idType: string | null;
  idNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  vipLevel: string | null;
  guestType: GuestType;
  source: GuestSource;
  stayCount: number;
  verifiedAt: string | null;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  blacklistedAt: string | null;
  createdAt: string;
  updatedAt: string;
  loyaltyAccount?: { id: string; tier: string; pointsBalance: number } | null;
}

export interface GuestRegistrationLink {
  id: string;
  code: string;
  label: string | null;
  qrImageUrl: string | null;
  isActive: boolean;
  expiresAt: string | null;
  useCount: number;
  createdAt: string;
  registrationUrl: string;
}

export const guestFullName = (guest: Pick<Guest, 'firstName' | 'lastName'>) =>
  `${guest.firstName} ${guest.lastName}`.trim();

export const guestService = {
  /**
   * Typeahead for the reservation form. Capped server-side at 10 results, so
   * it stays fast regardless of how large the guest book gets.
   */
  search: async (query: string): Promise<Guest[]> => {
    const term = query.trim();
    if (!term) {
      return [];
    }
    const { data } = await api.get('/guests/search', { params: { q: term } });
    return Array.isArray(data) ? data : [];
  },

  /** Paged guest book for the admin screen. */
  list: async (params?: {
    q?: string;
    guestType?: GuestType | '';
    blacklisted?: 'true' | 'false' | '';
    limit?: number;
    offset?: number;
  }): Promise<{ data: Guest[]; total: number }> => {
    const { data } = await api.get('/guests', {
      params: {
        ...(params?.q ? { q: params.q } : {}),
        ...(params?.guestType ? { guestType: params.guestType } : {}),
        ...(params?.blacklisted ? { blacklisted: params.blacklisted } : {}),
        limit: params?.limit ?? 50,
        offset: params?.offset ?? 0
      }
    });
    return { data: data?.data ?? [], total: data?.total ?? 0 };
  },

  get: async (id: string): Promise<Guest> => {
    const { data } = await api.get(`/guests/${id}`);
    return data;
  },

  /** A reason is required when blacklisting; the server enforces it too. */
  setBlacklist: async (id: string, blacklisted: boolean, reason?: string): Promise<Guest> => {
    const { data } = await api.put(`/guests/${id}/blacklist`, { blacklisted, reason });
    return data;
  },

  setGuestType: async (id: string, guestType: GuestType): Promise<Guest> => {
    const { data } = await api.put(`/guests/${id}/type`, { guestType });
    return data;
  },

  /** Confirms a self-registered record has been checked against an ID. */
  verify: async (id: string): Promise<Guest> => {
    const { data } = await api.put(`/guests/${id}/verify`, {});
    return data;
  },

  // ─── Self-registration QR links ────────────────────────────────────────────

  listLinks: async (): Promise<GuestRegistrationLink[]> => {
    const { data } = await api.get('/guest-registration/links');
    return Array.isArray(data) ? data : [];
  },

  createLink: async (payload: { label?: string; expiresAt?: string }): Promise<GuestRegistrationLink> => {
    const { data } = await api.post('/guest-registration/links', payload);
    return data;
  },

  updateLink: async (
    id: string,
    payload: { isActive?: boolean; label?: string }
  ): Promise<GuestRegistrationLink> => {
    const { data } = await api.put(`/guest-registration/links/${id}`, payload);
    return data;
  },

  deleteLink: async (id: string): Promise<void> => {
    await api.delete(`/guest-registration/links/${id}`);
  },

  getLinkQr: async (id: string): Promise<{ url: string; dataUrl: string }> => {
    const { data } = await api.get(`/guest-registration/links/${id}/qr`);
    return data;
  }
};

export default guestService;

// ─── Public self-registration ────────────────────────────────────────────────

/**
 * Guests reaching the registration form are not signed in. The shared `api`
 * client attaches a bearer token and redirects to /login on 401 — neither is
 * right for someone who has just scanned a printed code — so these calls use
 * their own instance, matching the QR ordering flow.
 */
const PUBLIC_API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');
const publicApi = axios.create({ baseURL: PUBLIC_API_URL });

export interface RegistrationContext {
  hotelName: string;
  logoUrl: string | null;
  label: string | null;
}

export interface GuestRegistrationInput {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  dateOfBirth?: string;
}

export const publicGuestService = {
  /** Confirms the code is live and names the hotel the form belongs to. */
  getContext: async (code: string): Promise<RegistrationContext> => {
    const { data } = await publicApi.get(`/public/guest/register/${code}`);
    return data;
  },

  submit: async (code: string, payload: GuestRegistrationInput): Promise<void> => {
    await publicApi.post(`/public/guest/register/${code}`, payload);
  }
};
