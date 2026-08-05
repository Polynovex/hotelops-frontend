import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

export const api = axios.create({
  baseURL: API_URL
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const token = useAuthStore.getState().token;
    const isDemo = token?.startsWith('demo-token');
    const isAuthEndpoint =
      error.config?.url?.includes('/auth/login') ||
      error.config?.url?.includes('/auth/usercode-login');
    if (!isDemo && !isAuthEndpoint && error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export type UserRole =
  | 'SUPER_ADMIN'
  | 'BUSINESS_ADMIN'
  | 'RECEPTION'
  | 'RECEPTIONIST'
  | 'POS_STAFF'
  | 'HOUSEKEEPING'
  | 'ACCOUNTANT'
  | 'MANAGER';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: UserRole;
  hotelId?: string;
  hotelName?: string;
  pmsEnabled?: boolean;
  posEnabled?: boolean;
  financeEnabled?: boolean;
  mustResetPassword?: boolean;
  userCode?: string | null;
}

export interface PlanSummary {
  id: string;
  code: string;
  name: string;
  monthlyPriceNgn: number;
  annualPriceNgn: number;
  isActive: boolean;
  _count?: {
    hotels: number;
  };
  addons?: PlanAddon[];
  maxRooms?: number | null;
  maxPosTerminals?: number | null;
  hasPms?: boolean;
  hasPos?: boolean;
  hasBasicFinance?: boolean;
  hasFullFinance?: boolean;
  hasOffline?: boolean;
  hasMultiProperty?: boolean;
  hasAdvancedAnalytics?: boolean;
  hasApiAccess?: boolean;
  supportLevel?: 'EMAIL' | 'PRIORITY' | 'DEDICATED' | string;
}

export interface PlanAddon {
  id: string;
  planId: string;
  name: string;
  code: string;
  priceNgn: number;
  isPerTerminal: boolean;
}

export interface PlanPayload {
  code: string;
  name: string;
  monthlyPriceNgn: number;
  annualPriceNgn: number;
  maxRooms?: number | null;
  maxPosTerminals?: number | null;
  hasPms?: boolean;
  hasPos?: boolean;
  hasBasicFinance?: boolean;
  hasFullFinance?: boolean;
  hasOffline?: boolean;
  hasMultiProperty?: boolean;
  hasAdvancedAnalytics?: boolean;
  hasApiAccess?: boolean;
  supportLevel?: 'EMAIL' | 'PRIORITY' | 'DEDICATED';
}

export interface BusinessSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: 'CREATED' | 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'DELETED';
  subscriptionTier: string;
  pmsEnabled: boolean;
  posEnabled: boolean;
  financeEnabled: boolean;
  planId?: string | null;
  plan?: PlanSummary | null;
  createdAt: string;
  _count?: {
    users: number;
    rooms: number;
    bookings: number;
  };
}

export type BusinessModuleName = 'pms' | 'pos' | 'finance';

export interface BusinessModuleStatus {
  businessId: string;
  pms: {
    enabled: boolean;
    deactivatedAt?: string | null;
    deactivatedBy?: string | null;
    reason?: string | null;
  };
  pos: {
    enabled: boolean;
    deactivatedAt?: string | null;
    deactivatedBy?: string | null;
    reason?: string | null;
  };
  finance: {
    enabled: boolean;
    deactivatedAt?: string | null;
    deactivatedBy?: string | null;
    reason?: string | null;
  };
}

export interface SystemAuditEntry {
  id: string;
  hotelId: string;
  userId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  };
}

export interface SystemMetrics {
  totalBusinesses: number;
  activeBusinesses: number;
  trialBusinesses: number;
  suspendedBusinesses: number;
  recentSignups: number;
  totalPlans: number;
  mrr: number;
}

export interface SystemEventsSnapshot {
  pendingEvents: number;
  processedEvents: number;
  recentEvents: Array<{
    id: string;
    eventType: string;
    createdAt: string;
    processed?: boolean;
  }>;
}

export interface DashboardMetrics {
  occupancyRate: string | number;
  totalRooms: number;
  occupiedRooms: number;
  todayRevenue: number;
  monthRevenue: number;
  posSales: number;
}

export type DashboardActivityType =
  | 'CREATE_RESERVATION'
  | 'UPDATE_RESERVATION'
  | 'CANCEL_RESERVATION'
  | 'CHECK_IN'
  | 'CHECK_OUT';

export interface DashboardActivity {
  id: string;
  type: DashboardActivityType;
  label: string;
  details?: string | null;
  createdAt: string;
  actorName: string;
  entityId?: string | null;
}

export interface DashboardOverview {
  generatedAt: string;
  widgets: {
    arrivalsToday: number;
    inHouseGuests: number;
    occupancyRate: number;
    totalRooms: number;
    occupiedRooms: number;
  };
  roomStatus: {
    clean: number;
    dirty: number;
    occupied: number;
    reserved: number;
    outOfOrder: number;
    vacant: number;
    blocked: number;
    dueOut: number;
    total: number;
  };
  revenue: {
    today: number;
    month: number;
    posSales: number;
  };
  recentActivity: DashboardActivity[];
}

export interface DashboardSearchResult {
  id: string;
  reservationId: string;
  bookingNumber: string;
  guestName: string;
  roomNumber?: string | null;
  status: string;
  invoiceNumber?: string | null;
  checkIn: string;
  checkOut: string;
  matchedOn: 'guest_name' | 'confirmation_number' | 'invoice_number';
}

export interface BookingSummary {
  id: string;
  bookingNumber: string;
  status: string;
  checkIn: string;
  checkOut: string;
  totalAmount?: number;
  guest?: {
    firstName: string;
    lastName: string;
  };
  room?: {
    roomNumber: string;
  };
}

export interface Outlet {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

export interface PosOrder {
  id: string;
  orderNumber: string;
  outletId: string;
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ROOM_SERVICE' | 'NO_CHARGE';
  orderStatus: 'OPEN' | 'SENT_TO_KITCHEN' | 'COMPLETED' | 'VOIDED';
  tableNumber?: string | null;
  subtotal: number;
  tax: number;
  total: number;
  paymentStatus: string;
  createdAt: string;
  outlet?: Outlet;
}

export interface PosMenuItem {
  id: string;
  hotelId?: string;
  outletId: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  taxRate?: number;
  cost?: number;
  category?: string;
  kitchenStation?: string;
  modifiers?: unknown[];
  imageUrl?: string;
  isActive: boolean;
  isAvailable: boolean;
  canBeDiscounted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChartOfAccount {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE' | string;
  isActive: boolean;
  currentBalance: number;
  openingBalance: number;
  createdAt: string;
}

export interface JournalLine {
  id?: string;
  accountCode: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface Journal {
  id: string;
  journalNumber: string;
  journalDate: string;
  reference?: string | null;
  description?: string | null;
  status: 'DRAFT' | 'POSTED' | 'REVERSED' | string;
  totalDebit: number;
  totalCredit: number;
  lines: JournalLine[];
}

export interface BankAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  currency: string;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
}

export interface BankTransaction {
  id: string;
  transactionDate: string;
  description: string;
  reference?: string | null;
  amount: number;
  transactionType: string;
  status: 'UNRECONCILED' | 'RECONCILED' | 'FLAGGED' | string;
}

export interface Budget {
  id: string;
  budgetName: string;
  fiscalYear: number;
  accountCode: string;
  version: string;
  total: number;
  createdAt: string;
}

export interface FixedAsset {
  id: string;
  assetCode: string;
  assetName: string;
  category: string;
  purchaseCost: number;
  currentValue: number;
  accumulatedDepr: number;
  status: 'ACTIVE' | 'DISPOSED' | 'WRITTEN_OFF' | string;
  purchaseDate: string;
}

export interface TrialBalanceReport {
  period: { startDate: string | null; endDate: string | null };
  rows: Array<{
    accountCode: string;
    accountName: string;
    accountType: string;
    periodDebit: number;
    periodCredit: number;
    closingBalance: number;
  }>;
  totals: { totalDebit: number; totalCredit: number };
}

export interface ProfitLossReport {
  period: { startDate: string | null; endDate: string | null };
  income: Array<{ code: string; name: string; amount: number }>;
  expenses: Array<{ code: string; name: string; amount: number }>;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
}

export interface BalanceSheetReport {
  asOfDate: string;
  assets: Array<{ code: string; name: string; balance: number }>;
  liabilities: Array<{ code: string; name: string; balance: number }>;
  equity: Array<{ code: string; name: string; balance: number }>;
  totals: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    liabilitiesAndEquity: number;
  };
}

export interface AgingReport {
  rows: Array<Record<string, unknown>>;
  summary: {
    '0-30': number;
    '31-60': number;
    '61-90': number;
    '90+': number;
    total: number;
  };
}

export interface VatSummaryReport {
  period: { startDate: string | null; endDate: string | null };
  vatRate: number;
  taxableAmount: number;
  vatAmount: number;
}

export interface GeneralLedgerReport {
  account: { accountCode: string; accountName: string; accountType: string };
  period: { startDate: string | null; endDate: string | null };
  entries: Array<{
    date: string;
    journalNumber: string;
    reference?: string | null;
    description?: string | null;
    debit: number;
    credit: number;
    runningBalance: number;
  }>;
  totals: { debit: number; credit: number };
}

export interface NightAuditHistoryRecord {
  id: string;
  auditDate: string;
  closedAt?: string | null;
  closedBy?: string | null;
  totalRevenue: number;
  totalBookings: number;
  totalPosSales: number;
  receptionTotal?: number;
  posTotal?: number;
  difference?: number;
  outstandingAR?: number;
  revenueJournalId?: string | null;
  status?: string;
  workflowStatus?: string;
  notes?: string | null;
}

export interface NightAuditStatus {
  businessDate: string;
  lastAuditDate: string | null;
  lockedUntil: string | null;
  isOpen: boolean;
  latestAudit?: NightAuditHistoryRecord | null;
}

export interface NightAuditSnapshot {
  totalRevenue: number;
  posTotal: number;
  checkoutCount: number;
  openOrders: number;
  outstandingBookings: number;
  roomRevenue: number;
  posRevenue: number;
  receptionTotals: {
    cash: number;
    card: number;
    transfer: number;
    company: number;
    other: number;
  };
}

export interface NightAuditValidationResult {
  auditDate: string;
  valid: boolean;
  errors: string[];
  snapshot?: NightAuditSnapshot;
}

export interface NightAuditRunResult {
  success: boolean;
  auditId: string;
  journalId?: string;
  dateClosed: string;
  newBusinessDate: string;
}

const DEMO_MODE_ENABLED = import.meta.env.VITE_ENABLE_DEMO_MODE !== 'false';
const isDemoMode = () => DEMO_MODE_ENABLED && useAuthStore.getState().token?.startsWith('demo-token');

const unwrapData = <T>(payload: unknown): T => {
  const dataPayload = payload as { data?: T };
  if (dataPayload && typeof dataPayload === 'object' && 'data' in dataPayload && dataPayload.data !== undefined) {
    return dataPayload.data as T;
  }
  return payload as T;
};

const asArray = <T>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  const maybe = payload as { items?: T[]; rows?: T[]; data?: T[] };
  return maybe.items || maybe.rows || maybe.data || [];
};

