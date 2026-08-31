import { api } from './api';

export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Expense {
  id: string;
  expenseDate: string;
  reference: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  vendor: string | null;
  receiptUrl: string | null;
  status: ExpenseStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  recordedBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ExpenseTotals {
  pending: number;
  approved: number;
  rejected: number;
  net: number;
}

export interface Transaction {
  id: string;
  reference: string;
  amount: number;
  paymentMethod: string;
  paymentProvider: string | null;
  status: string;
  source: 'RESERVATION' | 'POS' | 'OTHER';
  isRefund: boolean;
  createdAt: string;
  booking?: {
    id: string;
    bookingNumber: string;
    guest?: { firstName: string; lastName: string } | null;
    room?: { roomNumber: string } | null;
  } | null;
  posOrder?: {
    id: string;
    orderNumber: string;
    outlet?: { name: string } | null;
  } | null;
}

export const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER', 'POS_TERMINAL', 'CHEQUE'];

export const financeService = {
  // ─── Expenses ──────────────────────────────────────────────────────────────

  listCategories: async (): Promise<string[]> => {
    const { data } = await api.get('/finance/expense-categories');
    return Array.isArray(data) ? data : [];
  },

  listExpenses: async (params?: {
    from?: string;
    to?: string;
    status?: ExpenseStatus | '';
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Expense[]; total: number; totals: ExpenseTotals }> => {
    const { data } = await api.get('/finance/expenses', { params });
    return {
      data: data?.data ?? [],
      total: data?.total ?? 0,
      totals: data?.totals ?? { pending: 0, approved: 0, rejected: 0, net: 0 }
    };
  },

  expenseSummary: async (params?: { from?: string; to?: string }) => {
    const { data } = await api.get('/finance/expenses/summary', { params });
    return data as {
      total: number;
      categories: Array<{ category: string; total: number; count: number }>;
    };
  },

  createExpense: async (payload: Partial<Expense>): Promise<Expense> => {
    const { data } = await api.post('/finance/expenses', payload);
    return data;
  },

  updateExpense: async (id: string, payload: Partial<Expense>): Promise<Expense> => {
    const { data } = await api.put(`/finance/expenses/${id}`, payload);
    return data;
  },

  approveExpense: async (id: string): Promise<Expense> => {
    const { data } = await api.put(`/finance/expenses/${id}/approve`, {});
    return data;
  },

  rejectExpense: async (id: string, reason: string): Promise<Expense> => {
    const { data } = await api.put(`/finance/expenses/${id}/reject`, { reason });
    return data;
  },

  deleteExpense: async (id: string): Promise<void> => {
    await api.delete(`/finance/expenses/${id}`);
  },

  // ─── Transaction history ───────────────────────────────────────────────────

  listTransactions: async (params?: {
    source?: 'RESERVATION' | 'POS' | '';
    status?: string;
    paymentMethod?: string;
    q?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    data: Transaction[];
    total: number;
    totalsByMethod: Array<{ paymentMethod: string; total: number }>;
  }> => {
    const { data } = await api.get('/payments/history', { params });
    return {
      data: data?.data ?? [],
      total: data?.total ?? 0,
      totalsByMethod: data?.totalsByMethod ?? []
    };
  }
};

export default financeService;
