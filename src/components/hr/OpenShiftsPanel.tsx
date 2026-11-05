import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { shiftService } from '../../services/shift.service';
import { api } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';

type OpenShift = { id: string; status: string; openedAt: string; user?: { firstName?: string; lastName?: string } | null };

/**
 * Shifts still open, for HR to close at any time. Shifts also close by
 * themselves two hours after the rota end unless overtime was approved.
 */
const OpenShiftsPanel = () => {
  const [rows, setRows] = useState<OpenShift[]>([]);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState<OpenShift | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [open, onBreak] = await Promise.all([
        shiftService.list({ status: 'OPEN', pageSize: 100 } as never),
        shiftService.list({ status: 'ON_BREAK', pageSize: 100 } as never)
      ]);
      setRows([...open.items, ...onBreak.items] as OpenShift[]);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load open shifts'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const close = async () => {
    if (!closing) return;
    setBusy(true);
    try {
      await api.post(`/shifts/${closing.id}/force-close`, { reason: reason.trim() || undefined });
      setClosing(null);
      setReason('');
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not close the shift'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6" fontWeight={700}>Open shifts</Typography>
        <Chip size="small" label={rows.length} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Shifts close by themselves two hours after the rota end unless overtime was approved. You can close any of them now.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No shifts are open.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>Staff</TableCell><TableCell>Opened</TableCell><TableCell>Status</TableCell><TableCell align="right">Action</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{`${row.user?.firstName ?? ''} ${row.user?.lastName ?? ''}`.trim() || 'Staff'}</TableCell>
                <TableCell>{new Date(row.openedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</TableCell>
                <TableCell><Chip size="small" label={row.status === 'ON_BREAK' ? 'On break' : 'Open'} /></TableCell>
                <TableCell align="right"><Button size="small" color="warning" onClick={() => setClosing(row)}>Close shift</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Dialog open={Boolean(closing)} onClose={() => !busy && setClosing(null)} fullWidth maxWidth="xs">
        <DialogTitle>Close this shift?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">The cash is not counted, so the shift records what was expected. The staff member is clocked out now.</Alert>
            <TextField fullWidth label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClosing(null)} disabled={busy}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={() => void close()} disabled={busy}>Close shift</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default OpenShiftsPanel;