const normalizeRole = (role: unknown): UserRole => {
  const value = String(role || '').toUpperCase();
  if (value === 'RECEPTION') return 'RECEPTIONIST';
  if (value === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (value === 'BUSINESS_ADMIN') return 'BUSINESS_ADMIN';
  if (value === 'RECEPTIONIST') return 'RECEPTIONIST';
  if (value === 'POS_STAFF') return 'POS_STAFF';
  if (value === 'HOUSEKEEPING') return 'HOUSEKEEPING';
  if (value === 'ACCOUNTANT') return 'ACCOUNTANT';
  if (value === 'MANAGER') return 'MANAGER';
  return 'BUSINESS_ADMIN';
};

const normalizeUser = (rawUser: Omit<AuthUser, 'name'> & Partial<Pick<AuthUser, 'name'>>): AuthUser => {
  return {
    ...rawUser,
    role: normalizeRole(rawUser.role),
    name: rawUser.name || `${rawUser.firstName} ${rawUser.lastName}`.trim()
  };
};

const DEMO_USERS: Array<{ email: string; password: string; user: AuthUser }> = [
  {
    email: 'superadmin@hotelopx.com',
    password: 'demo123',
    user: normalizeUser({
      id: '1',
      email: 'superadmin@hotelopx.com',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      hotelId: 'demo-hotel-1'
    })
  },
  {
    email: 'admin@demo.com',
    password: 'demo123',
    user: normalizeUser({
      id: '2',
      email: 'admin@demo.com',
      firstName: 'Business',
      lastName: 'Admin',
      role: 'BUSINESS_ADMIN',
      hotelId: 'demo-hotel-1'
    })
  },
  {
    email: 'manager@demo.com',
    password: 'demo123',
    user: normalizeUser({
      id: '6',
      email: 'manager@demo.com',
      firstName: 'Ops',
      lastName: 'Manager',
      role: 'MANAGER',
      hotelId: 'demo-hotel-1'
    })
  },
  {
    email: 'accounting@demo.com',
    password: 'demo123',
    user: normalizeUser({
      id: '7',
      email: 'accounting@demo.com',
      firstName: 'Finance',
      lastName: 'Officer',
      role: 'ACCOUNTANT',
      hotelId: 'demo-hotel-1'
    })
  },
  {
    email: 'reception@demo.com',
    password: 'demo123',
    user: normalizeUser({
      id: '3',
      email: 'reception@demo.com',
      firstName: 'Front',
      lastName: 'Desk',
      role: 'RECEPTIONIST',
      hotelId: 'demo-hotel-1'
    })
  },
  {
    email: 'pos@demo.com',
    password: 'demo123',
    user: normalizeUser({
      id: '4',
      email: 'pos@demo.com',
      firstName: 'POS',
      lastName: 'Staff',
      role: 'POS_STAFF',
      hotelId: 'demo-hotel-1'
    })
  },
  {
    email: 'housekeeping@demo.com',
    password: 'demo123',
    user: normalizeUser({
      id: '5',
      email: 'housekeeping@demo.com',
      firstName: 'House',
      lastName: 'Keeping',
      role: 'HOUSEKEEPING',
      hotelId: 'demo-hotel-1'
    })
  }
];

const startOfDayIso = (date: Date | string = new Date()) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized.toISOString();
};

const addDaysIso = (isoDate: string, days: number) => {
  const value = new Date(isoDate);
  value.setDate(value.getDate() + days);
  return startOfDayIso(value);
};

const isFutureDay = (auditDate: string, businessDate: string) => {
  return new Date(startOfDayIso(auditDate)).getTime() > new Date(startOfDayIso(businessDate)).getTime();
};

let demoBusinesses: BusinessSummary[] = [
  {
    id: 'demo-hotel-1',
    name: 'Demo Hotel Lagos',
    email: 'demo@hotelopx.com',
    phone: '+2348000000000',
    address: 'Victoria Island, Lagos',
    status: 'ACTIVE',
    subscriptionTier: 'M',
    pmsEnabled: true,
    posEnabled: true,
    financeEnabled: true,
    planId: 'plan-m',
    plan: {
      id: 'plan-m',
      code: 'M',
      name: 'Medium Hotel',
      monthlyPriceNgn: 175000,
      annualPriceNgn: 1680000,
      isActive: true,
      _count: { hotels: 1 }
    },
    createdAt: new Date().toISOString(),
    _count: { users: 6, rooms: 50, bookings: 120 }
  }
];

const demoPlans: PlanSummary[] = [
  { id: 'plan-s', code: 'S', name: 'Small Hotel', monthlyPriceNgn: 75000, annualPriceNgn: 720000, isActive: true, _count: { hotels: 0 } },
  { id: 'plan-m', code: 'M', name: 'Medium Hotel', monthlyPriceNgn: 175000, annualPriceNgn: 1680000, isActive: true, _count: { hotels: 1 } },
  { id: 'plan-e', code: 'E', name: 'Enterprise', monthlyPriceNgn: 0, annualPriceNgn: 0, isActive: true, _count: { hotels: 0 } }
];

let demoOutlets: Outlet[] = [
  { id: 'outlet-1', name: 'Main Restaurant', type: 'RESTAURANT', isActive: true },
  { id: 'outlet-2', name: 'Lobby Bar', type: 'BAR', isActive: true }
];

let demoOrders: PosOrder[] = [
  {
    id: 'ord-1',
    orderNumber: 'POS-10001',
    outletId: 'outlet-1',
    orderType: 'DINE_IN',
    orderStatus: 'OPEN',
    tableNumber: '12',
    subtotal: 12000,
    tax: 900,
    total: 12900,
    paymentStatus: 'PENDING',
    createdAt: new Date().toISOString(),
    outlet: demoOutlets[0]
  },
  {
    id: 'ord-2',
    orderNumber: 'POS-10002',
    outletId: 'outlet-2',
    orderType: 'TAKEAWAY',
    orderStatus: 'COMPLETED',
    tableNumber: null,
    subtotal: 6500,
    tax: 487.5,
    total: 6987.5,
    paymentStatus: 'COMPLETED',
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    outlet: demoOutlets[1]
  }
];

let demoChartOfAccounts: ChartOfAccount[] = [
  {
    id: 'coa-1000',
    accountCode: '1000',
    accountName: 'Cash',
    accountType: 'ASSET',
    isActive: true,
    currentBalance: 1500000,
    openingBalance: 1000000,
    createdAt: new Date().toISOString()
  },
  {
    id: 'coa-4100',
    accountCode: '4100',
    accountName: 'Room Revenue',
    accountType: 'INCOME',
    isActive: true,
    currentBalance: 8500000,
    openingBalance: 0,
    createdAt: new Date().toISOString()
  }
];

let demoJournals: Journal[] = [
  {
    id: 'jr-1',
    journalNumber: 'JR-2026001',
    journalDate: new Date().toISOString(),
    description: 'Demo posted journal',
    status: 'POSTED',
    totalDebit: 50000,
    totalCredit: 50000,
    lines: [
      { accountCode: '1000', debit: 50000, credit: 0, description: 'Cash receipt' },
      { accountCode: '4100', debit: 0, credit: 50000, description: 'Room revenue' }
    ]
  }
];

let demoBankAccounts: BankAccount[] = [
  {
    id: 'bank-1',
    accountName: 'HotelOpX Operations',
    accountNumber: '0012345678',
    bankName: 'GTBank',
    currency: 'NGN',
    openingBalance: 2500000,
    currentBalance: 2650000,
    isActive: true
  }
];

let demoBankTransactions: BankTransaction[] = [
  {
    id: 'txn-1',
    transactionDate: new Date().toISOString(),
    description: 'Opening balance',
    reference: 'OPEN-BANK-1',
    amount: 2500000,
    transactionType: 'OPENING_BALANCE',
    status: 'RECONCILED'
  }
];

let demoBudgets: Budget[] = [
  {
    id: 'budget-1',
    budgetName: 'FY26 Original',
    fiscalYear: 2026,
    accountCode: '5200',
    version: 'Original',
    total: 1200000,
    createdAt: new Date().toISOString()
  }
];

