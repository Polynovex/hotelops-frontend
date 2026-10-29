import React, { useCallback, useEffect, useState } from 'react';
import DocumentSheet from '../../../components/documents/DocumentSheet';
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
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
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
import { printElement } from '../../../utils/printElement';

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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = usePermissionStore((state) => state.can);
  const canManage = can('MANAGE_EVENTS');
  const canPrice = can('EVENT_PRICING');

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState('');
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
  const booked = event.lines.filter((line) => !line.addOn);
  const addOns = event.lines.filter((line) => line.addOn);
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
  const hotel = event.hotel;

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
            <Button variant="outlined" startIcon={<PrintRoundedIcon />} onClick={() => printElement('event-invoice', `${event.reference} — ${event.eventName}`, { keepColors: true })}>Print invoice</Button>
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
                      <Typography variant="body2">{r.bookingNumber} · {r.room?.roomNumber ? `Room ${r.room.roomNumber}` : r.requestedRoomType}</Typography>
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
                      <Typography variant="body2" fontWeight={700}>{formatCurrency(p.amount)}</Typography>
                    </Stack>
                  ))
                )}
              </Paper>
            </Stack>
          </Grid>

          <Grid item xs={12} md={7}>
            {(() => {
              const quoting = event.status === 'DRAFT' || event.status === 'PENDING' || event.status === 'QUOTATION_SENT';
              const paid = event.balance <= 0 && event.total > 0;
              const inv = hotel?.invoice ?? {};
              const lines = [...booked, ...(addOns.length ? [null] : []), ...addOns];
              return (
                <DocumentSheet
                  id="event-invoice"
                  title={quoting ? 'QUOTATION' : paid ? 'INVOICE' : 'PROFORMA'}
                  subtitle={!quoting && !paid ? 'INVOICE' : undefined}
                  stamp={event.status === 'CANCELLED' ? 'VOID' : paid && !quoting ? 'PAID' : null}
                  brand={{
                    name: hotel?.displayName ?? '',
                    logoUrl: hotel?.logoUrl,
                    tagline: inv.tagline,
                    address: hotel?.address,
                    phone: hotel?.phone,
                    email: inv.contactEmail || hotel?.email,
                    website: inv.website
                  }}
                  meta={[
                    ['Date', fmtDate(event.createdAt)],
                    [quoting ? 'Quotation No' : 'Invoice No', event.reference],
                    ['Event date', new Date(event.startAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })]
                  ]}
                  billTo={{
                    heading: quoting ? 'Quotation to' : 'Invoice to',
                    name: event.organization || event.contactName,
                    lines: [
                      event.organization ? `Attn: ${event.contactName}` : null,
                      event.contactPhone ? `Phone: ${event.contactPhone}` : null,
                      event.contactEmail ? `Email: ${event.contactEmail}` : null,
                      event.billingAddress ? `Address: ${event.billingAddress}` : null
                    ]
                  }}
                  extra={{
                    heading: 'Event',
                    lines: [
                      event.eventName,
                      `${event.eventTypeName} · ${event.location}`,
                      `${fmt(event.startAt)} → ${fmt(event.endAt)} (${event.days} day${event.days === 1 ? '' : 's'})`,
                      `${event.expectedGuests} expected guests`
                    ]
                  }}
                  payment={
                    inv.accountNumber
                      ? ([['Account No', inv.accountNumber], ['Account Name', inv.accountName ?? ''], ['Bank Name', inv.bankName ?? '']] as Array<[string, string]>).filter(([, v]) => v)
                      : null
                  }
                  rows={lines.map((line) =>
                    line === null
                      ? { section: 'Add-ons after payment', description: '', price: null, qty: '', amount: 0 }
                      : {
                          description: line.description,
                          details:
                            line.type === 'CATERING' && line.serviceDate
                              ? `${new Date(line.serviceDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}${line.serviceTime ? ` · ${line.serviceTime}` : ''}${line.notes ? ` · ${line.notes}` : ''}`
                              : line.type === 'CORKAGE' ? line.notes : null,
                          price: line.unitPrice,
                          qty: line.type === 'CATERING' ? `${line.quantity} guests` : line.quantity,
                          amount: line.amount
                        }
                  )}
                  totals={[
                    ...(event.originalTotal != null
                      ? [{ label: 'Booked total', value: event.originalTotal }, { label: 'Add-ons', value: event.total - event.originalTotal }]
                      : []),
                    { label: 'Sub-total', value: event.subtotal },
                    ...(event.discount > 0 ? [{ label: event.promotion ? `Discount (${event.promotion.name})` : 'Discount', value: -event.discount }] : []),
                    ...(event.serviceCharge > 0 ? [{ label: `Service charge (${event.eventType.serviceChargeRate}%)`, value: event.serviceCharge }] : []),
                    ...(event.tax > 0 ? [{ label: `VAT (${hotel?.vatRate ?? 0}%)`, value: event.tax }] : []),
                    { label: 'Total', value: event.total },
                    { label: 'Amt Paid', value: event.paidAmount }
                  ]}
                  due={{ label: 'Balance', value: event.balance }}
                  notes={quoting ? 'Please note our prices are subject to change until this quotation is confirmed.' : null}
                  terms={event.terms}
                  signature={inv.signatoryName ? { name: inv.signatoryName, title: inv.signatoryTitle } : null}
                />
              );
            })()}
          </Grid>
        </Grid>

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
