import axios from 'axios';
import { api } from './api';

/** Feedback QR codes: guests rating the hotel, and hotel owners' testimonials. */

export const RATING_LABEL: Record<string, string> = {
  overall: 'Overall',
  room: 'Room',
  cleanliness: 'Cleanliness',
  food: 'Food and drink',
  frontDesk: 'Front desk',
  service: 'Staff and service',
  value: 'Value for money'
};

export interface FeedbackLink {
  id: string;
  code: string;
  url: string;
  label: string | null;
  isActive: boolean;
  kind: 'GUEST_FEEDBACK' | 'TESTIMONIAL';
  responseCount: number;
  createdAt: string;
  hotelId?: string | null;
  hotelName?: string | null;
  hotelEmail?: string | null;
}

export interface GuestFeedback {
  id: string;
  guestName: string | null;
  roomNumber: string | null;
  contact: string | null;
  ratings: Record<string, number>;
  overall: number;
  comment: string | null;
  wouldRecommend: boolean | null;
  status: 'NEW' | 'REVIEWED' | 'RESOLVED';
  response: string | null;
  createdAt: string;
  linkLabel: string | null;
}

export interface FeedbackSummary {
  count: number;
  averages: Record<string, { average: number; count: number }>;
  recommendRate: number | null;
  unresolved: number;
}

export const feedbackApi = {
  links: async () => (await api.get('/feedback/links')).data as FeedbackLink[],
  createLink: async (label: string) => (await api.post('/feedback/links', { label })).data as FeedbackLink,
  updateLink: async (id: string, payload: { label?: string; isActive?: boolean }) => (await api.put(`/feedback/links/${id}`, payload)).data as FeedbackLink,
  qr: async (id: string) => (await api.get(`/feedback/links/${id}/qr`)).data as { url: string; dataUrl: string },
  list: async (params: { status?: string; from?: string; to?: string } = {}) =>
    (await api.get('/feedback', { params })).data as { responses: GuestFeedback[]; summary: FeedbackSummary },
  update: async (id: string, payload: { status?: string; response?: string }) => (await api.put(`/feedback/${id}`, payload)).data as GuestFeedback,
  // Super admin
  testimonialLinks: async () => (await api.get('/admin/feedback-links')).data as FeedbackLink[],
  createTestimonialLink: async (payload: { hotelId?: string | null; label?: string }) => (await api.post('/admin/feedback-links', payload)).data as FeedbackLink,
  updateTestimonialLink: async (id: string, isActive: boolean) => (await api.put(`/admin/feedback-links/${id}`, { isActive })).data as FeedbackLink,
  deleteTestimonialLink: async (id: string) => {
    await api.delete(`/admin/feedback-links/${id}`);
  },
  testimonialQr: async (id: string) => (await api.get(`/admin/feedback-links/${id}/qr`)).data as { url: string; dataUrl: string }
};

/**
 * The people scanning a code are not signed in, so the public calls use their
 * own client (no token, no redirect to /login on errors).
 */
const publicApi = axios.create({ baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '') });

export const publicFeedbackApi = {
  form: async (code: string) =>
    (await publicApi.get(`/public/feedback/${code}`)).data as { kind: 'GUEST_FEEDBACK' | 'TESTIMONIAL'; hotelName: string | null; logoUrl: string | null; label: string | null; services: string[] | null },
  submit: async (code: string, payload: Record<string, unknown>) => (await publicApi.post(`/public/feedback/${code}`, payload)).data as { success: boolean; message: string }
};
