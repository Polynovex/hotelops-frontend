import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { reservationOpsService, type ReservationBill } from '../../services/operations';
import { usePermissionStore } from '../../store/permissionStore';
import { getApiErrorMessage } from '../../utils/apiError';

/**
 * Check-out: every bill posted to the room is listed with its status. The
 * guest settles everything at once, or chosen charges independently, by any
 * method. Check-out unlocks once nothing is owed; a manager may check out
 * with a balance, giving a reason.
 */

const METHODS: Array<[string, string]> = [
  ['CASH', 'Cash'],
  ['CARD', 'Card'],
  ['POS_TERMINAL', 'POS terminal'],
  ['TRANSFER', 'Bank transfer'],
  ['COMPANY', 'Company account']
];
const naira = (value: number) => `₦${Math.round(value).toLocaleString()}`;
const STAY = 'STAY';

const CheckoutSettlementDialog: React.FC<{
  reservationId: string | null;
  onClose: () => void;
  onCheckedOut: () => void;
}> = ({ reservationId, onClose, onCheckedOut }) => {
  const canOverride = usePermissionStore((state) => state.can)('CHECKOUT_WITH_BALANCE');
  const [bill, setBill] = useState<ReservationBill | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!reservationId) return;
    try {
      setBill(await reservationOpsService.getBill(reservationId));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the bill'));
    }
  }, [reservationId]);

  useEffect(() => {
    setBill(null);
    setSelected([]);
    setReference('');
    setOverrideReason('');
    setError('');
    setNotice('');
    void load();
  }, [load]);

  const pendingCharges = useMemo(() => (bill?.charges ?? []).filter((c) => c.status === 'PENDING'), [bill]);
  const selectedTotal = useMemo(() => {
    if (!bill) return 0;
    const charges = pendingCharges.filter((c) => selected.includes(c.id)).reduce((sum, c) => sum + c.totalAmount, 0);
    return charges + (selected.includes(STAY) ? bill.accommodation.outstanding : 0);
  }, [bill, pendingCharges, selected]);
  const owed = bill ? bill.totals.balance > 0.009 || bill.totals.pending > 0.009 : true;

  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const settle = async (all: boolean) => {
    if (!reservationId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await reservationOpsService.settleBill(reservationId, {
        ...(all ? { all: true } : { chargeIds: selected.filter((id) => id !== STAY), includeAccommodation: selected.includes(STAY) }),
        method,
        ...(reference.trim() ? { reference: reference.trim() } : {})
      });
      setBill(result.bill);
      setSelected([]);
      setReference('');
      setNotice(`${naira(result.payment.amount)} settled (${result.payment.reference}).`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not settle'));
    } finally {
      setBusy(false);
    }
  };

  const checkOut = async () => {
    if (!reservationId) return;
    setBusy(true);
    setError('');
    try {
      await reservationOpsService.checkOut(reservationId, owed ? { overrideReason: overrideReason.trim() } : {});
      onCheckedOut();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not check out'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(reservationId)} onClose={() => !busy && onClose()} fullWidth maxWidth="md">
      <DialogTitle>
        Check out {bill ? `${bill.booking.guestName} · Room ${bill.booking.roomNumber ?? '—'}` : ''}
      </DialogTitle>
      <DialogContent dividers>
        {!bill ? (
          <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}>{error ? <Alert severity="error">{error}</Alert> : <CircularProgress />}</Box>
        ) : (
          <Stack spacing={2}>
            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
            {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Charge</TableCell>
                    <TableCell>Posted</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox checked={selected.includes(STAY)} onChange={() => toggle(STAY)} disabled={bill.accommodation.outstanding <= 0} inputProps={{ 'aria-label': 'Select the stay' }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>Accommodation</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(bill.booking.checkIn).toLocaleDateString()} – {new Date(bill.booking.checkOut).toLocaleDateString()} · stay total {naira(bill.accommodation.total)}
                      </Typography>
                    </TableCell>
                    <TableCell>—</TableCell>
                    <TableCell align="right">{naira(bill.accommodation.outstanding)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={bill.accommodation.outstanding > 0 ? 'Pending' : 'Settled'} color={bill.accommodation.outstanding > 0 ? 'warning' : 'success'} />
                    </TableCell>
                  </TableRow>
                  {bill.charges.map((charge) => (
                    <TableRow key={charge.id}>
                      <TableCell padding="checkbox">
                        <Checkbox checked={selected.includes(charge.id)} onChange={() => toggle(charge.id)} disabled={charge.status !== 'PENDING'} inputProps={{ 'aria-label': `Select ${charge.description}` }} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 380 }}>
                        <Typography variant="body2">{charge.items ?? charge.description}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[charge.outlet, charge.roomNumber ? `Room ${charge.roomNumber}` : null].filter(Boolean).join(' · ')}
                        </Typography>
                      </TableCell>
                      <TableCell>{new Date(charge.postedAt).toLocaleString()}</TableCell>
                      <TableCell align="right">{naira(charge.totalAmount)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={charge.status === 'SETTLED' ? 'Settled' : 'Pending'} color={charge.status === 'SETTLED' ? 'success' : 'warning'} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <Divider />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
              <Typography>Paid so far: <strong>{naira(bill.totals.paid)}</strong></Typography>
              <Typography variant="h6">Balance: <strong>{naira(bill.totals.balance)}</strong></Typography>
            </Stack>
            {owed && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField select size="small" label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)} sx={{ minWidth: 200 }}>
                  {METHODS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                </TextField>
                <TextField size="small" label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} fullWidth />
              </Stack>
            )}
            {owed && canOverride && (
              <TextField
                size="small"
                label="Manager override: reason to check out with a balance"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                helperText="Only if the guest will pay later (e.g. company invoice). Recorded in the audit trail."
                fullWidth
              />
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy}>Close</Button>
        <Box sx={{ flexGrow: 1 }} />
        {owed && (
          <>
            <Button variant="outlined" onClick={() => void settle(false)} disabled={busy || selectedTotal <= 0}>
              Settle selected {selectedTotal > 0 ? `(${naira(selectedTotal)})` : ''}
            </Button>
            <Button variant="contained" color="secondary" onClick={() => void settle(true)} disabled={busy || !bill}>
              Settle all {bill ? `(${naira(bill.totals.balance)})` : ''}
            </Button>
          </>
        )}
        <Button
          variant="contained"
          color="warning"
          onClick={() => void checkOut()}
          disabled={busy || !bill || (owed && !(canOverride && overrideReason.trim().length >= 3))}
        >
          {owed ? 'Check out with balance' : 'Check out'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CheckoutSettlementDialog;
