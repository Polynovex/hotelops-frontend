import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material';
import LockClockRoundedIcon from '@mui/icons-material/LockClockRounded';
import { hrService, type ShiftAccess } from '../services/hr.service';
import { useAuthStore } from '../store/authStore';
import { postLoginPath } from '../utils/roleLanding';
import { getApiErrorMessage } from '../utils/apiError';

/**
 * Shown when access is paused by the rota: after a shift (and its two-hour
 * allowance) that was not ended, or while overtime waits for HR. The person
 * can end their shift, ask for overtime while still in time, or open Staff
 * Hub. The owner or GM can unlock them from their staff profile.
 */
const ShiftLockedPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [access, setAccess] = useState<ShiftAccess | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const state = await hrService.myShiftAccess();
      setAccess(state);
      // Nothing is restricted any more (ended, unlocked or approved): carry on.
      if (state.state === 'OPEN' && user) navigate(postLoginPath(user.role), { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not check your shift'));
    }
  }, [navigate, user]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const endShift = async () => {
    setBusy(true);
    setError('');
    try {
      await hrService.clockOut({ method: 'MANUAL' });
      setNotice('Your shift is ended. Thank you.');
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not end your shift'));
    } finally {
      setBusy(false);
    }
  };


  const clockedIn = Boolean(access?.attendance?.clockIn && !access.attendance.clockOut);

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 2 }}>
      <Container maxWidth="sm">
        <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
          <Stack spacing={2} alignItems="center" textAlign="center">
            <LockClockRoundedIcon color="primary" sx={{ fontSize: 48 }} />
            <Typography variant="h5" fontWeight={800}>
              {access?.state === 'OVERTIME_PENDING' ? 'Waiting for overtime approval' : access?.state === 'END_SHIFT_REQUIRED' ? 'Your shift has ended' : 'You are off duty'}
            </Typography>
            {!access && !error && <CircularProgress size={24} />}
            {access?.message && <Typography color="text.secondary">{access.message}</Typography>}
            {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}
            {notice && <Alert severity="success" sx={{ width: '100%' }}>{notice}</Alert>}

            {clockedIn && (
              <Button fullWidth size="large" variant="contained" color="warning" onClick={() => void endShift()} disabled={busy}>
                End my shift
              </Button>
            )}


            <Stack direction="row" spacing={1}>
              <Button onClick={() => navigate('/my-hr')}>Staff Hub</Button>
              <Button onClick={() => { logout(); navigate('/login'); }}>Sign out</Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">Need access now? Ask the owner or GM to unlock your account.</Typography>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default ShiftLockedPage;
