import { api } from './api';

/** USALI-aligned reports: statement lines, the hotel's mapping, and the statement. */

export interface UsaliLineDef { key: string; label: string; section: 'OPERATED' | 'UNDISTRIBUTED' | 'FEES' | 'NON_OPERATING' }
export interface UsaliDetail { key: string; label: string; amount: number; note?: string }
export interface MappingRow { key: string; label: string; line: string | null; defaultLine: string | null; custom: boolean }

export interface UsaliMappingResponse {
  lines: UsaliLineDef[];
  version: number;
  updatedAt: string | null;
  revenue: MappingRow[];
  expense: MappingRow[];
  labour: { category: string; departments: Record<string, string> };
}

interface OperatedLine {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
  marginPercent: number;
  labour: number;
  revenueDetail: UsaliDetail[];
  expenseDetail: UsaliDetail[];
}
interface CostLine { key: string; label: string; amount: number; percentOfRevenue: number; labour: number; detail: UsaliDetail[] }

export interface UsaliStatement {
  title: string;
  from: string;
  to: string;
  visibleFrom: string;
  basis: 'APPROVED' | 'PROVISIONAL';
  daysInRange: number;
  daysIncluded: number;
  pendingDays: number;
  mappingVersion: number;
  labourBasis: 'period' | 'latest' | 'none';
  budgetByLine: Record<string, number>;
  revenue: { lines: OperatedLine[]; total: number };
  departmentalExpenses: number;
  departmentalProfit: number;
  undistributed: { lines: CostLine[]; total: number };
  grossOperatingProfit: number;
  fees: { lines: CostLine[]; total: number };
  nonOperating: { income: number; expenses: number; detail: UsaliDetail[] };
  ebitda: number;
  excluded: Record<string, number>;
  labour: { total: number; byLine: Record<string, number>; percentOfRevenue: number };
  metrics: {
    roomsAvailable: number;
    roomsSold: number;
    occupancyPercent: number;
    adr: number;
    revpar: number;
    trevpar: number;
    gopMarginPercent: number;
    goppar: number;
    labourCostPercent: number;
  };
  unmapped: Array<{ kind: 'revenue' | 'expense'; key: string; amount: number }>;
}

export const usaliApi = {
  mapping: async () => (await api.get('/finance/usali/mapping')).data as UsaliMappingResponse,
  saveMapping: async (payload: { revenue: Record<string, string>; expense: Record<string, string> }) => (await api.put('/finance/usali/mapping', payload)).data,
  statement: async (params: { from?: string; to?: string; basis?: 'approved' | 'provisional' }) =>
    (await api.get('/finance/usali/statement', { params })).data as UsaliStatement
};
