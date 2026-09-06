import type { UserRole } from '../services/api';

/**
 * Where each role lands after signing in.
 *
 * One definition, because there were three: the email login, the usercode
 * login and the post-reset redirect each carried their own copy, and they had
 * already drifted — a role added to one was missing from the others. Every
 * caller now reads from here.
 *
 * The rule behind the map: a person should land on the screen that answers
 * "what do I need to do now?" for their job. Roles that run a till used to
 * land on the shift page, which answers only "is my till open?" and left them
 * to find the rest of their day in the sidebar.
 */
const LANDING_BY_ROLE: Record<UserRole, string> = {
  SUPER_ADMIN: '/super-admin/dashboard',
  BUSINESS_ADMIN: '/business/dashboard',
  MANAGER: '/business/dashboard',
  ACCOUNTANT: '/accountant/dashboard',
  RECEPTIONIST: '/reception/dashboard',
  // Legacy alias for RECEPTIONIST, still returned by older records.
  RECEPTION: '/reception/dashboard',
  FRONT_OFFICE: '/reception/dashboard',
  POS_STAFF: '/pos/dashboard',
  HOUSEKEEPING: '/housekeeping/dashboard',
  // No operational access: the HR self-service portal is what this account is
  // for. An HR Manager shares this role but reaches the HR module through
  // permissions, and lands there from the navigation.
  SUPPORT_STAFF: '/my-hr'
};

/** Falls back to the most restricted landing rather than the most privileged. */
export const landingPathForRole = (role: UserRole | string | undefined | null): string => {
  const key = String(role || '').toUpperCase() as UserRole;
  return LANDING_BY_ROLE[key] ?? '/my-hr';
};

/**
 * Where to send someone after signing in, accounting for a forced password
 * change taking priority over their normal landing screen.
 */
export const postLoginPath = (
  role: UserRole | string | undefined | null,
  mustResetPassword?: boolean
): string => (mustResetPassword ? '/change-password' : landingPathForRole(role));
