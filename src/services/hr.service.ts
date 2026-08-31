import { api } from './api';

/** HR & Payroll (Part 4). */

export type StaffStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED' | 'ON_LEAVE';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'CASUAL';
export type SalaryType = 'MONTHLY' | 'WEEKLY' | 'HOURLY';
export type LeaveType = 'ANNUAL' | 'SICK' | 'PERSONAL' | 'MATERNITY' | 'OTHER';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type PayrollStatus = 'DRAFT' | 'PROCESSED' | 'PAID';

export interface StaffMember {
  id: string;
  staffNumber: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  hireDate: string | null;
  employmentType: EmploymentType;
  status: StaffStatus;
  bankName: string | null;
  accountNumber: string | null;
  taxId: string | null;
  salaryType: SalaryType;
  baseSalary: number;
  hourlyRate: number | null;
  overtimeRate: number | null;
  allowance: number;
  userId: string | null;
  accessLevel: StaffAccessLevel;
}

/**
 * How much of the platform a staff member can sign in to.
 * NONE          - no login at all
 * SELF_SERVICE  - HR portal only (own payslips, leave, attendance)
 * OPERATIONAL   - full role-based access to the operational modules
 */
export type StaffAccessLevel = 'NONE' | 'SELF_SERVICE' | 'OPERATIONAL';

/** Departments whose staff do not operate the platform. Mirrors the server. */
export const NON_OPERATIONAL_DEPARTMENTS = [
  'SECURITY', 'LAUNDRY', 'GROUNDS', 'MAINTENANCE', 'TRANSPORT'
];

export const defaultAccessLevelFor = (department?: string | null): StaffAccessLevel => {
  if (!department) return 'NONE';
  return NON_OPERATIONAL_DEPARTMENTS.includes(department) ? 'SELF_SERVICE' : 'OPERATIONAL';
};

export interface StaffAccount {
  userId: string;
  email: string;
  role: string;
  accessLevel: StaffAccessLevel;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  totalHours: number;
  overtimeHours: number;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'HOLIDAY';
  staff?: { id: string; firstName: string; lastName: string; staffNumber: string | null };
}

export interface LeaveRequestRecord {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: LeaveStatus;
  staff?: { id: string; firstName: string; lastName: string; staffNumber: string | null };
}

export interface PayrollRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: PayrollStatus;
  basePay: number;
  allowances: number;
  bonuses: number;
  overtimePay: number;
  deductions: number;
  tax: number;
  netPay: number;
  staff?: { id: string; firstName: string; lastName: string; staffNumber: string | null };
}

export interface Payslip {
  payslipNumber: string;
  business: { name: string; address: string | null; logoUrl: string | null };
  currency: string;
  employee: {
    name: string;
    staffNumber: string | null;
    jobTitle: string | null;
    department: string | null;
    bankName: string | null;
    accountNumber: string | null;
    taxId: string | null;
  };
  period: { start: string; end: string };
  status: PayrollStatus;
  earnings: Array<{ label: string; amount: number }>;
  deductions: Array<{ label: string; amount: number }>;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
}

export interface HrDashboardData {
  staff: { total: number; active: number; onLeave: number; inactive: number; terminated: number };
  attendance: { presentToday: number };
  leave: { pending: number };
  payroll: { draftCount: number; draftNetTotal: number };
}

const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export const hrService = {
  async getDashboard(): Promise<HrDashboardData> {
    const { data } = await api.get('/hr/dashboard');
    return data as HrDashboardData;
  },

  async listStaff(params?: { search?: string; status?: StaffStatus }): Promise<StaffMember[]> {
    const { data } = await api.get('/hr/staff', { params });
    return list<StaffMember>(data);
  },

  /** Grants a login to a staff member who was onboarded without one. */
  async grantAccount(
    staffId: string,
    payload: { accessLevel?: StaffAccessLevel; role?: string; email?: string }
  ): Promise<StaffAccount> {
    const { data } = await api.post(`/hr/staff/${staffId}/account`, payload);
    return data;
  },

  /** Removes platform access. The person stays on the HR roster. */
  async revokeAccount(staffId: string): Promise<void> {
    await api.delete(`/hr/staff/${staffId}/account`);
  },

  async getStaff(id: string) {
    const { data } = await api.get(`/hr/staff/${id}`);
    return data as StaffMember & { hasClockPin: boolean };
  },

  async createStaff(payload: Partial<StaffMember> & { clockPin?: string }) {
    const { data } = await api.post('/hr/staff', payload);
    return data as StaffMember;
  },

  async updateStaff(id: string, payload: Partial<StaffMember> & { clockPin?: string }) {
    const { data } = await api.put(`/hr/staff/${id}`, payload);
    return data as StaffMember;
  },

  async terminateStaff(id: string) {
    const { data } = await api.delete(`/hr/staff/${id}`);
    return data;
  },

  async listAttendance(params?: { from?: string; to?: string; staffId?: string }) {
    const { data } = await api.get('/hr/attendance', { params });
    return list<AttendanceRecord>(data);
  },

  async clockIn(payload: { staffId?: string; pin?: string; method?: string; lat?: number; lng?: number }) {
    const { data } = await api.post('/hr/attendance/clock-in', payload);
    return data as AttendanceRecord;
  },

  async clockOut(payload: { staffId?: string; pin?: string; method?: string; lat?: number; lng?: number }) {
    const { data } = await api.post('/hr/attendance/clock-out', payload);
    return data as AttendanceRecord;
  },

  async listLeave(params?: { status?: LeaveStatus; staffId?: string }) {
    const { data } = await api.get('/hr/leave', { params });
    return list<LeaveRequestRecord>(data);
  },

  async requestLeave(payload: {
    staffId: string;
    type: LeaveType;
    startDate: string;
    endDate: string;
    reason?: string;
  }) {
    const { data } = await api.post('/hr/leave/request', payload);
    return data as LeaveRequestRecord;
  },

  async approveLeave(id: string) {
    const { data } = await api.put(`/hr/leave/${id}/approve`);
    return data as LeaveRequestRecord;
  },

  async rejectLeave(id: string, notes?: string) {
    const { data } = await api.put(`/hr/leave/${id}/reject`, { notes });
    return data as LeaveRequestRecord;
  },

  async getLeaveBalance(staffId: string, year?: number) {
    const { data } = await api.get(`/hr/leave/balance/${staffId}`, { params: year ? { year } : undefined });
    return data as { entitled: number; used: number; remaining: number; annual: number; sick: number };
  },

  async listPayrolls(params?: { status?: PayrollStatus; staffId?: string }) {
    const { data } = await api.get('/hr/payroll', { params });
    return {
      payrolls: list<PayrollRecord>(data?.payrolls),
      totals: (data?.totals as { gross: number; net: number; tax: number }) || { gross: 0, net: 0, tax: 0 }
    };
  },

  async generatePayroll(payload: { periodStart: string; periodEnd: string; staffIds?: string[] }) {
    const { data } = await api.post('/hr/payroll/generate', payload);
    return data as { created: number; skipped: Array<{ staffId: string; reason: string }> };
  },

  async processPayroll(id: string) {
    const { data } = await api.post(`/hr/payroll/${id}/process`);
    return data as PayrollRecord;
  },

  async markPaid(id: string) {
    const { data } = await api.post(`/hr/payroll/${id}/pay`);
    return data as PayrollRecord;
  },

  async getPayslip(id: string) {
    const { data } = await api.get(`/hr/payroll/${id}/payslip`);
    return data as Payslip;
  }
};

