import { api } from './api';

/**
 * Payment approval: HR prepares → Admin or GM approves (bank or cash) →
 * the accountant marks it paid. See the backend's payment-record.controller.
 */

export type PaymentStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PAID' | 'REJECTED' | 'VOIDED';
export type PaymentType = 'PAYROLL' | 'OTHER';
export type PaymentMethod = 'BANK' | 'CASH';

export interface PaymentCapabilities {
  create: boolean;
  approve: boolean;
  book: boolean;
  markPaid: boolean;
}

export interface PaymentRecord {
  id: string;
  reference: string;
  type: PaymentType;
  status: PaymentStatus;
  description: string;
  category: string;
  payeeName: string | null;
  amount: number;
  payrollPeriod: string | null;
  paymentMethod: PaymentMethod | null;
  selfApproved: boolean;
  rejectionReason: string | null;
  voidReason: string | null;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdBy: string;
  submittedBy: string | null;
  approvedBy: string | null;
  createdByName: string | null;
  submittedByName: string | null;
  approvedByName: string | null;
  rejectedByName: string | null;
  paidMarkedByName: string | null;
  voidedByName: string | null;
  staffCount: number;
  expense: { id: string; reference: string; status: string } | null;
}

export type NewPayment =
  | { type: 'PAYROLL'; periodStart: string; periodEnd: string; description?: string }
  | { type: 'OTHER'; description: string; amount: number; category: string; payeeName?: string | null };

const download = async (path: string, filename: string) => {
  const response = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

export const paymentsApi = {
  list: async (status?: PaymentStatus) =>
    (await api.get('/finance/payment-records', { params: status ? { status } : {} })).data as { records: PaymentRecord[]; capabilities: PaymentCapabilities },
  create: async (input: NewPayment) => (await api.post('/finance/payment-records', input)).data as PaymentRecord,
  remove: async (id: string) => (await api.delete(`/finance/payment-records/${id}`)).data,
  submit: async (id: string) => (await api.post(`/finance/payment-records/${id}/submit`)).data,
  approve: async (id: string, paymentMethod: PaymentMethod) =>
    (await api.post(`/finance/payment-records/${id}/approve`, { paymentMethod })).data as { selfApproved: boolean; expense: { reference: string } },
  reject: async (id: string, reason: string) => (await api.post(`/finance/payment-records/${id}/reject`, { reason })).data,
  void: async (id: string, reason: string) => (await api.post(`/finance/payment-records/${id}/void`, { reason })).data,
  markPaid: async (ids: string[]) =>
    (await api.post('/finance/payment-records/mark-paid', { ids })).data as { paid: number; failed: number; message: string; results: Array<{ reference: string; ok: boolean; error?: string }> },
  book: async (status: 'APPROVED' | 'PAID' | 'ALL') =>
    (await api.get('/finance/payment-records/book', { params: { status } })).data as { records: PaymentRecord[]; total: number },
  downloadBook: (status: 'APPROVED' | 'PAID' | 'ALL', format: 'csv' | 'pdf') =>
    download(`/finance/payment-records/book?status=${status}&format=${format}`, `payment-book-${new Date().toISOString().slice(0, 10)}.${format}`),
  /** Opens the PDF in a new tab for printing. */
  printBook: async (status: 'APPROVED' | 'PAID' | 'ALL') => {
    const response = await api.get(`/finance/payment-records/book?status=${status}&format=pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data as Blob);
    const tab = window.open(url, '_blank');
    if (tab) tab.addEventListener('load', () => tab.print());
  }
};

export const STATUS_LABEL: Record<PaymentStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Approved — to pay',
  PAID: 'Paid',
  REJECTED: 'Rejected',
  VOIDED: 'Voided'
};

export const STATUS_COLOR: Record<PaymentStatus, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  PAID: 'success',
  REJECTED: 'error',
  VOIDED: 'default'
};

export const apiError = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message
  ?? (err as { response?: { data?: { error?: string } } }).response?.data?.error
  ?? fallback;
