import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { api } from '../../services/api';
import { hrService } from '../../services/hr.service';
import { getApiErrorMessage } from '../../utils/apiError';

type LockedStaff = {
  staffId: string;
  name: string;
  jobTitle: string | null;
  state: string;
  message: string | null;
  shiftEndedAt: string | null;
  shiftMinutes: number | null;
  unlockedUntil: string | null;
  unlockReason: string | null;
};

const STATE_LABEL: Record<string, string> = {
  END_SHIFT_REQUIRED: 'Shift over',
  OVERTIME_PENDING: 'Overtime waiting',
  OFF_DUTY: 'Off duty',
  TOO_EARLY: 'Before shift',
  OPEN: 'Let in'
};

const time = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
const hours = (minutes: number) => (minutes % 60 === 0 ? `${minutes / 60} hours` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`);

/**
 * Staff the rota has signed out because their shift is over, with a way to
 * let them back in. HR, the owner and the GM can give access; it is recorded
 * in the audit trail and is not paid time.
 */
const LockedStaffPanel = () => {
  const [rows, setRows] = useState<LockedStaff[]>([]);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [target, setTarget] = useState<LockedStaff | null>(null);
  const [minutes, setMinutes] = useState('60');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/hr/access/locked');
      setRows((data?.items ?? []) as LockedStaff[]);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load who is locked out'));
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const options = (row: LockedStaff | null) => {
    const base: Array<[string, string]> = [['30', '30 minutes'], ['60', '1 hour'], ['120', '2 hours'], ['240', '4 hours'], ['480', '8 hours'], ['720', '12 hours']];
    const shift = row?.shiftMinutes;
    if (shift && shift >= 5 && shift <= 720 && !base.some(([v]) => Number(v) === shift)) base.unshift([String(shift), `A full shift (${hours(shift)})`]);
    else if (shift) return base.map(([v, l]) => [v, Number(v) === shift ? `${l} (a full shift)` : l] as [string, string]);
    return base;
  };

  const open = (row: LockedStaff) => {
    setTarget(row);
    setMinutes(String(row.shiftMinutes && row.shiftMinutes >= 5 && row.shiftMinutes <= 720 ? row.shiftMinutes : 60));
    setReason('');
  };

  const give = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const result = await hrService.grantAccess(target.staffId, Number(minutes), reason.trim());
      setNote(`${target.name} can sign in until ${time(result.until)}.`);
      setTarget(null);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not give access'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6" fontWeight={700}>Signed out by the rota</Typography>
        <Chip size="small" color={rows.some((r) => !r.unlockedUntil) ? 'warning' : 'default'} label={rows.filter((r) => !r.unlockedUntil).length} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Staff are signed out two hours after their shift ends. Give access to let someone back in for a set time; it is recorded in the audit trail and is not paid time.
      </Typography>
      {note && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setNote('')}>{note}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Nobody is locked out right now.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>Staff</TableCell><TableCell>Shift ended</TableCell><TableCell>Status</TableCell><TableCell align="right">Action</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.staffId}>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
                  {row.jobTitle && <Typography variant="caption" color="text.secondary">{row.jobTitle}</Typography>}
                </TableCell>
                <TableCell>{row.shiftEndedAt ? time(row.shiftEndedAt) : '—'}</TableCell>
                <TableCell>
                  {row.unlockedUntil ? (
                    <Chip size="small" color="success" label={`Let in until ${time(row.unlockedUntil)}`} />
                  ) : (
                    <Chip size="small" color="warning" label={STATE_LABEL[row.state] ?? row.state} />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Button size="small" variant={row.unlockedUntil ? 'text' : 'contained'} onClick={() => open(row)}>
                    {row.unlockedUntil ? 'Extend' : 'Give access'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Dialog open={Boolean(target)} onClose={() => !busy && setTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Give {target?.name} access</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {target?.message && <Alert severity="info">{target.message}</Alert>}
            <TextField select label="For" value={minutes} onChange={(e) => setMinutes(e.target.value)}>
              {options(target).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
            </TextField>
            <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Covering for a colleague" />
            <Typography variant="caption" color="text.secondary">
              Their open till shift is not closed automatically while they have access.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTarget(null)} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={() => void give()} disabled={busy || reason.trim().length < 3}>Give access</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default LockedStaffPanel;
