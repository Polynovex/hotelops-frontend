import { UserRole } from '../types/enums';

export const hasRole = (userRole: string | undefined, allowedRoles: UserRole[]) => {
  if (!userRole) {
    return false;
  }

  return allowedRoles.includes(userRole as UserRole);
};