let demoFixedAssets: FixedAsset[] = [
  {
    id: 'asset-1',
    assetCode: 'FA-001',
    assetName: 'Industrial Generator',
    category: 'Equipment',
    purchaseCost: 12000000,
    currentValue: 11800000,
    accumulatedDepr: 200000,
    status: 'ACTIVE',
    purchaseDate: new Date().toISOString()
  }
];

const demoAuditActor = {
  id: '1',
  email: 'superadmin@hotelopx.com',
  firstName: 'Super',
  lastName: 'Admin',
  role: 'SUPER_ADMIN'
};

type DemoModuleMetadata = {
  enabled: boolean;
  deactivatedAt?: string | null;
  deactivatedBy?: string | null;
  reason?: string | null;
};

const buildDemoModuleMetadata = (business: BusinessSummary | undefined, enabled: boolean): DemoModuleMetadata => ({
  enabled,
  ...(enabled
    ? {}
    : {
        deactivatedAt: business?.createdAt || new Date().toISOString(),
        deactivatedBy: demoAuditActor.email,
        reason: 'Demo deactivation metadata'
      })
});

const demoModuleStateByBusiness: Record<string, Record<BusinessModuleName, DemoModuleMetadata>> = {};

const ensureDemoModuleState = (businessId: string) => {
  if (!demoModuleStateByBusiness[businessId]) {
    const business = demoBusinesses.find((entry) => entry.id === businessId);
    demoModuleStateByBusiness[businessId] = {
      pms: buildDemoModuleMetadata(business, business?.pmsEnabled ?? true),
      pos: buildDemoModuleMetadata(business, business?.posEnabled ?? true),
      finance: buildDemoModuleMetadata(business, business?.financeEnabled ?? true)
    };
  }
  return demoModuleStateByBusiness[businessId];
};

let demoSystemAuditLogs: SystemAuditEntry[] = [
  {
    id: 'audit-demo-1',
    hotelId: 'demo-hotel-1',
    userId: demoAuditActor.id,
    action: 'DEACTIVATE_MODULE',
    entity: 'BusinessModule',
    entityId: 'demo-hotel-1',
    changes: {
      module: 'pos',
      reason: 'Payment dispute'
    },
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    user: demoAuditActor
  },
  {
    id: 'audit-demo-2',
    hotelId: 'demo-hotel-1',
    userId: demoAuditActor.id,
    action: 'REACTIVATE_MODULE',
    entity: 'BusinessModule',
    entityId: 'demo-hotel-1',
    changes: {
      module: 'pos'
    },
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    user: demoAuditActor
  }
];

let demoNightAudits: NightAuditHistoryRecord[] = [
  {
    id: 'night-audit-demo-1',
    auditDate: addDaysIso(startOfDayIso(new Date()), -1),
    closedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    closedBy: 'accounting@demo.com',
    totalRevenue: 5040000,
    totalBookings: 28,
    totalPosSales: 3320000,
    receptionTotal: 5040000,
    posTotal: 3320000,
    difference: 1720000,
    outstandingAR: 150000,
    revenueJournalId: 'JNL-20260303-001',
    status: 'COMPLETED',
    workflowStatus: 'COMPLETED',
    notes: 'Demo close'
  }
];

let demoNightAuditState: NightAuditStatus = {
  businessDate: startOfDayIso(new Date()),
  lastAuditDate: addDaysIso(startOfDayIso(new Date()), -1),
  lockedUntil: addDaysIso(startOfDayIso(new Date()), -1),
  isOpen: true,
  latestAudit: demoNightAudits[0]
};

const updateDemoBusiness = (id: string, data: Partial<BusinessSummary>) => {
  const index = demoBusinesses.findIndex((business) => business.id === id);
  if (index < 0) {
    return undefined;
  }
  demoBusinesses[index] = { ...demoBusinesses[index], ...data };
  return demoBusinesses[index];
};

const buildDemoModuleStatus = (businessId: string): BusinessModuleStatus => {
  const business = demoBusinesses.find((entry) => entry.id === businessId);
  const moduleState = ensureDemoModuleState(businessId);

  return {
    businessId,
    pms: {
      enabled: business?.pmsEnabled ?? moduleState.pms.enabled,
      deactivatedAt: moduleState.pms.deactivatedAt || null,
      deactivatedBy: moduleState.pms.deactivatedBy || null,
      reason: moduleState.pms.reason || null
    },
    pos: {
      enabled: business?.posEnabled ?? moduleState.pos.enabled,
      deactivatedAt: moduleState.pos.deactivatedAt || null,
      deactivatedBy: moduleState.pos.deactivatedBy || null,
      reason: moduleState.pos.reason || null
    },
    finance: {
      enabled: business?.financeEnabled ?? moduleState.finance.enabled,
      deactivatedAt: moduleState.finance.deactivatedAt || null,
      deactivatedBy: moduleState.finance.deactivatedBy || null,
      reason: moduleState.finance.reason || null
    }
  };
};

export const authService = {
  login: async (
    email: string,
    password: string
  ): Promise<{ token: string; refreshToken?: string; user: AuthUser }> => {
    const demoUser = DEMO_MODE_ENABLED
      ? DEMO_USERS.find((entry) => entry.email === email && entry.password === password)
      : undefined;

    if (demoUser) {
      const business = demoUser.user.hotelId
        ? demoBusinesses.find((entry) => entry.id === demoUser.user.hotelId)
        : undefined;
      return {
        token: `demo-token-${demoUser.user.role}`,
        user: normalizeUser({
          ...demoUser.user,
          pmsEnabled: business?.pmsEnabled ?? true,
          posEnabled: business?.posEnabled ?? true,
          financeEnabled: business?.financeEnabled ?? true
        })
      };
    }

    const response = await api.post('/auth/login', { email, password });
    const token = response.data.accessToken || response.data.token;
    if (!token) {
      throw new Error('No access token returned from login endpoint');
    }

    return {
      token,
      refreshToken: response.data.refreshToken,
      user: normalizeUser(response.data.user)
    };
  },
  getMe: async (): Promise<AuthUser> => {
    if (isDemoMode()) {
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) {
        throw new Error('No active session');
      }

      const business = currentUser.hotelId
        ? demoBusinesses.find((entry) => entry.id === currentUser.hotelId)
        : undefined;

      return normalizeUser({
        ...currentUser,
        role: normalizeRole(currentUser.role),
        pmsEnabled: business?.pmsEnabled ?? currentUser.pmsEnabled ?? true,
        posEnabled: business?.posEnabled ?? currentUser.posEnabled ?? true,
        financeEnabled: business?.financeEnabled ?? currentUser.financeEnabled ?? true
      });
    }

    const response = await api.get('/auth/me');
    return normalizeUser(unwrapData<AuthUser>(response.data));
  },
  register: async (data: unknown) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },
  userCodeLogin: async (
    userCode: string,
    pin?: string
  ): Promise<
    | { requiresPin: true }
    | { token: string; refreshToken?: string; user: AuthUser }
  > => {
    if (DEMO_MODE_ENABLED) {
      const DEMO_CODES: Record<string, AuthUser> = {
        '10001': normalizeUser({ id: '1', email: 'superadmin@hotelopx.com', firstName: 'Super', lastName: 'Admin', role: 'SUPER_ADMIN', hotelId: 'demo-hotel-1' }),
        '20001': normalizeUser({ id: '2', email: 'admin@demo.com', firstName: 'Business', lastName: 'Admin', role: 'BUSINESS_ADMIN', hotelId: 'demo-hotel-1', pmsEnabled: true, posEnabled: true, financeEnabled: true }),
        '30001': normalizeUser({ id: '6', email: 'manager@demo.com', firstName: 'Ops', lastName: 'Manager', role: 'MANAGER', hotelId: 'demo-hotel-1', pmsEnabled: true, posEnabled: true, financeEnabled: true }),
        '40001': normalizeUser({ id: '3', email: 'reception@demo.com', firstName: 'Front', lastName: 'Desk', role: 'RECEPTIONIST', hotelId: 'demo-hotel-1', pmsEnabled: true, posEnabled: true, financeEnabled: true }),
        '50001': normalizeUser({ id: '4', email: 'pos@demo.com', firstName: 'POS', lastName: 'Staff', role: 'POS_STAFF', hotelId: 'demo-hotel-1', pmsEnabled: true, posEnabled: true, financeEnabled: true }),
        '60001': normalizeUser({ id: '5', email: 'housekeeping@demo.com', firstName: 'House', lastName: 'Keeping', role: 'HOUSEKEEPING', hotelId: 'demo-hotel-1', pmsEnabled: true, posEnabled: true, financeEnabled: true }),
        '70001': normalizeUser({ id: '7', email: 'accounting@demo.com', firstName: 'Finance', lastName: 'Officer', role: 'ACCOUNTANT', hotelId: 'demo-hotel-1', pmsEnabled: true, posEnabled: true, financeEnabled: true }),
      };
      const demoUser = DEMO_CODES[userCode.trim()];
      if (demoUser) {
        return {
          token: `demo-token-${demoUser.role}`,
          user: demoUser
        };
      }
    }
    const response = await api.post('/auth/usercode-login', { userCode, ...(pin && { pin }) });
    if (response.data?.requiresPin) {
      return { requiresPin: true };
    }
    const token = response.data.accessToken || response.data.token;
    if (!token) {
      throw new Error('No access token returned from usercode login');
    }
    return {
      token,
      refreshToken: response.data.refreshToken,
      user: normalizeUser(response.data.user)
    };
  },
  assignUserCode: async (userId: string): Promise<{ userCode: string }> => {
    const response = await api.post(`/users/${userId}/usercode`, {});
    return response.data;
  }
};

