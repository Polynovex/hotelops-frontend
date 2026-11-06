import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { api } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';

const METHODS: Array<[string, string]> = [
  ['CASH', 'Cash'],
  ['CARD', 'Card'],
  ['POS', 'POS terminal'],
  ['TRANSFER', 'Bank transfer']
];

const naira = (value: number) => `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Records a payment on a stay at the front desk: the deposit a guest pays
 * before check-in, or any payment towards the stay. The amount starts at what
 * is due to check in and can be changed.
 */
const TakeStayPaymentDialog = ({
  open,
  reservation,
  due,
  onClose,
  onPaid
}: {
  open: boolean;
  reservation: { id: string; guestName?: string | null; roomNumber?: string | null } | null;
  /** What still has to be paid to check in, if anything. */
  due?: number;
  onClose: () => void;
  onPaid: (amount: number) => void;
}) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setAmount(due && due > 0 ? String(due) : '');
    setMethod('CASH');
    setReference('');
    setError('');
  }, [open, due]);

  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;

  const submit = async () => {
    if (!reservation || !valid) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/payments', {
        bookingId: reservation.id,
        amount: value,
        paymentMethod: method,
        ...(reference.trim() ? { metadata: { reference: reference.trim() } } : {})
      });
      onPaid(value);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not record the payment'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="xs">
      <DialogTitle>Take payment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {reservation && (
            <Typography variant="body2" color="text.secondary">
              {[reservation.guestName, reservation.roomNumber ? `Room ${reservation.roomNumber}` : null].filter(Boolean).join(' · ')}
            </Typography>
          )}
          {due !== undefined && due > 0 && <Alert severity="info">{naira(due)} is due before check-in.</Alert>}
          <TextField label="Amount (₦)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} inputProps={{ min: 0, step: '0.01' }} autoFocus />
          <TextField select label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map(([v, l]) => (
              <MenuItem key={v} value={v}>
                {l}
              </MenuItem>
            ))}
          </TextField>
          {method !== 'CASH' && <TextField label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void submit()} disabled={busy || !valid}>
          {busy ? 'Recording…' : `Record ${valid ? naira(value) : 'payment'}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TakeStayPaymentDialog;
