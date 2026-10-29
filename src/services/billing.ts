import { api } from './api';

/** HotelOpX's own quotes and invoices (super admin). */

export type DocKind = 'QUOTE' | 'INVOICE';
export type DocStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'CONVERTED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';

export interface BillingLine {
  description: string;
  details?: string | null;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxRate: number;
  amount?: number;
}

export interface BillingDoc {
  id: string;
  kind: DocKind;
  number: string;
  status: DocStatus;
  hotelId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  issueDate: string;
  dueDate: string | null;
  lines: BillingLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balance: number;
  overdue: boolean;
  payments: Array<{ amount: number; method: string; reference?: string | null; paidAt: string }> | null;
  notes: string | null;
  terms: string | null;
  convertedFromId: string | null;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export type DocInput = Omit<BillingDoc, 'id' | 'number' | 'status' | 'subtotal' | 'discountTotal' | 'taxTotal' | 'total' | 'amountPaid' | 'balance' | 'overdue' | 'payments' | 'convertedFromId' | 'sentAt' | 'paidAt' | 'createdAt'>;

export const billingApi = {
  list: async (params: { kind?: DocKind; status?: string; search?: string }) =>
    (await api.get('/admin/billing', { params })).data as { documents: BillingDoc[]; summary: { outstanding: number; overdue: number; paidThisMonth: number; openQuotes: number } },
  get: async (id: string) => (await api.get(`/admin/billing/${id}`)).data as BillingDoc,
  create: async (input: DocInput) => (await api.post('/admin/billing', input)).data as BillingDoc,
  update: async (id: string, input: Omit<DocInput, 'kind'>) => (await api.put(`/admin/billing/${id}`, input)).data as BillingDoc,
  remove: async (id: string) => (await api.delete(`/admin/billing/${id}`)).data,
  send: async (id: string, message?: string) => (await api.post(`/admin/billing/${id}/send`, { message })).data as BillingDoc,
  setStatus: async (id: string, status: DocStatus) => (await api.post(`/admin/billing/${id}/status`, { status })).data as BillingDoc,
  convert: async (id: string) => (await api.post(`/admin/billing/${id}/convert`)).data as BillingDoc,
  pay: async (id: string, payment: { amount: number; method: string; reference?: string; paidAt?: string }) =>
    (await api.post(`/admin/billing/${id}/payments`, payment)).data as BillingDoc
};

export const STATUS_LABEL: Record<DocStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  CONVERTED: 'Invoiced',
  PARTIALLY_PAID: 'Part paid',
  PAID: 'Paid',
  VOID: 'Void'
};

/** Same arithmetic as the server, for the live preview while editing. */
export const lineAmount = (l: BillingLine) => {
  const gross = l.quantity * l.unitPrice;
  const net = gross - gross * ((l.discountPct || 0) / 100);
  return Math.round((net + net * ((l.taxRate || 0) / 100)) * 100) / 100;
};
export const totalsOf = (lines: BillingLine[]) => {
  let subtotal = 0, discount = 0, tax = 0;
  for (const l of lines) {
    const gross = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
    const d = gross * ((Number(l.discountPct) || 0) / 100);
    subtotal += gross;
    discount += d;
    tax += (gross - d) * ((Number(l.taxRate) || 0) / 100);
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { subtotal: r(subtotal), discount: r(discount), tax: r(tax), total: r(subtotal - discount + tax) };
};