/** Naira formatting used across every HR screen. */
export const formatNaira = (value: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

export const STAFF_STATUS_COLOR: Record<StaffStatus, 'success' | 'default' | 'error' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  TERMINATED: 'error',
  ON_LEAVE: 'warning'
};

export const PAYROLL_STATUS_COLOR: Record<PayrollStatus, 'default' | 'info' | 'success'> = {
  DRAFT: 'default',
  PROCESSED: 'info',
  PAID: 'success'
};

export const LEAVE_STATUS_COLOR: Record<LeaveStatus, 'warning' | 'success' | 'error' | 'default'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'default'
};

// ---------------------------------------------------------------------------
// Employee self-service
// ---------------------------------------------------------------------------

export interface MyStaffProfile {
  id: string;
  firstName: string;
  lastName: string;
  staffNumber: string | null;
  jobTitle: string | null;
  department: string | null;
  hireDate: string | null;
  employmentType: EmploymentType;
  status: StaffStatus;
  salaryType: SalaryType;
  baseSalary: number;
  allowance: number;
  bankName: string | null;
  accountNumber: string | null;
}

export interface MyAttendance {
  records: AttendanceRecord[];
  totals: { days: number; hours: number; overtime: number; byStatus: Record<string, number> };
  today: { clockedIn: boolean; clockedOut: boolean; clockIn: string | null; clockOut: string | null };
}

export interface MyLeave {
  requests: LeaveRequestRecord[];
  balance: { entitled: number; used: number; remaining: number; annual: number; sick: number };
}

export const myHrService = {
  async getProfile(): Promise<MyStaffProfile> {
    const { data } = await api.get('/hr/me');
    return data as MyStaffProfile;
  },
  async getAttendance(): Promise<MyAttendance> {
    const { data } = await api.get('/hr/me/attendance');
    return data as MyAttendance;
  },
  async getLeave(): Promise<MyLeave> {
    const { data } = await api.get('/hr/me/leave');
    return data as MyLeave;
  },
  async requestLeave(payload: { type: LeaveType; startDate: string; endDate: string; reason?: string }) {
    const { data } = await api.post('/hr/me/leave', payload);
    return data as LeaveRequestRecord;
  },
  async cancelLeave(id: string) {
    const { data } = await api.put(`/hr/me/leave/${id}/cancel`);
    return data as LeaveRequestRecord;
  },
  async getPayslips(): Promise<PayrollRecord[]> {
    const { data } = await api.get('/hr/me/payslips');
    return Array.isArray(data) ? data : [];
  },
  async getSchedule() {
    const { data } = await api.get('/hr/me/schedule');
    return Array.isArray(data) ? data : [];
  }
};

// ---------------------------------------------------------------------------
// Hotel performance (Occupancy / ADR / RevPAR)
// ---------------------------------------------------------------------------

export interface PerformanceMetrics {
  roomNightsSold: number;
  roomNightsAvailable: number;
  roomRevenue: number;
  occupancyRate: number;
  adr: number;
  revpar: number;
  nightsInPeriod: number;
  roomsInInventory: number;
}

export interface PerformanceResponse {
  period: { from: string; to: string; nights: number };
  current: PerformanceMetrics;
  previous: PerformanceMetrics;
  change: {
    occupancyRate: number | null;
    adr: number | null;
    revpar: number | null;
    roomRevenue: number | null;
  };
}

export const performanceService = {
  async get(params?: { from?: string; to?: string }): Promise<PerformanceResponse> {
    const { data } = await api.get('/dashboard/performance', { params });
    return data as PerformanceResponse;
  }
};
