import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import Layout from '../../../components/Layout';
import DamageReportDialog from '../../../components/checkout/DamageReportDialog';
import ReportIssueDialog from '../../../components/housekeeping/ReportIssueDialog';
import { roomOpsService } from '../../../services/operations';
import { api } from '../../../services/api';
import { INSPECTION_LABEL, checkoutApi, type InspectionStatus } from '../../../services/checkout';
import { useRoomTypeNames } from '../../../hooks/useRoomTypeNames';
import { formatCurrency } from '../../../utils/formatters';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * Room inspection for housekeeping: per room, record damage found during the
 * stay, count what is left in the minibar (the system works out what was
 * taken and prices it for the front desk), take the room out of order, and
 * mark the inspection done.
 */

type RoomRow = { id: string; roomNumber: string; roomType: string; status: string };
type Stay = { id: string; bookingNumber?: string; guestName?: string; inspectionStatus?: InspectionStatus; status?: string };

const RoomInspectionPage: React.FC = () => {
  const roomTypeName = useRoomTypeNames();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [roomId, setRoomId] = useState('');
  const [stay, setStay] = useState<Stay | null>(null);
  const [minibar, setMinibar] = useState<Array<{ itemId: string; name: string; price: number; parQuantity: number }>>([]);
  const [remaining, setRemaining] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [damageOpen, setDamageOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    roomOpsService
      .listRooms()
      .then((rows) => setRooms([...rows].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))))
      .catch((err) => setError(getApiErrorMessage(err, 'Could not load rooms')));
  }, []);

  const room = rooms.find((r) => r.id === roomId);

  const loadRoom = useCallback(async () => {
    if (!roomId) return;
    setError('');
    try {
      const [mb, detail] = await Promise.all([
        checkoutApi.roomMinibar(roomId).catch(() => ({ items: [] as Array<{ itemId: string; name: string; price: number; parQuantity: number }>, lastCount: null })),
        api.get(`/rooms/${roomId}`).then((r) => r.data as { reservations?: Array<Record<string, unknown>> })
      ]);
      setMinibar(mb.items);
      setRemaining(Object.fromEntries(mb.items.map((i) => [i.itemId, String(i.parQuantity)])));
      // The guest in the room, or the one who has just left.
      const reservations = (detail.reservations ?? []) as Array<{ id: string; reservationNumber?: string; bookingNumber?: string; guestName?: string; guest?: { firstName?: string; lastName?: string }; status: string; inspectionStatus?: InspectionStatus }>;
      const current = reservations.find((r) => r.status === 'CHECKED_IN') ?? reservations.find((r) => r.status === 'CHECKED_OUT');
      setStay(current ? {
        id: current.id,
        bookingNumber: current.reservationNumber ?? current.bookingNumber,
        guestName: current.guestName ?? `${current.guest?.firstName ?? ''} ${current.guest?.lastName ?? ''}`.trim(),
        status: current.status,
        inspectionStatus: current.inspectionStatus
      } : null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the room'));
    }
  }, [roomId]);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  const preview = useMemo(
    () =>
      minibar.map((i) => {
        const left = Math.min(Math.max(Number(remaining[i.itemId] ?? i.parQuantity) || 0, 0), i.parQuantity);
        const taken = i.parQuantity - left;
        return { ...i, left, taken, amount: taken * i.price };
      }),
    [minibar, remaining]
  );
  const minibarTotal = preview.reduce((sum, l) => sum + l.amount, 0);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(done);
      await loadRoom();
    } catch (err) {
      setError(getApiErrorMessage(err, 'That did not work'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h4" fontWeight={800}>Room inspection</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Check the room before the guest checks out: damage, the minibar, and anything that needs fixing.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

        <TextField select fullWidth label="Room" value={roomId} onChange={(e) => setRoomId(e.target.value)} sx={{ mb: 2, maxWidth: 420 }}>
          {rooms.map((r) => (
            <MenuItem key={r.id} value={r.id}>Room {r.roomNumber} · {roomTypeName(r.roomType)} · {r.status.toLowerCase()}</MenuItem>
          ))}
        </TextField>

        {room && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography fontWeight={800}>Room {room.roomNumber}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stay ? `${stay.guestName || 'Guest'} · ${stay.bookingNumber ?? ''} · ${stay.status === 'CHECKED_IN' ? 'staying now' : 'just left'}` : 'No current guest'}
                    </Typography>
                  </Box>
                  {stay?.inspectionStatus && <Chip label={INSPECTION_LABEL[stay.inspectionStatus]} color={stay.inspectionStatus === 'COMPLETED' ? 'success' : stay.inspectionStatus === 'ISSUES_FOUND' ? 'warning' : 'default'} />}
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12} md={7}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <Typography fontWeight={800} sx={{ mb: 1 }}>Minibar — what is left?</Typography>
                {minibar.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">This room has no minibar set up. The front desk sets it up under Minibar.</Typography>
                ) : (
                  <>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Item</TableCell>
                          <TableCell align="right">Full</TableCell>
                          <TableCell align="right">Left</TableCell>
                          <TableCell align="right">Taken</TableCell>
                          <TableCell align="right">Amount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {preview.map((line) => (
                          <TableRow key={line.itemId}>
                            <TableCell>{line.name} <Typography component="span" variant="caption" color="text.secondary">· {formatCurrency(line.price)}</Typography></TableCell>
                            <TableCell align="right">{line.parQuantity}</TableCell>
                            <TableCell align="right" sx={{ width: 90 }}>
                              <TextField size="small" type="number" value={remaining[line.itemId] ?? ''} inputProps={{ min: 0, max: line.parQuantity, 'aria-label': `${line.name} left` }}
                                onChange={(e) => setRemaining({ ...remaining, [line.itemId]: e.target.value })} />
                            </TableCell>
                            <TableCell align="right">{line.taken}</TableCell>
                            <TableCell align="right">{formatCurrency(line.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={4}><strong>Minibar total</strong></TableCell>
                          <TableCell align="right"><strong>{formatCurrency(minibarTotal)}</strong></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                    <Button variant="contained" sx={{ mt: 1.5 }} disabled={busy}
                      onClick={() => void act(() => checkoutApi.countMinibar(room.id, preview.map((l) => ({ itemId: l.itemId, remaining: l.left }))), minibarTotal > 0 ? 'Minibar count sent to the front desk to charge.' : 'Minibar count saved — nothing taken.')}>
                      Save minibar count
                    </Button>
                  </>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} md={5}>
              <Stack spacing={2}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography fontWeight={800} sx={{ mb: 1 }}>Damage and repairs</Typography>
                  <Stack spacing={1}>
                    <Button variant="outlined" color="warning" onClick={() => setDamageOpen(true)}>Report damage during the stay</Button>
                    <Button variant="outlined" onClick={() => setIssueOpen(true)}>Report a fault / take out of order</Button>
                  </Stack>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography fontWeight={800} sx={{ mb: 1 }}>Finish the inspection</Typography>
                  {stay ? (
                    <Stack spacing={1}>
                      <TextField size="small" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} />
                      <Stack direction="row" spacing={1}>
                        <Button variant="contained" color="success" disabled={busy} onClick={() => void act(() => checkoutApi.setInspection(stay.id, 'COMPLETED', notes || undefined), 'Inspection done.')}>All fine</Button>
                        <Button variant="outlined" color="warning" disabled={busy} onClick={() => void act(() => checkoutApi.setInspection(stay.id, 'ISSUES_FOUND', notes || undefined), 'Inspection done — issues recorded.')}>Issues found</Button>
                      </Stack>
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No stay to inspect for this room.</Typography>
                  )}
                </Paper>
              </Stack>
            </Grid>
          </Grid>
        )}

        <DamageReportDialog open={damageOpen} roomId={room?.id} roomNumber={room?.roomNumber} bookingId={stay?.id} onClose={() => setDamageOpen(false)}
          onReported={(ref) => { setDamageOpen(false); setNotice(`Damage ${ref} reported. A manager will assess it.`); void loadRoom(); }} />
        <ReportIssueDialog open={issueOpen} onClose={() => setIssueOpen(false)} onReported={(message) => { setIssueOpen(false); setNotice(message); }} />
      </Container>
    </Layout>
  );
};

export default RoomInspectionPage;
