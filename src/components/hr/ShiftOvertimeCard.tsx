import React, { useEffect, useState } from 'react';
import { Alert, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { hrService, type ShiftAccess } from '../../services/hr.service';
import { getApiErrorMessage } from '../../utils/apiError';

/**
 * In Staff Hub: today's shift and, while it is on (or within two hours of
 * its end) and the person is clocked in, a way to ask HR for overtime.
 * Asking pauses access once the shift is over, until HR approves.
 */
const ShiftOvertimeCard: React.FC = () => {
  const [access, setAccess] = useState<ShiftAccess | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    hrService.myShiftAccess().then(setAccess).catch(() => setAccess(null));
  }, []);

  if (!access?.shift) return null;
  const clockedIn = Boolean(access.attendance?.clockIn && !access.attendance.clockOut);
  const canAsk = access.state === 'OPEN' && (access.reason === 'ON_SHIFT' || access.reason === 'AFTER_SHIFT') && clockedIn && access.shift.overtimeStatus === 'NONE';
  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const ask = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await hrService.requestShiftOvertime(reason.trim());
      setMessage(result.message);
      setAccess(await hrService.myShiftAccess());
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not ask for overtime'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
      <Typography fontWeight={800}>Your shift</Typography>
      <Typography variant="body2" color="text.secondary">
        {time(access.shift.startsAt)} – {time(access.shift.endsAt)}
        {access.shift.overtimeStatus === 'PENDING' ? ' · overtime waiting for HR' : access.shift.overtimeStatus === 'APPROVED' ? ' · overtime approved' : ''}
      </Typography>
      {message && <Alert severity="info" sx={{ mt: 1 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      {canAsk && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
          <TextField size="small" fullWidth label="Need to stay longer? Why?" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="outlined" disabled={busy || reason.trim().length < 3} onClick={() => void ask()}>Ask for overtime</Button>
        </Stack>
      )}
    </Paper>
  );
};

export default ShiftOvertimeCard;
