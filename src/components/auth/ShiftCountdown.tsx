import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { hrService } from '../../services/hr.service';
import { useAuthStore } from '../../store/authStore';

const EXEMPT = ['SUPER_ADMIN', 'BUSINESS_ADMIN', 'MANAGER'];
const WARN_MS = 15 * 60_000;

/**
 * Access follows the rota. In the last 15 minutes before a staff member's
 * access closes this counts down, so nobody is cut off mid-task without
 * warning; at zero it moves them to the shift page (end the shift, or ask for
 * overtime) instead of failing on their next click.
 */
const ShiftCountdown = () => {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!role || EXEMPT.includes(role)) return;
    let alive = true;
    const load = () =>
      hrService
        .myShiftAccess()
        .then((access) => alive && setEndsAt(access.state === 'OPEN' && access.accessEndsAt ? Date.parse(access.accessEndsAt) : null))
        .catch(() => undefined);
    void load();
    const poll = window.setInterval(load, 120_000);
    return () => {
      alive = false;
      window.clearInterval(poll);
    };
  }, [role]);

  useEffect(() => {
    if (!endsAt) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [endsAt]);

  useEffect(() => {
    if (endsAt && now >= endsAt) navigate('/shift-locked', { replace: true });
  }, [endsAt, now, navigate]);

  if (!endsAt || endsAt - now > WARN_MS || now >= endsAt) return null;
  const left = Math.max(endsAt - now, 0);
  const mm = String(Math.floor(left / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((left % 60_000) / 1000)).padStart(2, '0');
  return (
    <Box sx={{ position: 'fixed', zIndex: 1400, left: 16, right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <Alert
        severity="warning"
        variant="filled"
        sx={{ pointerEvents: 'auto', maxWidth: 560, width: '100%' }}
        action={<Button color="inherit" size="small" onClick={() => navigate('/shift-locked')}>Shift options</Button>}
      >
        Your access ends in {mm}:{ss}. Save your work, then end your shift or ask for overtime.
      </Alert>
    </Box>
  );
};

export default ShiftCountdown;