export const superAdminService = {
  getBusinesses: async (): Promise<BusinessSummary[]> => {
    if (isDemoMode()) {
      return demoBusinesses;
    }
    const response = await api.get('/admin/businesses');
    return asArray<BusinessSummary>(unwrapData<unknown>(response.data));
  },

  createBusiness: async (data: Partial<BusinessSummary>): Promise<BusinessSummary> => {
    if (isDemoMode()) {
      const created: BusinessSummary = {
        id: `demo-${Date.now()}`,
        name: data.name || 'New Business',
        email: data.email || 'business@demo.com',
        phone: data.phone || '+2348000000000',
        address: data.address || 'Lagos',
        status: 'TRIAL',
        subscriptionTier: data.subscriptionTier || 'S',
        pmsEnabled: data.pmsEnabled ?? true,
        posEnabled: data.posEnabled ?? true,
        financeEnabled: data.financeEnabled ?? true,
        createdAt: new Date().toISOString()
      };
      demoBusinesses = [created, ...demoBusinesses];
      return created;
    }
    const response = await api.post('/admin/businesses', data);
    return response.data;
  },

  updateBusiness: async (id: string, data: Partial<BusinessSummary>): Promise<BusinessSummary> => {
    if (isDemoMode()) {
      const updated = updateDemoBusiness(id, data);
      if (!updated) {
        throw new Error('Business not found');
      }
      return updated;
    }
    const response = await api.put(`/admin/businesses/${id}`, data);
    return response.data;
  },

  getBusinessModuleStatus: async (businessId: string): Promise<BusinessModuleStatus> => {
    if (isDemoMode()) {
      return buildDemoModuleStatus(businessId);
    }
    const response = await api.get(`/admin/businesses/${businessId}/modules/status`);
    return unwrapData<BusinessModuleStatus>(response.data);
  },

  deactivateBusinessModule: async (
    businessId: string,
    module: BusinessModuleName,
    reason?: string
  ): Promise<BusinessModuleStatus> => {
    if (isDemoMode()) {
      const field = `${module}Enabled` as keyof Pick<BusinessSummary, 'pmsEnabled' | 'posEnabled' | 'financeEnabled'>;
      updateDemoBusiness(businessId, { [field]: false } as Partial<BusinessSummary>);
      const moduleState = ensureDemoModuleState(businessId);
      moduleState[module] = {
        enabled: false,
        deactivatedAt: new Date().toISOString(),
        deactivatedBy: demoAuditActor.email,
        reason: reason || 'No reason supplied'
      };
      demoSystemAuditLogs = [
        {
          id: `audit-demo-${Date.now()}`,
          hotelId: businessId,
          userId: demoAuditActor.id,
          action: 'DEACTIVATE_MODULE',
          entity: 'BusinessModule',
          entityId: businessId,
          changes: {
            module,
            reason: reason || null
          },
          createdAt: new Date().toISOString(),
          user: demoAuditActor
        },
        ...demoSystemAuditLogs
      ];
      return buildDemoModuleStatus(businessId);
    }

    const response = await api.post(`/admin/businesses/${businessId}/modules/${module}/deactivate`, {
      reason
    });
    return unwrapData<BusinessModuleStatus>(response.data);
  },

  reactivateBusinessModule: async (
    businessId: string,
    module: BusinessModuleName
  ): Promise<BusinessModuleStatus> => {
    if (isDemoMode()) {
      const field = `${module}Enabled` as keyof Pick<BusinessSummary, 'pmsEnabled' | 'posEnabled' | 'financeEnabled'>;
      updateDemoBusiness(businessId, { [field]: true } as Partial<BusinessSummary>);
      const moduleState = ensureDemoModuleState(businessId);
      moduleState[module] = {
        enabled: true,
        deactivatedAt: null,
        deactivatedBy: null,
        reason: null
      };
      demoSystemAuditLogs = [
        {
          id: `audit-demo-${Date.now()}`,
          hotelId: businessId,
          userId: demoAuditActor.id,
          action: 'REACTIVATE_MODULE',
          entity: 'BusinessModule',
          entityId: businessId,
          changes: {
            module
          },
          createdAt: new Date().toISOString(),
          user: demoAuditActor
        },
        ...demoSystemAuditLogs
      ];
      return buildDemoModuleStatus(businessId);
    }

    const response = await api.post(`/admin/businesses/${businessId}/modules/${module}/reactivate`);
    return unwrapData<BusinessModuleStatus>(response.data);
  },

  activateBusiness: async (id: string) => {
    if (isDemoMode()) {
      return updateDemoBusiness(id, { status: 'ACTIVE' });
    }
    const response = await api.post(`/admin/businesses/${id}/activate`);
    return response.data;
  },

  suspendBusiness: async (id: string) => {
    if (isDemoMode()) {
      return updateDemoBusiness(id, { status: 'SUSPENDED' });
    }
    const response = await api.post(`/admin/businesses/${id}/suspend`);
    return response.data;
  },

  listPlans: async (): Promise<PlanSummary[]> => {
    if (isDemoMode()) {
      return demoPlans;
    }
    const response = await api.get('/admin/plans');
    return asArray<PlanSummary>(unwrapData<unknown>(response.data));
  },

  createPlan: async (payload: PlanPayload): Promise<PlanSummary> => {
    if (isDemoMode()) {
      const created: PlanSummary = {
        id: `plan-${Date.now()}`,
        ...payload,
        isActive: true,
        addons: [],
        _count: { hotels: 0 }
      };
      demoPlans.push(created);
      return created;
    }
    const response = await api.post('/admin/plans', payload);
    return unwrapData<PlanSummary>(response.data);
  },

  updatePlan: async (id: string, payload: Partial<PlanPayload>): Promise<PlanSummary> => {
    if (isDemoMode()) {
      const index = demoPlans.findIndex((plan) => plan.id === id);
      if (index < 0) {
        throw new Error('Plan not found');
      }
      demoPlans[index] = { ...demoPlans[index], ...payload };
      return demoPlans[index];
    }
    const response = await api.put(`/admin/plans/${id}`, payload);
    return unwrapData<PlanSummary>(response.data);
  },

  deletePlan: async (id: string): Promise<PlanSummary> => {
    if (isDemoMode()) {
      const index = demoPlans.findIndex((plan) => plan.id === id);
      if (index < 0) {
        throw new Error('Plan not found');
      }
      demoPlans[index] = { ...demoPlans[index], isActive: false };
      return demoPlans[index];
    }
    const response = await api.delete(`/admin/plans/${id}`);
    return unwrapData<PlanSummary>(response.data);
  },

  getPlanBusinesses: async (planId: string): Promise<BusinessSummary[]> => {
    if (isDemoMode()) {
      return demoBusinesses.filter((business) => business.planId === planId);
    }
    const response = await api.get(`/admin/plans/${planId}/businesses`);
    return asArray<BusinessSummary>(unwrapData<unknown>(response.data));
  },

  addPlanAddon: async (
    planId: string,
    payload: { name: string; code: string; priceNgn: number; isPerTerminal?: boolean }
  ): Promise<PlanAddon> => {
    if (isDemoMode()) {
      const addon: PlanAddon = {
        id: `addon-${Date.now()}`,
        planId,
        name: payload.name,
        code: payload.code,
        priceNgn: payload.priceNgn,
        isPerTerminal: Boolean(payload.isPerTerminal)
      };
      const plan = demoPlans.find((entry) => entry.id === planId);
      if (plan) {
        plan.addons = [...(plan.addons || []), addon];
      }
      return addon;
    }
    const response = await api.post(`/admin/plans/${planId}/addons`, payload);
    return unwrapData<PlanAddon>(response.data);
  },

  removePlanAddon: async (planId: string, addonId: string) => {
    if (isDemoMode()) {
      const plan = demoPlans.find((entry) => entry.id === planId);
      if (plan?.addons) {
        plan.addons = plan.addons.filter((addon) => addon.id !== addonId);
      }
      return { deleted: true };
    }
    const response = await api.delete(`/admin/plans/${planId}/addons/${addonId}`);
    return unwrapData<{ message?: string }>(response.data);
  },

  assignPlan: async (businessId: string, planId: string) => {
    if (isDemoMode()) {
      const plan = demoPlans.find((entry) => entry.id === planId);
      if (plan) {
        updateDemoBusiness(businessId, {
          planId: plan.id,
          plan,
          subscriptionTier: plan.code
        });
      }
      return { businessId, planId };
    }
    const response = await api.post(`/admin/businesses/${businessId}/assign-plan`, { planId });
    return response.data;
  },

  getSystemMetrics: async (): Promise<SystemMetrics> => {
    if (isDemoMode()) {
      return {
        totalBusinesses: demoBusinesses.length,
        activeBusinesses: demoBusinesses.filter((business) => business.status === 'ACTIVE').length,
        trialBusinesses: demoBusinesses.filter((business) => business.status === 'TRIAL').length,
        suspendedBusinesses: demoBusinesses.filter((business) => business.status === 'SUSPENDED').length,
        recentSignups: 2,
        totalPlans: demoPlans.length,
        mrr: 175000
      };
    }
    const response = await api.get('/admin/system/metrics');
    return response.data;
  },

  getSystemHealth: async (): Promise<{ status: string; services?: Record<string, string> }> => {
    if (isDemoMode()) {
      return { status: 'ok', services: { database: 'up', cache: 'up' } };
    }
    const response = await api.get('/admin/system/health');
    return unwrapData<{ status: string; services?: Record<string, string> }>(response.data);
  },

  getSystemEvents: async (): Promise<SystemEventsSnapshot> => {
    if (isDemoMode()) {
      return {
        pendingEvents: 3,
        processedEvents: 42,
        recentEvents: [
          {
            id: 'evt-1',
            eventType: 'Business.Activated',
            createdAt: new Date().toISOString(),
            processed: true
          },
          {
            id: 'evt-2',
            eventType: 'Order.Created',
            createdAt: new Date().toISOString(),
            processed: false
          }
        ]
      };
    }
    const response = await api.get('/admin/system/events');
    return unwrapData<SystemEventsSnapshot>(response.data);
  },

  getSystemAudit: async (params?: {
    userId?: string;
    action?: string;
    entity?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<SystemAuditEntry[]> => {
    if (isDemoMode()) {
      return demoSystemAuditLogs.filter((entry) => {
        if (params?.userId && entry.userId !== params.userId) return false;
        if (params?.action && entry.action !== params.action) return false;
        if (params?.entity && entry.entity !== params.entity) return false;
        if (params?.startDate && new Date(entry.createdAt).getTime() < new Date(params.startDate).getTime()) return false;
        if (params?.endDate && new Date(entry.createdAt).getTime() > new Date(params.endDate).getTime()) return false;
        return true;
      });
    }
    const response = await api.get('/admin/system/audit', { params });
    return asArray<SystemAuditEntry>(unwrapData<unknown>(response.data));
  }
};

export const dashboardService = {
  getOverview: async (activityType?: 'ALL' | DashboardActivityType): Promise<DashboardOverview> => {
    if (isDemoMode()) {
      const recentActivity: DashboardActivity[] = [
        {
          id: 'activity-1',
          type: 'CREATE_RESERVATION',
          label: 'New booking',
          details: 'RSV-240315',
          createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          actorName: 'Ada Front Desk',
          entityId: 'reservation-1'
        },
        {
          id: 'activity-2',
          type: 'CHECK_IN',
          label: 'Guest checked in',
          details: 'RSV-240301',
          createdAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
          actorName: 'Kelechi Okafor',
          entityId: 'reservation-2'
        },
        {
          id: 'activity-3',
          type: 'CANCEL_RESERVATION',
          label: 'Reservation cancelled',
          details: 'RSV-240288',
          createdAt: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
          actorName: 'Mercy Nwosu',
          entityId: 'reservation-3'
        }
      ];

      return {
        generatedAt: new Date().toISOString(),
        widgets: {
          arrivalsToday: 14,
          inHouseGuests: 38,
          occupancyRate: 76,
          totalRooms: 50,
          occupiedRooms: 38
        },
        roomStatus: {
          clean: 9,
          dirty: 4,
          occupied: 38,
          reserved: 6,
          outOfOrder: 2,
          vacant: 15,
          blocked: 2,
          dueOut: 7,
          total: 50
        },
        revenue: {
          today: 1250000,
          month: 28500000,
          posSales: 450000
        },
        recentActivity: recentActivity.filter(
          (item) => !activityType || activityType === 'ALL' || item.type === activityType
        )
      };
    }

    const response = await api.get('/dashboard', {
      params: activityType && activityType !== 'ALL' ? { activityType } : undefined
    });
    return unwrapData<DashboardOverview>(response.data);
  },

  getMetrics: async (): Promise<DashboardMetrics> => {
    if (isDemoMode()) {
      return {
        occupancyRate: '75.50',
        totalRooms: 50,
        occupiedRooms: 38,
        todayRevenue: 1250000,
        monthRevenue: 28500000,
        posSales: 450000
      };
    }
    const response = await api.get('/dashboard/metrics');
    return response.data;
  },

  searchReservations: async (query: string): Promise<{ total: number; results: DashboardSearchResult[] }> => {
    if (isDemoMode()) {
      const results: DashboardSearchResult[] = query.trim()
        ? [
            {
              id: 'reservation-1',
              reservationId: 'reservation-1',
              bookingNumber: 'RSV-240315',
              guestName: 'Chinasa Eze',
              roomNumber: '304',
              status: 'CONFIRMED',
              invoiceNumber: 'INV-10923',
              checkIn: new Date().toISOString(),
              checkOut: new Date(Date.now() + 2 * 86400000).toISOString(),
              matchedOn: 'guest_name'
            }
          ]
        : [];

      return {
        total: results.length,
        results
      };
    }

    const response = await api.get('/search', {
      params: { q: query }
    });
    return unwrapData<{ total: number; results: DashboardSearchResult[] }>(response.data);
  },

  runNightAudit: async () => {
    if (isDemoMode()) {
      return { id: 'demo-audit', status: 'completed', createdAt: new Date().toISOString() };
    }
    const response = await api.post('/dashboard/night-audit');
    return response.data;
  },

  getRevenueReport: async (startDate: string, endDate: string) => {
    if (isDemoMode()) {
      return {
        totalRevenue: 28500000,
        roomRevenue: 23000000,
        posRevenue: 5500000,
        transactions: demoOrders.map((order) => ({
          id: order.id,
          amount: order.total,
          createdAt: order.createdAt
        }))
      };
    }
    const response = await api.get('/reports/revenue', {
      params: { startDate, endDate }
    });
    return response.data;
  },

  getOccupancyReport: async (startDate: string, endDate: string) => {
    if (isDemoMode()) {
      return {
        totalRooms: 50,
        occupiedRooms: 38,
        occupancyRate: '76.00',
        bookings: []
      };
    }
    const response = await api.get('/reports/occupancy', {
      params: { startDate, endDate }
    });
    return response.data;
  }
};

export const bookingService = {
  getAll: async (): Promise<BookingSummary[]> => {
    if (isDemoMode()) {
      return [
        {
          id: 'booking-1',
          bookingNumber: 'BK001',
          guest: { firstName: 'John', lastName: 'Doe' },
          room: { roomNumber: '101' },
          status: 'CONFIRMED',
          checkIn: new Date().toISOString(),
          checkOut: new Date(Date.now() + 86400000).toISOString(),
          totalAmount: 150000
        }
      ];
    }
    const response = await api.get('/bookings');
    return response.data;
  }
};

export const roomService = {
  getAll: async () => {
    if (isDemoMode()) {
      return [
        { id: '1', roomNumber: '101', roomType: 'Standard', floor: 1, rate: 25000, status: 'AVAILABLE' },
        { id: '2', roomNumber: '201', roomType: 'Deluxe', floor: 2, rate: 45000, status: 'OCCUPIED' },
        { id: '3', roomNumber: '301', roomType: 'Suite', floor: 3, rate: 75000, status: 'AVAILABLE' }
      ];
    }
    const response = await api.get('/rooms');
    return response.data;
  }
};

export const posService = {
  getOutlets: async (): Promise<Outlet[]> => {
    if (isDemoMode()) {
      return demoOutlets;
    }
    const response = await api.get('/pos/outlets');
    return asArray<Outlet>(unwrapData<unknown>(response.data));
  },

  createOutlet: async (payload: { name: string; type: string }): Promise<Outlet> => {
    if (isDemoMode()) {
      const outlet: Outlet = {
        id: `outlet-${Date.now()}`,
        name: payload.name,
        type: payload.type,
        isActive: true
      };
      demoOutlets = [outlet, ...demoOutlets];
      return outlet;
    }
    const response = await api.post('/pos/outlets', payload);
    return response.data;
  },

  getMenuCategories: async (): Promise<string[]> => {
    if (isDemoMode()) {
      return ['Appetizers', 'Mains', 'Desserts', 'Drinks'];
    }

    const response = await api.get('/menu/categories');
    const raw = response.data;
    if (Array.isArray(raw)) {
      return raw.map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }
        const row = entry as { name?: string; category?: string };
        return row.name || row.category || '';
      }).filter(Boolean);
    }

    const payload = raw as { categories?: string[] };
    return Array.isArray(payload.categories) ? payload.categories : [];
  },

  createMenuCategory: async (name: string): Promise<string> => {
    if (isDemoMode()) {
      return name;
    }

    const response = await api.post('/menu/categories', { name });
    const payload = response.data as { name?: string; category?: string };
    return payload.name || payload.category || name;
  },

  getMenuItems: async (params?: { outletId?: string; activeOnly?: boolean }): Promise<PosMenuItem[]> => {
    if (isDemoMode()) {
      const items: PosMenuItem[] = [
        { id: 'menu-1', outletId: 'outlet-1', sku: 'JOL-001', name: 'Jollof Rice', description: 'Party-style jollof', price: 3500, category: 'Mains', isActive: true, isAvailable: true, canBeDiscounted: true },
        { id: 'menu-2', outletId: 'outlet-1', sku: 'EGU-001', name: 'Egusi Soup & Eba', description: 'With assorted meat', price: 4500, category: 'Mains', isActive: true, isAvailable: true, canBeDiscounted: true },
        { id: 'menu-3', outletId: 'outlet-1', sku: 'GRL-001', name: 'Grilled Chicken', description: 'Half bird, spiced', price: 5500, category: 'Mains', isActive: true, isAvailable: true, canBeDiscounted: true },
        { id: 'menu-4', outletId: 'outlet-1', sku: 'SPR-001', name: 'Spring Rolls (4pcs)', description: 'Vegetable filling', price: 2000, category: 'Appetizers', isActive: true, isAvailable: true, canBeDiscounted: true },
        { id: 'menu-5', outletId: 'outlet-1', sku: 'WTR-001', name: 'Water (50cl)', price: 300, category: 'Drinks', isActive: true, isAvailable: true, canBeDiscounted: false },
        { id: 'menu-6', outletId: 'outlet-1', sku: 'MLT-001', name: 'Malt Drink', price: 600, category: 'Drinks', isActive: true, isAvailable: true, canBeDiscounted: false },
        { id: 'menu-7', outletId: 'outlet-1', sku: 'BGR-001', name: 'Beef Burger', description: 'With fries', price: 4800, category: 'Mains', isActive: true, isAvailable: true, canBeDiscounted: true },
        { id: 'menu-8', outletId: 'outlet-1', sku: 'ICE-001', name: 'Ice Cream', description: '2 scoops', price: 1500, category: 'Desserts', isActive: true, isAvailable: true, canBeDiscounted: false },
      ];
      if (params?.outletId) return items.filter(i => i.outletId === params.outletId || params.outletId === 'outlet-1');
      return items;
    }

    const path = params?.activeOnly ? '/menu/active' : '/menu';
    const response = await api.get(path, { params: params?.outletId ? { outletId: params.outletId } : undefined });
    return asArray<PosMenuItem>(unwrapData<unknown>(response.data));
  },

  createMenuItem: async (payload: {
    outletId?: string;
    sku: string;
    name: string;
    description?: string;
    price: number;
    taxRate?: number;
    cost?: number;
    category?: string;
    kitchenStation?: string;
    modifiers?: unknown[];
    imageUrl?: string;
    isActive?: boolean;
    isAvailable?: boolean;
    canBeDiscounted?: boolean;
  }): Promise<PosMenuItem> => {
    if (isDemoMode()) {
      return {
        id: `menu-${Date.now()}`,
        outletId: payload.outletId || 'demo-outlet',
        sku: payload.sku,
        name: payload.name,
        description: payload.description,
        price: payload.price,
        taxRate: payload.taxRate,
        cost: payload.cost,
        category: payload.category,
        kitchenStation: payload.kitchenStation,
        modifiers: payload.modifiers,
        imageUrl: payload.imageUrl,
        isActive: payload.isActive !== false,
        isAvailable: payload.isAvailable !== false,
        canBeDiscounted: payload.canBeDiscounted !== false
      };
    }

    const response = await api.post('/menu', payload);
    return unwrapData<PosMenuItem>(response.data);
  },

  updateMenuItem: async (
    menuItemId: string,
    updates: Partial<Omit<PosMenuItem, 'id' | 'hotelId' | 'createdAt' | 'updatedAt'>>
  ): Promise<PosMenuItem> => {
    if (isDemoMode()) {
      return {
        id: menuItemId,
        outletId: 'demo-outlet',
        sku: String(updates.sku || ''),
        name: String(updates.name || 'Demo item'),
        price: Number(updates.price || 0),
        isActive: updates.isActive !== false,
        isAvailable: updates.isAvailable !== false
      };
    }

    const response = await api.put(`/menu/${menuItemId}`, updates);
    return unwrapData<PosMenuItem>(response.data);
  },

  deleteMenuItem: async (menuItemId: string): Promise<{ deleted: boolean; id: string }> => {
    if (isDemoMode()) {
      return { deleted: true, id: menuItemId };
    }

    const response = await api.delete(`/menu/${menuItemId}`);
    return unwrapData<{ deleted: boolean; id: string }>(response.data);
  },

  toggleMenuItemAvailability: async (menuItemId: string, isAvailable?: boolean): Promise<PosMenuItem> => {
    if (isDemoMode()) {
      return {
        id: menuItemId,
        outletId: 'demo-outlet',
        sku: '',
        name: 'Demo item',
        price: 0,
        isActive: true,
        isAvailable: Boolean(isAvailable)
      };
    }

    const response = await api.patch(`/menu/${menuItemId}/toggle-availability`, {
      ...(isAvailable !== undefined ? { isAvailable } : {})
    });
    return unwrapData<PosMenuItem>(response.data);
  },

  getOrders: async (params?: { outletId?: string; orderStatus?: string }): Promise<PosOrder[]> => {
    if (isDemoMode()) {
      return demoOrders.filter((order) => {
        if (params?.outletId && order.outletId !== params.outletId) {
          return false;
        }
        if (params?.orderStatus && order.orderStatus !== params.orderStatus) {
          return false;
        }
        return true;
      });
    }
    const response = await api.get('/pos/orders', { params });
    return asArray<PosOrder>(unwrapData<unknown>(response.data));
  },

  createOrder: async (
    payload: Partial<PosOrder> & {
      outletId: string;
      items: Array<Record<string, unknown>>;
      clientId?: string;
      clientTimestamp?: string;
      bookingId?: string;
      metadata?: Record<string, unknown>;
    }
  ) => {
    if (isDemoMode()) {
      const outlet = demoOutlets.find((entry) => entry.id === payload.outletId);
      const created: PosOrder = {
        id: `ord-${Date.now()}`,
        orderNumber: `POS-${Date.now()}`,
        outletId: payload.outletId,
        outlet,
        orderType: payload.orderType || 'DINE_IN',
        orderStatus: 'OPEN',
        tableNumber: payload.tableNumber || null,
        subtotal: Number(payload.subtotal || 0),
        tax: Number(payload.tax || 0),
        total: Number(payload.total || 0),
        paymentStatus: 'PENDING',
        createdAt: new Date().toISOString()
      };
      demoOrders = [created, ...demoOrders];
      return created;
    }
    const response = await api.post('/pos/orders', payload);
    return response.data?.order || response.data;
  },

  sendToKds: async (orderId: string) => {
    if (isDemoMode()) {
      demoOrders = demoOrders.map((order) =>
        order.id === orderId ? { ...order, orderStatus: 'SENT_TO_KITCHEN' } : order
      );
      return demoOrders.find((order) => order.id === orderId);
    }
    const response = await api.post(`/pos/orders/${orderId}/send-to-kds`);
    return response.data;
  },

  completeOrder: async (orderId: string) => {
    if (isDemoMode()) {
      demoOrders = demoOrders.map((order) =>
        order.id === orderId ? { ...order, orderStatus: 'COMPLETED', paymentStatus: 'COMPLETED' } : order
      );
      return demoOrders.find((order) => order.id === orderId);
    }
    const response = await api.post(`/pos/orders/${orderId}/complete`, { paymentStatus: 'COMPLETED' });
    return response.data;
  },

  voidOrder: async (orderId: string, reason: string) => {
    if (isDemoMode()) {
      demoOrders = demoOrders.map((order) =>
        order.id === orderId ? { ...order, orderStatus: 'VOIDED', paymentStatus: 'FAILED' } : order
      );
      return demoOrders.find((order) => order.id === orderId);
    }
    const response = await api.post(`/pos/orders/${orderId}/void`, { reason });
    return response.data;
  },

  getKdsOrders: async (params?: { outletId?: string; includeCompleted?: boolean }) => {
    if (isDemoMode()) {
      return demoOrders.filter((order) => {
        if (params?.outletId && order.outletId !== params.outletId) {
          return false;
        }
        if (params?.includeCompleted) {
          return order.orderStatus === 'SENT_TO_KITCHEN' || order.orderStatus === 'COMPLETED';
        }
        return order.orderStatus === 'SENT_TO_KITCHEN';
      });
    }
    const response = await api.get('/pos/kds/orders', { params });
    return asArray<PosOrder>(unwrapData<unknown>(response.data));
  },

  acknowledgeKdsOrder: async (orderId: string) => {
    if (isDemoMode()) {
      demoOrders = demoOrders.map((order) =>
        order.id === orderId ? { ...order, orderStatus: 'SENT_TO_KITCHEN' } : order
      );
      return demoOrders.find((order) => order.id === orderId);
    }
    const response = await api.post(`/pos/kds/orders/${orderId}/acknowledge`);
    return unwrapData<PosOrder>(response.data);
  },

  bulkSyncOrders: async (orders: Array<Record<string, unknown>>) => {
    if (isDemoMode()) {
      return {
        total: orders.length,
        summary: { created: orders.length, duplicate: 0, failed: 0 }
      };
    }

    if (orders.length === 0) {
      return {
        total: 0,
        summary: { created: 0, duplicate: 0, failed: 0 },
        processed: []
      };
    }

    const response = await api.post('/pos/sync/orders/bulk', { orders });
    return response.data;
  },

  getPendingSync: async () => {
    if (isDemoMode()) {
      return { pendingCount: 0, items: [] };
    }
    const response = await api.get('/pos/sync/pending');
    return unwrapData<{ pendingCount: number; items: Array<Record<string, unknown>> }>(response.data);
  },

  acknowledgeSync: async (clientIds: string[]) => {
    if (isDemoMode()) {
      return { acknowledged: clientIds.length, clientIds };
    }
    const response = await api.post('/pos/sync/acknowledge', { clientIds });
    return unwrapData<{ acknowledged: number; clientIds: string[] }>(response.data);
  }
};

