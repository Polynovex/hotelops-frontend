import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import { formatNaira, posFlow, type PosOrderRow } from '../../services/posFlow';
import { getApiErrorMessage } from '../../utils/apiError';

/**
 * The POS agent takes payment: card (terminal), transfer, or cash where the
 * hotel accepts it. Online gateways are for guests on QR orders, not here.
 * Part payments are allowed; the order closes once fully paid.
 */
const LABEL: Record<string, string> = { CARD: 'Card (POS terminal)', TRANSFER: 'Bank transfer', CASH: 'Cash', ROOM: 'Send bill to room' };

export function TakePaymentDialog({
  order,
  onClose,
  onPaid
}: {
  order: PosOrderRow | null;
  onClose: () => void;
  onPaid: (message: string) => void;
}) {
  const [methods, setMethods] = useState<string[]>(['CARD', 'TRANSFER']);
  const [method, setMethod] = useState('CARD');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rooms, setRooms] = useState<Array<{ bookingId: string; roomNumber: string; guestName: string }>>([]);
  const [roomNumber, setRoomNumber] = useState('');

  useEffect(() => {
    if (!order) return;
    setAmount(String(order.total));
    setReference('');
    setError('');
    setRoomNumber(order.metadata?.roomNumber ?? '');
    posFlow.chargeableRooms().then(setRooms).catch(() => setRooms([]));
    // Default to how a QR guest said they would pay, when it is offered.
    const preferred = order.metadata?.paymentPreference;
    posFlow
      .paymentOptions()
      .then((options) => {
        setMethods(options.manual);
        setMethod(preferred && (options.manual as string[]).includes(preferred) ? preferred : options.manual[0]);
      })
      .catch(() => undefined);
  }, [order]);

  const submit = async () => {
    if (!order) return;
    setBusy(true);
    setError('');
    try {
      if (method === 'ROOM') {
        // The whole order goes on the room bill, pending until check-out.
        const result = await posFlow.chargeToRoom(order.id, roomNumber);
        onPaid(`${order.orderNumber} sent to room ${result.roomNumber} (${result.guestName})`);
        return;
      }
      await posFlow.takePayment(order.id, {
        method,
        amount: Number(amount),
        reference: reference.trim() || undefined
      });
      onPaid(`${formatNaira(Number(amount))} received by ${method.toLowerCase()} for ${order.orderNumber}`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not record the payment'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(order)} onClose={() => !busy && onClose()} fullWidth maxWidth="xs">
      <DialogTitle>Take payment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2">
            {order?.orderNumber} · total <strong>{formatNaira(order?.total ?? 0)}</strong>
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <ToggleButtonGroup
            exclusive
            value={method}
            onChange={(_event, value) => value && setMethod(value)}
            orientation="vertical"
            fullWidth
          >
            {methods.map((value) => (
              <ToggleButton key={value} value={value} sx={{ textTransform: 'none', fontWeight: 700 }}>
                {LABEL[value] ?? value}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {method === 'ROOM' ? (
            <TextField
              select
              label="Room"
              value={roomNumber}
              onChange={(event) => setRoomNumber(event.target.value)}
              helperText={rooms.length ? 'The full order is posted to this guest’s bill, pending until they settle.' : 'No guest is checked in right now.'}
            >
              {rooms.map((room) => (
                <MenuItem key={room.bookingId} value={room.roomNumber}>
                  Room {room.roomNumber} — {room.guestName}
                </MenuItem>
              ))}
            </TextField>
          ) : (
          <TextField
            label="Amount (₦)"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputProps={{ min: 0, step: 0.01 }}
            helperText="Less than the total records a part payment"
          />
          )}
          {method !== 'CASH' && method !== 'ROOM' && (
            <TextField
              label={method === 'TRANSFER' ? 'Transfer reference' : 'Terminal receipt / reference'}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={() => void submit()} disabled={busy || (method === 'ROOM' ? !roomNumber : !(Number(amount) > 0))}>
          {busy ? 'Recording…' : method === 'ROOM' ? 'Send to room' : 'Record payment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
