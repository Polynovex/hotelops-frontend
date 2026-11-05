import { useRoomTypeNames } from '../../../hooks/useRoomTypeNames';
import React, { useCallback, useEffect, useState } from 'react';
import ServerPdfPreview from '../../../components/documents/ServerPdfPreview';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import { printReceipt, receiptApi } from '../../../utils/receipt';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import Layout from '../../../components/Layout';
import { usePermissionStore } from '../../../store/permissionStore';
import {
  eventsApi,
  type EventDetail,
  type EventStatus
} from '../../../services/events';
import { formatCurrency } from '../../../utils/formatters';
import { getApiErrorMessage } from '../../../utils/apiError';
import { StatusChip, eventDates } from './EventsPage';
import AddOnsDialog from '../../../components/events/AddOnsDialog';

/**
 * One event: its details, the itemised invoice (printable), payments, linked
 * rooms and the status actions.
 */

const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Status moves offered from each status. */
const NEXT: Record<EventStatus, EventStatus[]> = {
  DRAFT: ['PENDING', 'QUOTATION_SENT', 'CONFIRMED', 'CANCELLED'],
  PENDING: ['QUOTATION_SENT', 'CONFIRMED', 'CANCELLED'],
  QUOTATION_SENT: ['CONFIRMED', 'PENDING', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: []
};
const ACTION_LABEL: Partial<Record<EventStatus, string>> = {
  PENDING: 'Mark pending',
  QUOTATION_SENT: 'Quotation sent',
  CONFIRMED: 'Confirm',
  IN_PROGRESS: 'Start event',
  COMPLETED: 'Complete',
  CANCELLED: 'Cancel event'
};

const EventDetailPage: React.FC = () => {
  const roomTypeName = useRoomTypeNames();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = usePermissionStore((state) => state.can);
  const canManage = can('MANAGE_EVENTS');
  const canPrice = can('EVENT_PRICING');

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState('');
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [sendNote, setSendNote] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [addOnsOpen, setAddOnsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState({ contactName: '', contactPhone: '', contactEmail: '', organization: '', billingAddress: '', specialRequirements: '', terms: '' });
  const [pay, setPay] = useState({ amount: '', method: 'TRANSFER', reference: '', notes: '' });

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setEvent(await eventsApi.get(id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the event'));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const move = async (status: EventStatus, why?: string) => {
    if (!event) return;
    setBusy(true);
    setError('');
    try {
      await eventsApi.setStatus(event.id, status, why);
      setCancelOpen(false);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not change the status'));
    } finally {
      setBusy(false);
    }
  };

  const recordPayment = async () => {
    if (!event) return;
    setBusy(true);
    setError('');
    try {
      await eventsApi.pay(event.id, { amount: Number(pay.amount), method: pay.method, reference: pay.reference.trim() || undefined, notes: pay.notes.trim() || undefined });
      setPayOpen(false);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not record the payment'));
    } finally {
      setBusy(false);
    }
  };

  if (!event) {
    return (
      <Layout>
        <Container maxWidth="lg" sx={{ py: 3 }}>
          {error ? <Alert severity="error">{error}</Alert> : <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}><CircularProgress /></Box>}
        </Container>
      </Layout>
    );
  }

  const closed = event.status === 'COMPLETED' || event.status === 'CANCELLED';
  // Once paid, the booking is fixed: details can be corrected and add-ons added.
  const paid = event.paidAmount > 0;
  const openDetails = () => {
    setDetails({
      contactName: event.contactName,
      contactPhone: event.contactPhone,
      contactEmail: event.contactEmail ?? '',
      organization: event.organization ?? '',
      billingAddress: event.billingAddress ?? '',
      specialRequirements: event.specialRequirements ?? '',
      terms: event.terms ?? ''
    });
    setDetailsOpen(true);
  };
  const saveDetails = async () => {
    setBusy(true);
    setError('');
    try {
      await eventsApi.update(event.id, details);
      setDetailsOpen(false);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the details'));
    } finally {
      setBusy(false);
    }
  };
  const dates = eventDates(event);

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h4" fontWeight={800}>{event.eventName}</Typography>
              <StatusChip status={event.status} />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {event.reference} · {event.eventTypeName} · {event.location}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" startIcon={<MailOutlineRoundedIcon />} onClick={() => { setSendTo(event.contactEmail ?? ''); setSendOpen(true); }}>Email to contact</Button>
            {canManage && !closed && (
              <>
                {paid ? (
                  <>
                    <Button variant="outlined" startIcon={<EditRoundedIcon />} onClick={openDetails}>Edit details</Button>
                    <Button variant="outlined" startIcon={<AddCircleOutlineRoundedIcon />} onClick={() => setAddOnsOpen(true)}>Add-ons</Button>
                  </>
                ) : (
                  <Button variant="outlined" startIcon={<EditRoundedIcon />} onClick={() => navigate(`/business/events/${event.id}/edit`)}>Edit</Button>
                )}
                {event.balance > 0 && <Button variant="contained" startIcon={<PaymentsRoundedIcon />} onClick={() => { setPay({ amount: String(event.balance), method: 'TRANSFER', reference: '', notes: '' }); setPayOpen(true); }}>Record payment</Button>}
              </>
            )}
          </Stack>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
        {event.roomsReleasedAt && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {event.roomsReleased
              ? `${event.roomsReleased} unoccupied room${event.roomsReleased === 1 ? ' was' : 's were'} released automatically on ${fmtDate(event.roomsReleasedAt)}.`
              : `The event ended; no unoccupied rooms needed releasing (${fmtDate(event.roomsReleasedAt)}).`}
          </Alert>
        )}
        {event.status === 'CANCELLED' && event.cancelReason && <Alert severity="warning" sx={{ mb: 2 }}>Cancelled: {event.cancelReason}</Alert>}

        {canManage && NEXT[event.status].length > 0 && (
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>Status:</Typography>
              {NEXT[event.status].map((s) => {
                // An event is completed only once it is paid in full.
                const unpaid = s === 'COMPLETED' && event.balance > 0;
                const button = (
                  <Button key={s} size="small" variant={s === 'CONFIRMED' ? 'contained' : 'outlined'} color={s === 'CANCELLED' ? 'error' : 'primary'} disabled={busy || unpaid}
                    onClick={() => (s === 'CANCELLED' ? (setReason(''), setCancelOpen(true)) : void move(s))}>
                    {ACTION_LABEL[s]}
                  </Button>
                );
                return unpaid ? (
                  <Tooltip key={s} title={`Record the outstanding ${formatCurrency(event.balance)} before completing this event`}>
                    <span>{button}</span>
                  </Tooltip>
                ) : button;
              })}
            </Stack>
          </Paper>
        )}

        <Grid container spacing={2.5}>
          <Grid item xs={12} md={5}>
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography fontWeight={800} sx={{ mb: 1 }}>Event</Typography>
                <Info label="Starts" value={fmt(event.startAt)} />
                <Info label="Ends" value={fmt(event.endAt)} />
                <Info label="Duration" value={`${event.days} day${event.days === 1 ? '' : 's'}`} />
                <Info label="Expected guests" value={String(event.expectedGuests)} />
                <Info label="Location" value={event.location} />
                {event.specialRequirements && <Info label="Requirements" value={event.specialRequirements} />}
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                  {dates.slice(0, 31).map((d) => <Chip key={d.toISOString()} size="small" variant="outlined" label={d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} />)}
                  {dates.length > 31 && <Chip size="small" label={`+${dates.length - 31} more days`} />}
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography fontWeight={800} sx={{ mb: 1 }}>Contact person</Typography>
                <Info label="Name" value={event.contactName} />
                <Info label="Phone" value={event.contactPhone} />
                {event.contactEmail && <Info label="Email" value={event.contactEmail} />}
                {event.organization && <Info label="Organisation" value={event.organization} />}
                {event.billingAddress && <Info label="Billing address" value={event.billingAddress} />}
              </Paper>

              {event.rooms.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                  <Typography fontWeight={800} sx={{ mb: 1 }}>Rooms</Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>Reservations linked to this event. Room charges are on this invoice.</Typography>
                  {event.rooms.map((r) => (
                    <Stack key={r.id} direction="row" justifyContent="space-between" sx={{ py: 0.5, cursor: 'pointer' }} onClick={() => navigate(`/business/reservations/${r.id}`)}>
                      <Typography variant="body2">{r.bookingNumber} · {r.room?.roomNumber ? `Room ${r.room.roomNumber}` : roomTypeName(r.requestedRoomType)}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.status.replace('_', ' ').toLowerCase()}</Typography>
                    </Stack>
                  ))}
                </Paper>
              )}

              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography fontWeight={800} sx={{ mb: 1 }}>Payments</Typography>
                {event.payments.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No payments yet.</Typography>
                ) : (
                  event.payments.map((p) => (
                    <Stack key={p.id} direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
                      <Box>
                        <Typography variant="body2">{p.method.toLowerCase()}{p.reference ? ` · ${p.reference}` : ''}</Typography>
                        <Typography variant="caption" color="text.secondary">{fmtDate(p.createdAt)}{p.receivedByName ? ` · ${p.receivedByName}` : ''}</Typography>
                      </Box>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography variant="body2" fontWeight={700}>{formatCurrency(p.amount)}</Typography>
                        <Tooltip title="Print receipt">
                          <IconButton size="small" aria-label="Print receipt" onClick={() => void receiptApi.forEventPayment(p.id).then((r) => printReceipt(r)).catch((err) => setError(getApiErrorMessage(err, 'Could not print the receipt')))}>
                            <ReceiptLongRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  ))
                )}
              </Paper>
            </Stack>
          </Grid>

          <Grid item xs={12} md={7}>
            {/* The server's PDF: exactly what the contact receives by email. */}
            <ServerPdfPreview path={`/events/${event.id}/pdf`} version={`${event.status}-${event.total}-${event.paidAmount}-${event.updatedAt ?? ''}`} />
          </Grid>
        </Grid>

        <Dialog open={sendOpen} onClose={() => !busy && setSendOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Email the {['DRAFT', 'PENDING', 'QUOTATION_SENT'].includes(event.status) ? 'quote' : 'invoice'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField autoFocus fullWidth type="email" label="Send to" value={sendTo} onChange={(e) => setSendTo(e.target.value)} />
              <TextField fullWidth multiline minRows={2} label="Message (optional)" value={sendNote} onChange={(e) => setSendNote(e.target.value)} />
              <Alert severity="info">The PDF shown on this page is attached.</Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSendOpen(false)} disabled={busy}>Cancel</Button>
            <Button
              variant="contained"
              disabled={busy || !/^\S+@\S+\.\S+$/.test(sendTo.trim())}
              onClick={async () => {
                setBusy(true);
                try {
                  await eventsApi.send(event.id, { to: sendTo.trim(), message: sendNote.trim() || undefined });
                  setSendOpen(false);
                  setSendNote('');
                  setNotice(`Sent to ${sendTo.trim()}`);
                } catch (err) {
                  setError(getApiErrorMessage(err, 'Could not send the email'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Send
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={cancelOpen} onClose={() => !busy && setCancelOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Cancel {event.reference}</DialogTitle>
          <DialogContent>
            <TextField autoFocus fullWidth label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} multiline minRows={2} sx={{ mt: 1 }} />
            {event.rooms.length > 0 && <Alert severity="info" sx={{ mt: 1.5 }}>Its rooms that are not checked in are released too.</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCancelOpen(false)} disabled={busy}>Keep it</Button>
            <Button color="error" variant="contained" disabled={busy || !reason.trim()} onClick={() => void move('CANCELLED', reason.trim())}>Cancel event</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={payOpen} onClose={() => !busy && setPayOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Record payment</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField fullWidth type="number" label="Amount" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} helperText={`Outstanding ${formatCurrency(event.balance)}`} />
              <TextField select fullWidth label="Method" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                {['CASH', 'CARD', 'TRANSFER', 'POS', 'CHEQUE', 'OTHER'].map((m) => <MenuItem key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</MenuItem>)}
              </TextField>
              <TextField fullWidth label="Reference" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
              <TextField fullWidth label="Notes" value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPayOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="contained" disabled={busy || !(Number(pay.amount) > 0)} onClick={() => void recordPayment()}>Record</Button>
          </DialogActions>
        </Dialog>
        <AddOnsDialog open={addOnsOpen} event={event} canPrice={canPrice} onClose={() => setAddOnsOpen(false)} onDone={() => { setAddOnsOpen(false); void load(); }} />

        <Dialog open={detailsOpen} onClose={() => !busy && setDetailsOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Edit details</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Contact person" value={details.contactName} onChange={(e) => setDetails({ ...details, contactName: e.target.value })} />
              <TextField label="Phone" value={details.contactPhone} onChange={(e) => setDetails({ ...details, contactPhone: e.target.value })} />
              <TextField label="Email" value={details.contactEmail} onChange={(e) => setDetails({ ...details, contactEmail: e.target.value })} />
              <TextField label="Organisation" value={details.organization} onChange={(e) => setDetails({ ...details, organization: e.target.value })} />
              <TextField label="Billing address" value={details.billingAddress} onChange={(e) => setDetails({ ...details, billingAddress: e.target.value })} />
              <TextField label="Special requirements" multiline minRows={2} value={details.specialRequirements} onChange={(e) => setDetails({ ...details, specialRequirements: e.target.value })} />
              <TextField label="Terms and conditions" multiline minRows={2} value={details.terms} onChange={(e) => setDetails({ ...details, terms: e.target.value })} />
              <Typography variant="caption" color="text.secondary">Prices, dates, catering and rooms are fixed after payment — use Add-ons to change them.</Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailsOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="contained" onClick={() => void saveDetails()} disabled={busy}>Save</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Stack direction="row" spacing={2} sx={{ py: 0.4 }}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>{label}</Typography>
    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{value}</Typography>
  </Stack>
);

export default EventDetailPage;
