import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ListSubheader,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { formatCurrency } from '../../utils/formatters';
import { guestExtrasApi, type AvailableAddOns, type BookingExtra } from '../../services/guestExtras';

/**
 * Guest add-ons on a stay — breakfast, late check-out, extra bed. Added at
 * check-in or any time at the front desk; each one is charged to the guest's
 * bill (per night ones for every night). Removing one voids its bill line.
 * Only the extras the signed-in user may sell are offered, grouped by the
 * department that provides them.
 */
const GuestExtrasSection = ({ bookingId, closed = false, onChange }: { bookingId: string; closed?: boolean; onChange?: () => void }) => {
  const [extras, setExtras] = useState<BookingExtra[]>([]);
  const [available, setAvailable] = useState<AvailableAddOns['guest']>([]);
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [removing, setRemoving] = useState<BookingExtra | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rows, groups] = await Promise.all([guestExtrasApi.forStay(bookingId), guestExtrasApi.available()]);
      setExtras(rows);
      setAvailable(groups.guest);
    } catch {
      // Not every role may see extras; the section simply stays empty.
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  const fail = (err: unknown, fallback: string) =>
    setError((err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message
      ?? (err as { response?: { data?: { error?: string } } }).response?.data?.error
      ?? fallback);

  const add = async () => {
    setBusy(true);
    setError('');
    try {
      await guestExtrasApi.addToStay(bookingId, choice, quantity);
      setOpen(false);
      setChoice('');
      setQuantity(1);
      await load();
      onChange?.();
    } catch (err) {
      fail(err, 'Could not add the extra.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setError('');
    try {
      await guestExtrasApi.removeFromStay(bookingId, removing.id, reason.trim());
      setRemoving(null);
      setReason('');
      await load();
      onChange?.();
    } catch (err) {
      fail(err, 'Could not remove the extra.');
    } finally {
      setBusy(false);
    }
  };

  const active = extras.filter((e) => e.status === 'ACTIVE');
  const hasChoices = available.some((g) => g.items.length > 0);
  if (!hasChoices && active.length === 0) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">Guest add-ons</Typography>
        {!closed && hasChoices && <Button size="small" onClick={() => setOpen(true)}>Add extra</Button>}
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}
      {active.length === 0 ? (
        <Typography variant="body2" color="text.secondary">None yet.</Typography>
      ) : (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {active.map((extra) => (
            <Chip
              key={extra.id}
              label={`${extra.name}${extra.quantity > 1 ? ` × ${extra.quantity}` : ''}${extra.nights > 1 ? ` · ${extra.nights} nights` : ''} — ${formatCurrency(extra.amount)}`}
              onDelete={closed ? undefined : () => { setRemoving(extra); setReason(''); }}
              color="secondary"
              variant="outlined"
            />
          ))}
        </Stack>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add a guest extra</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Extra" value={choice} onChange={(e) => setChoice(e.target.value)}>
              {available.flatMap((group) => [
                <ListSubheader key={`h-${group.department}`}>{group.label}</ListSubheader>,
                ...group.items.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name} — {formatCurrency(item.price)}{item.pricing === 'PER_NIGHT' ? ' per night' : ''}
                  </MenuItem>
                ))
              ])}
            </TextField>
            <TextField label="Quantity" type="number" inputProps={{ min: 1, max: 50 }} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
            <Typography variant="caption" color="text.secondary">It is charged to the guest’s bill straight away.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!choice || busy} onClick={add}>Add to bill</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(removing)} onClose={() => setRemoving(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove {removing?.name}</DialogTitle>
        <DialogContent>
          <TextField label="Reason" fullWidth required multiline minRows={2} value={reason} onChange={(e) => setReason(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoving(null)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={reason.trim().length < 3 || busy} onClick={remove}>Remove</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GuestExtrasSection;
