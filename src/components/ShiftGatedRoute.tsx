/**
 * ShiftGatedRoute
 * Wraps any route that requires an active shift.
 * If the user has no open shift, redirects to /shift with a toast message.
 */
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useAuthStore } from '../store/authStore';
import { shiftService } from '../services/shift.service';
import LogoLoader from './LogoLoader';

const SHIFT_EXEMPT_ROLES = ['SUPER_ADMIN', 'BUSINESS_ADMIN', 'MANAGER'];

interface Props {
  children: JSX.Element;
}

const ShiftGatedRoute = ({ children }: Props) => {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();

  const [checking, setChecking] = useState(true);
  const [hasShift, setHasShift] = useState(false);

  const role = user?.role?.toUpperCase() ?? '';

  useEffect(() => {
    if (!user || !token) {
      setChecking(false);
      return;
    }

    if (SHIFT_EXEMPT_ROLES.includes(role)) {
      setHasShift(true);
      setChecking(false);
      return;
    }

    const check = async () => {
      try {
        const result = await shiftService.getMine();
        setHasShift(!!result?.shift);
      } catch {
        setHasShift(false);
      } finally {
        setChecking(false);
      }
    };

    void check();
  }, [user?.id, token, role]);

  if (checking) return <LogoLoader inline minHeight={160} label="Checking shift…" />;

  if (!hasShift) {
    enqueueSnackbar('You must open a shift before performing this operation.', {
      variant: 'warning',
      preventDuplicate: true
    });
    return <Navigate to="/shift" state={{ from: location }} replace />;
  }

  return children;
};

export default ShiftGatedRoute;
