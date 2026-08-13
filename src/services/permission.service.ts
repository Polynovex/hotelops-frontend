import { api } from './api';

/** Role & permission management (Part 2 frontend). */

export type PermissionCategory = 'MODULE' | 'FINANCE' | 'OPERATION' | 'HR' | 'INVENTORY';
export type Department =
  | 'FRONT_DESK'
  | 'CONCIERGE'
  | 'HOUSEKEEPING'
  | 'LAUNDRY'
  | 'FOOD_BEVERAGE'
  | 'KITCHEN'
  | 'POS'
  | 'SECURITY'
  | 'MAINTENANCE'
  | 'GROUNDS'
  | 'SPA_WELLNESS'
  | 'TRANSPORT'
  | 'EVENTS'
  | 'FINANCE'
  | 'HR'
  | 'INVENTORY'
  | 'SALES_MARKETING'
  | 'IT'
  | 'MANAGEMENT';

export interface PermissionDef {
  code: string;
  name: string;
  description: string;
  category: PermissionCategory;
}

export interface RoleSummary {
  id: string;
  name: string;
  department: Department;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissionCount: number;
  userCount: number;
}

export interface RoleDetail {
  id: string;
  name: string;
  department: Department;
  isSystem: boolean;
  isActive: boolean;
  permissions: PermissionDef[];
  permissionCodes: string[];
}

export interface MyPermissions {
  permissions: string[];
  role: { id: string; name: string; department: Department } | null;
  department: Department | null;
  isSuperUser: boolean;
}

const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export const permissionService = {
  /** Effective permissions for the signed-in user. */
  async getMine(): Promise<MyPermissions> {
    const { data } = await api.get('/auth/permissions');
    return {
      permissions: list<string>(data?.permissions),
      role: data?.role ?? null,
      department: data?.department ?? null,
      isSuperUser: Boolean(data?.isSuperUser)
    };
  },

  async listPermissions(): Promise<{ permissions: PermissionDef[]; grouped: Record<string, PermissionDef[]> }> {
    const { data } = await api.get('/permissions');
    return {
      permissions: list<PermissionDef>(data?.permissions),
      grouped: (data?.grouped as Record<string, PermissionDef[]>) || {}
    };
  },

  async listRoles(department?: Department): Promise<RoleSummary[]> {
    const { data } = await api.get('/roles', { params: department ? { department } : undefined });
    return list<RoleSummary>(data);
  },

  async getRolePermissions(roleId: string): Promise<RoleDetail> {
    const { data } = await api.get(`/roles/${roleId}/permissions`);
    return data as RoleDetail;
  },

  async updateRolePermissions(roleId: string, permissionCodes: string[]) {
    const { data } = await api.put(`/roles/${roleId}/permissions`, { permissionCodes });
    return data;
  },

  async createRole(payload: {
    name: string;
    department: Department;
    description?: string;
    permissionCodes?: string[];
  }) {
    const { data } = await api.post('/roles', payload);
    return data as RoleSummary;
  },

  async updateRole(roleId: string, payload: { name?: string; isActive?: boolean; description?: string }) {
    const { data } = await api.put(`/roles/${roleId}`, payload);
    return data;
  },

  async deleteRole(roleId: string) {
    const { data } = await api.delete(`/roles/${roleId}`);
    return data;
  },

  async assignUserRole(userId: string, roleId: string) {
    const { data } = await api.put(`/users/${userId}/role`, { roleId });
    return data;
  },

  async setUserOverrides(userId: string, granted: string[], revoked: string[]) {
    const { data } = await api.put(`/users/${userId}/permissions`, { granted, revoked });
    return data;
  }
};

export const DEPARTMENTS: Department[] = [
  'FRONT_DESK', 'CONCIERGE', 'HOUSEKEEPING', 'LAUNDRY', 'FOOD_BEVERAGE',
  'KITCHEN', 'POS', 'SECURITY', 'MAINTENANCE', 'GROUNDS', 'SPA_WELLNESS',
  'TRANSPORT', 'EVENTS', 'FINANCE', 'HR', 'INVENTORY', 'SALES_MARKETING',
  'IT', 'MANAGEMENT'
];

export const CATEGORY_LABEL: Record<PermissionCategory, string> = {
  MODULE: 'Module access',
  OPERATION: 'Operations',
  FINANCE: 'Finance',
  HR: 'HR',
  INVENTORY: 'Inventory'
};