export const accountingService = {
  getChartOfAccounts: async (): Promise<ChartOfAccount[]> => {
    if (isDemoMode()) {
      return demoChartOfAccounts;
    }
    const response = await api.get('/accounting/chart-of-accounts');
    return asArray<ChartOfAccount>(unwrapData<unknown>(response.data));
  },

  createChartOfAccount: async (payload: {
    accountCode: string;
    accountName: string;
    accountType: string;
    openingBalance?: number;
  }): Promise<ChartOfAccount> => {
    if (isDemoMode()) {
      const created: ChartOfAccount = {
        id: `coa-${Date.now()}`,
        accountCode: payload.accountCode,
        accountName: payload.accountName,
        accountType: payload.accountType,
        openingBalance: Number(payload.openingBalance || 0),
        currentBalance: Number(payload.openingBalance || 0),
        isActive: true,
        createdAt: new Date().toISOString()
      };
      demoChartOfAccounts = [created, ...demoChartOfAccounts];
      return created;
    }
    const response = await api.post('/accounting/chart-of-accounts', payload);
    return unwrapData<ChartOfAccount>(response.data);
  },

  deactivateChartOfAccount: async (accountCode: string): Promise<ChartOfAccount> => {
    if (isDemoMode()) {
      const target = demoChartOfAccounts.find((account) => account.accountCode === accountCode);
      if (!target) {
        throw new Error('Account not found');
      }
      target.isActive = false;
      return target;
    }
    const response = await api.delete(`/accounting/chart-of-accounts/${accountCode}`);
    return unwrapData<ChartOfAccount>(response.data);
  },

  getJournals: async (): Promise<Journal[]> => {
    if (isDemoMode()) {
      return demoJournals;
    }
    const response = await api.get('/accounting/journals');
    return asArray<Journal>(unwrapData<unknown>(response.data));
  },

  createJournal: async (payload: {
    journalDate: string;
    reference?: string;
    description?: string;
    lines: JournalLine[];
  }): Promise<Journal> => {
    if (isDemoMode()) {
      const totalDebit = payload.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
      const totalCredit = payload.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
      const created: Journal = {
        id: `jr-${Date.now()}`,
        journalNumber: `JR-${Date.now()}`,
        journalDate: payload.journalDate,
        reference: payload.reference,
        description: payload.description,
        status: 'DRAFT',
        totalDebit,
        totalCredit,
        lines: payload.lines
      };
      demoJournals = [created, ...demoJournals];
      return created;
    }
    const response = await api.post('/accounting/journals', payload);
    return unwrapData<Journal>(response.data);
  },

  postJournal: async (journalId: string): Promise<Journal> => {
    if (isDemoMode()) {
      const journal = demoJournals.find((entry) => entry.id === journalId);
      if (!journal) {
        throw new Error('Journal not found');
      }
      journal.status = 'POSTED';
      return journal;
    }
    const response = await api.post(`/accounting/journals/${journalId}/post`);
    return unwrapData<Journal>(response.data);
  },

  getBankAccounts: async (): Promise<BankAccount[]> => {
    if (isDemoMode()) {
      return demoBankAccounts;
    }
    const response = await api.get('/accounting/bank-accounts');
    return asArray<BankAccount>(unwrapData<unknown>(response.data));
  },

  createBankAccount: async (payload: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    currency?: string;
    openingBalance?: number;
  }): Promise<BankAccount> => {
    if (isDemoMode()) {
      const created: BankAccount = {
        id: `bank-${Date.now()}`,
        accountName: payload.accountName,
        accountNumber: payload.accountNumber,
        bankName: payload.bankName,
        currency: payload.currency || 'NGN',
        openingBalance: Number(payload.openingBalance || 0),
        currentBalance: Number(payload.openingBalance || 0),
        isActive: true
      };
      demoBankAccounts = [created, ...demoBankAccounts];
      return created;
    }
    const response = await api.post('/accounting/bank-accounts', payload);
    return unwrapData<BankAccount>(response.data);
  },

  getBankTransactions: async (bankAccountId: string): Promise<{ account: BankAccount; transactions: BankTransaction[] }> => {
    if (isDemoMode()) {
      const account = demoBankAccounts.find((entry) => entry.id === bankAccountId);
      if (!account) {
        throw new Error('Bank account not found');
      }
      return {
        account,
        transactions: demoBankTransactions
      };
    }
    const response = await api.get(`/accounting/bank-accounts/${bankAccountId}/transactions`);
    return unwrapData<{ account: BankAccount; transactions: BankTransaction[] }>(response.data);
  },

  importBankStatement: async (payload: {
    bankAccountId: string;
    rows: Array<{
      transactionDate: string;
      description: string;
      reference?: string;
      amount: number;
      transactionType: string;
    }>;
  }) => {
    if (isDemoMode()) {
      const importedTransactionIds = payload.rows.map((row, index) => {
        const id = `txn-${Date.now()}-${index}`;
        demoBankTransactions = [
          {
            id,
            transactionDate: row.transactionDate,
            description: row.description,
            reference: row.reference,
            amount: row.amount,
            transactionType: row.transactionType,
            status: 'UNRECONCILED'
          },
          ...demoBankTransactions
        ];
        return id;
      });
      return { importedTransactionIds };
    }
    const response = await api.post('/accounting/bank/import-statement', payload);
    return unwrapData<{ importedTransactionIds: string[] }>(response.data);
  },

  reconcileBank: async (payload: {
    bankAccountId: string;
    statementDate: string;
    statementBalance: number;
    transactionIds: string[];
  }) => {
    if (isDemoMode()) {
      demoBankTransactions = demoBankTransactions.map((txn) =>
        payload.transactionIds.includes(txn.id) ? { ...txn, status: 'RECONCILED' } : txn
      );
      return { reconciledTransactions: payload.transactionIds.length, statementBalance: payload.statementBalance };
    }
    const response = await api.post('/accounting/bank/reconcile', payload);
    return unwrapData<Record<string, unknown>>(response.data);
  },

  getBudgets: async (): Promise<Budget[]> => {
    if (isDemoMode()) {
      return demoBudgets;
    }
    const response = await api.get('/accounting/budgets');
    return asArray<Budget>(unwrapData<unknown>(response.data));
  },

  createBudget: async (payload: Record<string, unknown>): Promise<Budget> => {
    if (isDemoMode()) {
      const total = Array.from({ length: 12 }).reduce<number>((sum, _, index) => {
        const key = `period${index + 1}`;
        return sum + Number(payload[key] || 0);
      }, 0);
      const created: Budget = {
        id: `budget-${Date.now()}`,
        budgetName: String(payload.budgetName || 'Budget'),
        fiscalYear: Number(payload.fiscalYear || new Date().getFullYear()),
        accountCode: String(payload.accountCode || ''),
        version: String(payload.version || 'Original'),
        total,
        createdAt: new Date().toISOString()
      };
      demoBudgets = [created, ...demoBudgets];
      return created;
    }
    const response = await api.post('/accounting/budgets', payload);
    return unwrapData<Budget>(response.data);
  },

  getBudgetVariance: async (budgetId: string) => {
    if (isDemoMode()) {
      const budget = demoBudgets.find((entry) => entry.id === budgetId);
      if (!budget) {
        throw new Error('Budget not found');
      }
      return {
        budget,
        actualTotal: budget.total * 0.85,
        variance: budget.total * -0.15,
        variancePercent: -15
      };
    }
    const response = await api.get(`/accounting/budgets/${budgetId}/variance`);
    return unwrapData<Record<string, unknown>>(response.data);
  },

  getFixedAssets: async (): Promise<FixedAsset[]> => {
    if (isDemoMode()) {
      return demoFixedAssets;
    }
    const response = await api.get('/accounting/fixed-assets');
    return asArray<FixedAsset>(unwrapData<unknown>(response.data));
  },

  createFixedAsset: async (payload: Record<string, unknown>): Promise<FixedAsset> => {
    if (isDemoMode()) {
      const purchaseCost = Number(payload.purchaseCost || 0);
      const created: FixedAsset = {
        id: `asset-${Date.now()}`,
        assetCode: String(payload.assetCode || ''),
        assetName: String(payload.assetName || ''),
        category: String(payload.category || 'Equipment'),
        purchaseCost,
        currentValue: purchaseCost,
        accumulatedDepr: 0,
        status: 'ACTIVE',
        purchaseDate: String(payload.purchaseDate || new Date().toISOString())
      };
      demoFixedAssets = [created, ...demoFixedAssets];
      return created;
    }
    const response = await api.post('/accounting/fixed-assets', payload);
    return unwrapData<FixedAsset>(response.data);
  },

  depreciateFixedAsset: async (assetId: string, amount?: number) => {
    if (isDemoMode()) {
      const target = demoFixedAssets.find((entry) => entry.id === assetId);
      if (!target) {
        throw new Error('Asset not found');
      }
      const depreciation = Number(amount || target.purchaseCost * 0.01);
      target.accumulatedDepr += depreciation;
      target.currentValue = Math.max(0, target.currentValue - depreciation);
      return target;
    }
    const response = await api.post(`/accounting/fixed-assets/${assetId}/depreciate`, {
      ...(amount ? { amount } : {})
    });
    return unwrapData<FixedAsset>(response.data);
  },

  disposeFixedAsset: async (assetId: string, payload: { disposalAmount?: number; disposalDate?: string }) => {
    if (isDemoMode()) {
      const target = demoFixedAssets.find((entry) => entry.id === assetId);
      if (!target) {
        throw new Error('Asset not found');
      }
      target.status = 'DISPOSED';
      target.currentValue = Number(payload.disposalAmount || 0);
      return target;
    }
    const response = await api.post(`/accounting/fixed-assets/${assetId}/dispose`, payload);
    return unwrapData<FixedAsset>(response.data);
  },

  getTrialBalanceReport: async (params?: { startDate?: string; endDate?: string }): Promise<TrialBalanceReport> => {
    if (isDemoMode()) {
      const rows = demoChartOfAccounts.map((account) => ({
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        periodDebit: account.accountType === 'ASSET' || account.accountType === 'EXPENSE' ? account.currentBalance : 0,
        periodCredit:
          account.accountType === 'LIABILITY' || account.accountType === 'EQUITY' || account.accountType === 'INCOME'
            ? account.currentBalance
            : 0,
        closingBalance: account.currentBalance
      }));
      return {
        period: { startDate: params?.startDate || null, endDate: params?.endDate || null },
        rows,
        totals: {
          totalDebit: rows.reduce((sum, row) => sum + row.periodDebit, 0),
          totalCredit: rows.reduce((sum, row) => sum + row.periodCredit, 0)
        }
      };
    }
    const response = await api.get('/accounting/reports/trial-balance', { params });
    return unwrapData<TrialBalanceReport>(response.data);
  },

  getProfitLossReport: async (params?: { startDate?: string; endDate?: string }): Promise<ProfitLossReport> => {
    if (isDemoMode()) {
      return {
        period: { startDate: params?.startDate || null, endDate: params?.endDate || null },
        income: [{ code: '4100', name: 'Room Revenue', amount: 8500000 }],
        expenses: [{ code: '5200', name: 'Utilities', amount: 1200000 }],
        totalIncome: 8500000,
        totalExpenses: 1200000,
        netProfit: 7300000
      };
    }
    const response = await api.get('/accounting/reports/profit-loss', { params });
    return unwrapData<ProfitLossReport>(response.data);
  },

  getBalanceSheetReport: async (): Promise<BalanceSheetReport> => {
    if (isDemoMode()) {
      const assets = demoChartOfAccounts
        .filter((account) => account.accountType === 'ASSET')
        .map((account) => ({ code: account.accountCode, name: account.accountName, balance: account.currentBalance }));
      const liabilities = demoChartOfAccounts
        .filter((account) => account.accountType === 'LIABILITY')
        .map((account) => ({ code: account.accountCode, name: account.accountName, balance: account.currentBalance }));
      const equity = demoChartOfAccounts
        .filter((account) => account.accountType === 'EQUITY')
        .map((account) => ({ code: account.accountCode, name: account.accountName, balance: account.currentBalance }));
      const totalAssets = assets.reduce((sum, row) => sum + row.balance, 0);
      const totalLiabilities = liabilities.reduce((sum, row) => sum + row.balance, 0);
      const totalEquity = equity.reduce((sum, row) => sum + row.balance, 0);
      return {
        asOfDate: new Date().toISOString(),
        assets,
        liabilities,
        equity,
        totals: {
          totalAssets,
          totalLiabilities,
          totalEquity,
          liabilitiesAndEquity: totalLiabilities + totalEquity
        }
      };
    }
    const response = await api.get('/accounting/reports/balance-sheet');
    return unwrapData<BalanceSheetReport>(response.data);
  },

  getAgingArReport: async (): Promise<AgingReport> => {
    if (isDemoMode()) {
      return {
        rows: [],
        summary: {
          '0-30': 250000,
          '31-60': 100000,
          '61-90': 50000,
          '90+': 25000,
          total: 425000
        }
      };
    }
    const response = await api.get('/accounting/reports/aging/ar');
    return unwrapData<AgingReport>(response.data);
  },

  getAgingApReport: async (): Promise<AgingReport> => {
    if (isDemoMode()) {
      return {
        rows: [],
        summary: {
          '0-30': 180000,
          '31-60': 75000,
          '61-90': 0,
          '90+': 0,
          total: 255000
        }
      };
    }
    const response = await api.get('/accounting/reports/aging/ap');
    return unwrapData<AgingReport>(response.data);
  },

  getVatSummaryReport: async (params?: { startDate?: string; endDate?: string }): Promise<VatSummaryReport> => {
    if (isDemoMode()) {
      return {
        period: { startDate: params?.startDate || null, endDate: params?.endDate || null },
        vatRate: 7.5,
        taxableAmount: 2500000,
        vatAmount: 187500
      };
    }
    const response = await api.get('/accounting/reports/vat-summary', { params });
    return unwrapData<VatSummaryReport>(response.data);
  },

  getGeneralLedgerReport: async (
    accountCode: string,
    params?: { startDate?: string; endDate?: string }
  ): Promise<GeneralLedgerReport> => {
    if (isDemoMode()) {
      return {
        account: {
          accountCode,
          accountName: demoChartOfAccounts.find((account) => account.accountCode === accountCode)?.accountName || 'Demo Account',
          accountType: demoChartOfAccounts.find((account) => account.accountCode === accountCode)?.accountType || 'ASSET'
        },
        period: { startDate: params?.startDate || null, endDate: params?.endDate || null },
        entries: demoJournals.flatMap((journal) =>
          journal.lines
            .filter((line) => line.accountCode === accountCode)
            .map((line) => ({
              date: journal.journalDate,
              journalNumber: journal.journalNumber,
              reference: journal.reference || null,
              description: line.description || journal.description || null,
              debit: Number(line.debit || 0),
              credit: Number(line.credit || 0),
              runningBalance: Number(line.debit || 0) - Number(line.credit || 0)
            }))
        ),
        totals: {
          debit: demoJournals.reduce(
            (sum, journal) => sum + journal.lines.filter((line) => line.accountCode === accountCode).reduce((s, line) => s + Number(line.debit || 0), 0),
            0
          ),
          credit: demoJournals.reduce(
            (sum, journal) => sum + journal.lines.filter((line) => line.accountCode === accountCode).reduce((s, line) => s + Number(line.credit || 0), 0),
            0
          )
        }
      };
    }
    const response = await api.get(`/accounting/reports/general-ledger/${accountCode}`, { params });
    return unwrapData<GeneralLedgerReport>(response.data);
  },

  getNightAuditStatus: async (): Promise<NightAuditStatus> => {
    if (isDemoMode()) {
      return {
        ...demoNightAuditState,
        latestAudit: demoNightAudits[0] || null
      };
    }
    const response = await api.get('/accounting/audit/status');
    return unwrapData<NightAuditStatus>(response.data);
  },

  validateNightAudit: async (payload?: { auditDate?: string }): Promise<NightAuditValidationResult> => {
    if (isDemoMode()) {
      const auditDate = startOfDayIso(payload?.auditDate || demoNightAuditState.businessDate);
      const errors: string[] = [];

      if (isFutureDay(auditDate, demoNightAuditState.businessDate)) {
        errors.push('Cannot audit future business date');
      }

      const alreadyAudited = demoNightAudits.some(
        (audit) => startOfDayIso(audit.auditDate) === startOfDayIso(auditDate)
      );
      if (alreadyAudited) {
        errors.push('Night audit already completed for this date');
      }

      return {
        auditDate,
        valid: errors.length === 0,
        errors,
        snapshot: {
          totalRevenue: 5040000,
          posTotal: 3320000,
          checkoutCount: 28,
          openOrders: 0,
          outstandingBookings: 3,
          roomRevenue: 1720000,
          posRevenue: 3320000,
          receptionTotals: {
            cash: 1245000,
            card: 2560000,
            transfer: 345000,
            company: 890000,
            other: 0
          }
        }
      };
    }
    const response = await api.post('/accounting/audit/validate', payload || {});
    const data = unwrapData<Record<string, unknown>>(response.data);
    return {
      auditDate: String(data.auditDate || payload?.auditDate || new Date().toISOString()),
      valid: Boolean(data.valid),
      errors: Array.isArray(data.errors) ? data.errors.map((item) => String(item)) : [],
      snapshot: (data.snapshot as NightAuditSnapshot | undefined) || undefined
    };
  },

  runNightAudit: async (payload?: {
    auditDate?: string;
    verification?: { outstandingAR?: number; notes?: string };
  }): Promise<NightAuditRunResult> => {
    if (isDemoMode()) {
      const auditDate = startOfDayIso(payload?.auditDate || demoNightAuditState.businessDate);
      const validation = await accountingService.validateNightAudit({ auditDate });
      if (!validation.valid) {
        throw new Error(validation.errors.join(', ') || 'Night audit validation failed');
      }

      const closedAt = new Date().toISOString();
      const newBusinessDate = addDaysIso(auditDate, 1);
      const record: NightAuditHistoryRecord = {
        id: `night-audit-demo-${Date.now()}`,
        auditDate,
        closedAt,
        closedBy: 'accounting@demo.com',
        totalRevenue: validation.snapshot?.totalRevenue || 0,
        totalBookings: validation.snapshot?.checkoutCount || 0,
        totalPosSales: validation.snapshot?.posTotal || 0,
        receptionTotal: validation.snapshot
          ? validation.snapshot.receptionTotals.cash +
            validation.snapshot.receptionTotals.card +
            validation.snapshot.receptionTotals.transfer +
            validation.snapshot.receptionTotals.company +
            validation.snapshot.receptionTotals.other
          : 0,
        posTotal: validation.snapshot?.posTotal || 0,
        difference: validation.snapshot
          ? validation.snapshot.totalRevenue - validation.snapshot.posTotal
          : 0,
        outstandingAR: Number(payload?.verification?.outstandingAR || 0),
        revenueJournalId: `NIGHT-${auditDate.slice(0, 10).replace(/-/g, '')}-001`,
        status: 'COMPLETED',
        workflowStatus: 'COMPLETED',
        notes: payload?.verification?.notes || null
      };

      demoNightAudits = [record, ...demoNightAudits];
      demoNightAuditState = {
        businessDate: newBusinessDate,
        lastAuditDate: auditDate,
        lockedUntil: auditDate,
        isOpen: true,
        latestAudit: record
      };

      return {
        success: true,
        auditId: record.id,
        journalId: record.revenueJournalId || undefined,
        dateClosed: auditDate,
        newBusinessDate
      };
    }
    const response = await api.post('/accounting/audit/run', payload || {});
    const data = unwrapData<Record<string, unknown>>(response.data);
    return {
      success: Boolean(data.success),
      auditId: String(data.auditId || ''),
      journalId: data.journalId ? String(data.journalId) : undefined,
      dateClosed: String(data.dateClosed || payload?.auditDate || new Date().toISOString()),
      newBusinessDate: String(data.newBusinessDate || '')
    };
  },

  getNightAuditHistory: async (limit = 30): Promise<NightAuditHistoryRecord[]> => {
    if (isDemoMode()) {
      return demoNightAudits.slice(0, limit);
    }
    const response = await api.get('/accounting/audit/history', {
      params: { limit }
    });
    return asArray<NightAuditHistoryRecord>(unwrapData<unknown>(response.data));
  }
};
