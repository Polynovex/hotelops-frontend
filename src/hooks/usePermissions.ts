import { useAuthStore } from '../store/authStore';

export const usePermissions = () => {
  const role = useAuthStore((state) => state.user?.role);

  const hasRole = (...roles: string[]) => {
    if (!role) {
      return false;
    }
    return roles.includes(role);
  };

  return {
    role,
    hasRole
  };
};
