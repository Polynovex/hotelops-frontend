import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import Layout from '../../../components/Layout';
import { usePermissionStore } from '../../../store/permissionStore';
import { roomOpsService } from '../../../services/operations';
import {
  CATERING_LABEL,
  eventsApi,
  type BanquetMenuItem,
  type CateringService,
  type EventInput,
  type EventQuote,
  type EventType
} from '../../../services/events';
import { promotionsApi, type PromotionRecord } from '../../../services/promotions';
import { formatCurrency } from '../../../utils/formatters';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * Create New Event / edit an event. Sections follow the event booking
 * structure: A contact person, B event details, C catering, D corkage,
 * E accommodation, F promotions. The quote on the right is the server's
 * price, recalculated as the form changes.
 */

type CateringRow = {
  key: string;
  service: CateringService;
  menuItemId: string;
  description: string;
  serviceDate: string;
  serviceTime: string;
  people: string;
  unitPrice: string;
  notes: string;
};

type FormState = {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  organization: string;
  billingAddress: string;
  eventName: string;
  eventTypeId: string;
  newLocation: string;
  expectedGuests: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  specialRequirements: string;
  venuePrice: string;
  catering: CateringRow[];
  outsideFoodAllowed: boolean;
  corkageOn: boolean;
  corkageDescription: string;
  corkageAmount: string;
  corkageQuantity: string;
  corkageNotes: string;
  withRooms: boolean;
  roomTypeCode: string;
  rooms: string;
  roomGuests: string;
  checkIn: string;
  checkOut: string;
  roomRate: string;
  promotionId: string;
  promotionCode: string;
  manualDiscount: string;
  terms: string;
};

/** The server's line labels, to read a saved catering line back into the form. */
const SERVER_LABEL: Array<[string, CateringService]> = [
  ['Tea break', 'TEA_BREAK'],
  ['Breakfast', 'BREAKFAST'],
  ['Lunch', 'LUNCH'],
  ['Dinner', 'DINNER'],
  ['Snacks and refreshments', 'SNACKS'],
  ['Drinks and beverages', 'DRINKS'],
  ['Catering', 'CUSTOM']
];

/** Which banquet menu categories belong to each service. */
const CATEGORY_MATCH: Record<CateringService, RegExp> = {
  TEA_BREAK: /tea|break|snack|refresh/i,
  BREAKFAST: /breakfast/i,
  LUNCH: /lunch/i,
  DINNER: /dinner|supper/i,
  SNACKS: /snack|refresh|small chops|finger/i,
  DRINKS: /drink|beverage|bar|wine|juice/i,
  CUSTOM: /./
};

const today = () => new Date().toISOString().slice(0, 10);
const cateringComplete = (row: { menuItemId: string; unitPrice: string }) => Boolean(row.menuItemId) || row.unitPrice.trim() !== '';
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const combine = (date: string, time: string) => (date ? new Date(`${date}T${time || '00:00'}`) : null);
const key = () => Math.random().toString(36).slice(2);
const n = (value: string) => (value.trim() === '' ? null : Number(value));

const blank = (): FormState => ({
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  organization: '',
  billingAddress: '',
  eventName: '',
  eventTypeId: '',
  newLocation: '',
  expectedGuests: '',
  startDate: today(),
  startTime: '10:00',
  endDate: today(),
  endTime: '18:00',
  specialRequirements: '',
  venuePrice: '',
  catering: [],
  outsideFoodAllowed: false,
  corkageOn: false,
  corkageDescription: 'Corkage fee',
  corkageAmount: '',
  corkageQuantity: '1',
  corkageNotes: '',
  withRooms: false,
  roomTypeCode: '',
  rooms: '1',
  roomGuests: '1',
  checkIn: today(),
  checkOut: today(),
  roomRate: '',
  promotionId: '',
  promotionCode: '',
  manualDiscount: '',
  terms: ''
});

const Section: React.FC<{ letter: string; title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }> = ({ letter, title, hint, children, action }) => (
  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
      <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
        {letter}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography fontWeight={800}>{title}</Typography>
        {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
      </Box>
      {action}
    </Stack>
    {children}
  </Paper>
);

const EventFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const can = usePermissionStore((state) => state.can);
  const canPrice = can('EVENT_PRICING');

  const [form, setForm] = useState<FormState>(blank);
  const [types, setTypes] = useState<EventType[]>([]);
  const [menu, setMenu] = useState<BanquetMenuItem[]>([]);
  const [fromBanquetOutlet, setFromBanquetOutlet] = useState(true);
  const [roomTypes, setRoomTypes] = useState<Array<{ code: string; name: string; baseRate: number }>>([]);
  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);
  const [quote, setQuote] = useState<EventQuote | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const [loading, setLoading] = useState(editing);
  const savedPromotion = useRef<string | null>(null);
  const venueTouched = useRef(false);

  const set = <K extends keyof FormState>(k: K, value: FormState[K]) => setForm((f) => ({ ...f, [k]: value }));
  const type = types.find((t) => t.id === form.eventTypeId);

  useEffect(() => {
    eventsApi.listTypes().then(setTypes).catch(() => setTypes([]));
    eventsApi.menu().then((m) => { setMenu(m.items); setFromBanquetOutlet(m.fromBanquetOutlet); }).catch(() => setMenu([]));
    roomOpsService.listRoomTypes().then((rows) => setRoomTypes(rows.filter((r) => r.isActive))).catch(() => setRoomTypes([]));
    promotionsApi.list({ kind: 'EVENT' }).then((rows) => setPromotions(rows.filter((p) => p.effectiveStatus === 'ACTIVE'))).catch(() => setPromotions([]));
  }, []);

  // Editing: read the saved booking back into the form.
  useEffect(() => {
    if (!id) return;
    eventsApi
      .get(id)
      .then((e) => {
        const start = new Date(e.startAt);
        const end = new Date(e.endAt);
        const venue = e.lines.find((l) => l.type === 'VENUE');
        const corkage = e.lines.find((l) => l.type === 'CORKAGE');
        savedPromotion.current = e.promotionId;
        setForm({
          ...blank(),
          contactName: e.contactName,
          contactPhone: e.contactPhone,
          contactEmail: e.contactEmail ?? '',
          organization: e.organization ?? '',
          billingAddress: e.billingAddress ?? '',
          eventName: e.eventName,
          eventTypeId: e.eventTypeId,
          newLocation: e.eventType.moveable && e.location !== e.eventType.location ? e.location : '',
          expectedGuests: String(e.expectedGuests),
          startDate: ymd(start),
          startTime: hm(start),
          endDate: ymd(end),
          endTime: hm(end),
          specialRequirements: e.specialRequirements ?? '',
          venuePrice: venue ? String(venue.amount) : '',
          catering: e.lines
            .filter((l) => l.type === 'CATERING')
            .map((l) => {
              const [label, ...rest] = l.description.split(' — ');
              const service = SERVER_LABEL.find(([text]) => text === label)?.[1] ?? 'CUSTOM';
              return {
                key: key(),
                service,
                menuItemId: l.menuItemId ?? '',
                description: l.menuItemId ? '' : rest.join(' — '),
                serviceDate: l.serviceDate ? ymd(new Date(l.serviceDate)) : ymd(start),
                serviceTime: l.serviceTime ?? '',
                people: String(l.quantity),
                unitPrice: String(l.unitPrice),
                notes: l.notes ?? ''
              };
            }),
          outsideFoodAllowed: e.outsideFoodAllowed,
          corkageOn: Boolean(corkage),
          corkageDescription: corkage?.description ?? 'Corkage fee',
          corkageAmount: corkage ? String(corkage.unitPrice) : '',
          corkageQuantity: corkage ? String(corkage.quantity) : '1',
          corkageNotes: corkage?.notes ?? '',
          withRooms: Boolean(e.accommodation),
          roomTypeCode: e.accommodation?.roomTypeCode ?? '',
          rooms: String(e.accommodation?.rooms ?? 1),
          roomGuests: String(e.accommodation?.guests ?? 1),
          checkIn: e.accommodation ? ymd(new Date(e.accommodation.checkIn)) : ymd(start),
          checkOut: e.accommodation ? ymd(new Date(e.accommodation.checkOut)) : ymd(end),
          roomRate: e.accommodation?.rate != null ? String(e.accommodation.rate) : '',
          promotionId: e.promotionId ?? '',
          manualDiscount: (e as unknown as { manualDiscount?: number }).manualDiscount ? String((e as unknown as { manualDiscount: number }).manualDiscount) : '',
          terms: e.terms ?? ''
        });
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Could not load the event')))
      .finally(() => setLoading(false));
  }, [id]);

  const start = combine(form.startDate, form.startTime);
  const end = combine(form.endDate, form.endTime);
  const durationText = useMemo(() => {
    if (!start || !end || end <= start) return '';
    const days = Math.round((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86_400_000) + 1;
    const hours = Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 10) / 10;
    return days > 1 ? `${days} days` : `${hours} hour${hours === 1 ? '' : 's'}`;
  }, [start, end, form.startDate, form.endDate]);

  const eventDays = useMemo(() => {
    const out: string[] = [];
    if (!form.startDate || !form.endDate) return out;
    for (let d = new Date(`${form.startDate}T00:00`); ymd(d) <= form.endDate && out.length < 400; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) out.push(ymd(d));
    return out;
  }, [form.startDate, form.endDate]);

  /** The request body, built the same way for the quote and for saving. */
  const payload = (): EventInput | null => {
    if (!form.eventTypeId || !start || !end) return null;
    const venuePrice = canPrice && venueTouched.current && form.venuePrice.trim() !== '' ? Number(form.venuePrice) : undefined;
    return {
      contactName: form.contactName.trim(),
      contactPhone: form.contactPhone.trim(),
      contactEmail: form.contactEmail.trim() || null,
      organization: form.organization.trim() || null,
      billingAddress: form.billingAddress.trim() || null,
      eventName: form.eventName.trim(),
      eventTypeId: form.eventTypeId,
      location: type?.moveable && form.newLocation.trim() ? form.newLocation.trim() : null,
      expectedGuests: Number(form.expectedGuests) || 1,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      specialRequirements: form.specialRequirements.trim() || null,
      ...(venuePrice !== undefined ? { venuePrice } : {}),
      // A line is priced once it has a dish, or (custom) a price.
      catering: form.catering.filter(cateringComplete).map((row) => ({
        service: row.service,
        menuItemId: row.menuItemId || null,
        description: row.description.trim() || null,
        serviceDate: (combine(row.serviceDate, row.serviceTime || '12:00') ?? start).toISOString(),
        serviceTime: row.serviceTime || null,
        people: Number(row.people) || 1,
        unitPrice: n(row.unitPrice),
        notes: row.notes.trim() || null
      })),
      outsideFoodAllowed: form.outsideFoodAllowed,
      corkage:
        form.outsideFoodAllowed && form.corkageOn && Number(form.corkageAmount) > 0
          ? { description: form.corkageDescription.trim() || null, amount: Number(form.corkageAmount), quantity: Number(form.corkageQuantity) || 1, notes: form.corkageNotes.trim() || null }
          : null,
      accommodation:
        form.withRooms && form.roomTypeCode
          ? {
              roomTypeCode: form.roomTypeCode,
              rooms: Number(form.rooms) || 1,
              guests: Number(form.roomGuests) || 1,
              checkIn: new Date(`${form.checkIn}T14:00`).toISOString(),
              checkOut: new Date(`${form.checkOut}T12:00`).toISOString(),
              rate: n(form.roomRate)
            }
          : null,
      ...(form.promotionId !== (savedPromotion.current ?? '') || !editing ? { promotionId: form.promotionId || null } : {}),
      ...(form.promotionCode.trim() ? { promotionCode: form.promotionCode.trim() } : {}),
      manualDiscount: n(form.manualDiscount),
      terms: form.terms.trim() || null
    };
  };

  const ready =
    form.contactName.trim().length >= 2 && form.contactPhone.trim().length >= 7 && form.eventName.trim().length >= 2 && Boolean(form.eventTypeId) && Boolean(start && end && end > start);

  // Live quote.
  useEffect(() => {
    if (!ready || loading) {
      setQuote(null);
      return;
    }
    const body = payload();
    if (!body) return;
    const timer = window.setTimeout(() => {
      setQuoting(true);
      eventsApi
        .quote(body, id)
        .then((q) => { setQuote(q); setQuoteError(''); })
        .catch((err) => { setQuote(null); setQuoteError(getApiErrorMessage(err, 'Could not price this event')); })
        .finally(() => setQuoting(false));
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, ready, loading]);

  const menuFor = (service: CateringService) => {
    const matched = menu.filter((m) => CATEGORY_MATCH[service].test(m.category));
    return matched.length ? matched : menu;
  };

  const addCatering = (service: CateringService = 'LUNCH') =>
    set('catering', [
      ...form.catering,
      { key: key(), service, menuItemId: '', description: '', serviceDate: form.startDate, serviceTime: service === 'BREAKFAST' ? '08:00' : service === 'DINNER' ? '19:00' : service === 'TEA_BREAK' ? '11:00' : '13:00', people: form.expectedGuests || '1', unitPrice: '', notes: '' }
    ]);
  const updateCatering = (k: string, patch: Partial<CateringRow>) =>
    set('catering', form.catering.map((row) => (row.key === k ? { ...row, ...patch } : row)));
  /** Copies one catering line to every other day of the event. */
  const repeatDaily = (row: CateringRow) => {
    const have = new Set(form.catering.filter((r) => r.service === row.service && r.menuItemId === row.menuItemId).map((r) => r.serviceDate));
    set('catering', [...form.catering, ...eventDays.filter((d) => !have.has(d)).map((d) => ({ ...row, key: key(), serviceDate: d }))]);
  };

  const save = async (status?: EventInput['status']) => {
    const body = payload();
    if (!ready || !body) {
      setError('Fill in the contact person, event name, event type and valid dates.');
      return;
    }
    if (form.catering.some((row) => !cateringComplete(row))) {
      setError('Each catering line needs a menu item (or, for custom catering, a price). Remove the lines you do not need.');
      return;
    }
    setSaving(status ?? 'SAVE');
    setError('');
    try {
      const saved = editing ? await eventsApi.update(id!, body) : await eventsApi.create({ ...body, status });
      navigate(`/business/events/${saved.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the event'));
    } finally {
      setSaving('');
    }
  };

  if (loading) {
    return (
      <Layout>
        <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }}><CircularProgress /></Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4" fontWeight={800}>{editing ? 'Edit event' : 'Create new event'}</Typography>
          <Typography variant="body2" color="text.secondary">
            Only the venue is required. Rooms, catering and corkage are optional and appear on the invoice only when added.
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        <Grid container spacing={2.5}>
          <Grid item xs={12} lg={8}>
            <Stack spacing={2}>
              <Section letter="A" title="Contact person" hint="The person responsible for the booking. They do not need to stay at the hotel.">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Contact person name" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} required /></Grid>
                  <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Phone number" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} required /></Grid>
                  <Grid item xs={12} md={6}><TextField fullWidth size="small" type="email" label="Email address" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} /></Grid>
                  <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Organisation / company" value={form.organization} onChange={(e) => set('organization', e.target.value)} /></Grid>
                  <Grid item xs={12}><TextField fullWidth size="small" label="Billing address" value={form.billingAddress} onChange={(e) => set('billingAddress', e.target.value)} /></Grid>
                </Grid>
              </Section>

              <Section letter="B" title="Event details">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Event name" placeholder="Adeyemi–Okafor wedding" value={form.eventName} onChange={(e) => set('eventName', e.target.value)} required /></Grid>
                  <Grid item xs={12} md={6}>
                    <TextField select fullWidth size="small" label="Event type" value={form.eventTypeId} onChange={(e) => { venueTouched.current = false; setForm((f) => ({ ...f, eventTypeId: e.target.value, newLocation: '', venuePrice: '' })); }} required
                      helperText={types.length === 0 ? 'No event types yet — ask a manager to set them up.' : type ? `${type.location}${type.capacity ? ` · holds ${type.capacity}` : ''} · ${formatCurrency(type.price)} ${type.pricingUnit === 'PER_DAY' ? 'per day' : 'per event'}` : undefined}>
                      {types.filter((t) => t.isActive || t.id === form.eventTypeId).map((t) => <MenuItem key={t.id} value={t.id}>{t.name} — {t.location}</MenuItem>)}
                    </TextField>
                  </Grid>
                  {type?.moveable && (
                    <Grid item xs={12}>
                      <TextField fullWidth size="small" label="New location" placeholder={type.location} value={form.newLocation} onChange={(e) => set('newLocation', e.target.value)}
                        helperText="This event type can be moved. Leave blank to use its usual location; price and setup stay the same." />
                    </Grid>
                  )}
                  <Grid item xs={6} md={4}><TextField fullWidth size="small" type="number" label="Expected guests" value={form.expectedGuests} onChange={(e) => set('expectedGuests', e.target.value)} required /></Grid>
                  <Grid item xs={6} md={8}>
                    <Typography variant="caption" color="text.secondary">Duration</Typography>
                    <Typography fontWeight={700}>{durationText || '—'}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}><TextField fullWidth size="small" type="date" label="Start date" InputLabelProps={{ shrink: true }} value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate }))} /></Grid>
                  <Grid item xs={6} md={3}><TextField fullWidth size="small" type="time" label="Start time" InputLabelProps={{ shrink: true }} value={form.startTime} onChange={(e) => set('startTime', e.target.value)} /></Grid>
                  <Grid item xs={6} md={3}><TextField fullWidth size="small" type="date" label="End date" InputLabelProps={{ shrink: true }} inputProps={{ min: form.startDate }} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} /></Grid>
                  <Grid item xs={6} md={3}><TextField fullWidth size="small" type="time" label="End time" InputLabelProps={{ shrink: true }} value={form.endTime} onChange={(e) => set('endTime', e.target.value)} /></Grid>
                  {start && end && end <= start && <Grid item xs={12}><Alert severity="warning">The event must end after it starts.</Alert></Grid>}
                  <Grid item xs={12}><TextField fullWidth size="small" label="Special requirements" value={form.specialRequirements} onChange={(e) => set('specialRequirements', e.target.value)} multiline minRows={2} /></Grid>
                  {canPrice && type && (
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth size="small" type="number" label="Venue price for this booking" value={form.venuePrice} placeholder="Listed price"
                        onChange={(e) => { venueTouched.current = true; set('venuePrice', e.target.value); }}
                        helperText="Leave blank to charge the event type's price. Changes are recorded in the audit trail." />
                    </Grid>
                  )}
                </Grid>
              </Section>

              <Section letter="C" title="Catering" hint={fromBanquetOutlet ? 'Dishes come from the banquet menu. For multi-day events add each day, or use “repeat every day”.' : 'No Banquet outlet yet, so every menu is shown. Create an outlet of type Banquet to keep event dishes separate.'}
                action={<Button size="small" startIcon={<AddRoundedIcon />} onClick={() => addCatering()}>Add</Button>}>
                {form.catering.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No catering — the customer is booking the venue only.</Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {form.catering.map((row) => {
                      const dish = menu.find((m) => m.id === row.menuItemId);
                      const custom = row.service === 'CUSTOM' || !row.menuItemId;
                      return (
                        <Paper key={row.key} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                          <Grid container spacing={1.5} alignItems="center">
                            <Grid item xs={6} md={3}>
                              <TextField select fullWidth size="small" label="Service" value={row.service} onChange={(e) => updateCatering(row.key, { service: e.target.value as CateringService, menuItemId: '' })}>
                                {(Object.keys(CATERING_LABEL) as CateringService[]).map((s) => <MenuItem key={s} value={s}>{CATERING_LABEL[s]}</MenuItem>)}
                              </TextField>
                            </Grid>
                            <Grid item xs={6} md={5}>
                              {row.service === 'CUSTOM' ? (
                                <TextField fullWidth size="small" label="What is being served" value={row.description} onChange={(e) => updateCatering(row.key, { description: e.target.value })} />
                              ) : (
                                <TextField select fullWidth size="small" label="Menu / package" value={row.menuItemId} onChange={(e) => updateCatering(row.key, { menuItemId: e.target.value, unitPrice: '' })}>
                                  {menuFor(row.service).map((m) => <MenuItem key={m.id} value={m.id}>{m.name} · {formatCurrency(m.price)}</MenuItem>)}
                                </TextField>
                              )}
                            </Grid>
                            <Grid item xs={6} md={2}>
                              <TextField select fullWidth size="small" label="Day" value={row.serviceDate} onChange={(e) => updateCatering(row.key, { serviceDate: e.target.value })}>
                                {[...new Set([...eventDays, row.serviceDate])].map((d) => <MenuItem key={d} value={d}>{new Date(`${d}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</MenuItem>)}
                              </TextField>
                            </Grid>
                            <Grid item xs={6} md={2}><TextField fullWidth size="small" type="time" label="Time" InputLabelProps={{ shrink: true }} value={row.serviceTime} onChange={(e) => updateCatering(row.key, { serviceTime: e.target.value })} /></Grid>
                            <Grid item xs={4} md={2}><TextField fullWidth size="small" type="number" label="People" value={row.people} onChange={(e) => updateCatering(row.key, { people: e.target.value })} /></Grid>
                            <Grid item xs={8} md={3}>
                              <TextField fullWidth size="small" type="number" label="Price per person" value={row.unitPrice} placeholder={dish ? String(dish.price) : ''}
                                onChange={(e) => updateCatering(row.key, { unitPrice: e.target.value })}
                                disabled={!canPrice && !custom}
                                helperText={!canPrice ? (custom ? 'A custom price needs a manager' : 'Menu price') : dish ? 'Blank = menu price' : undefined} />
                            </Grid>
                            <Grid item xs={9} md={5}><TextField fullWidth size="small" label="Special instructions" value={row.notes} onChange={(e) => updateCatering(row.key, { notes: e.target.value })} /></Grid>
                            <Grid item xs={3} md={2} sx={{ textAlign: 'right' }}>
                              {eventDays.length > 1 && (
                                <Tooltip title="Repeat every day of the event"><IconButton size="small" onClick={() => repeatDaily(row)}><ContentCopyRoundedIcon fontSize="small" /></IconButton></Tooltip>
                              )}
                              <Tooltip title="Remove"><IconButton size="small" onClick={() => set('catering', form.catering.filter((r) => r.key !== row.key))}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip>
                            </Grid>
                          </Grid>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Section>

              <Section letter="D" title="Corkage" hint="A charge when the customer brings their own food or drinks.">
                <Stack spacing={1.5}>
                  <FormControlLabel control={<Switch checked={form.outsideFoodAllowed} onChange={(e) => set('outsideFoodAllowed', e.target.checked)} />} label="Outside food or beverages allowed" />
                  {form.outsideFoodAllowed && (
                    canPrice ? (
                      <>
                        <FormControlLabel control={<Switch checked={form.corkageOn} onChange={(e) => set('corkageOn', e.target.checked)} />} label="Charge corkage" />
                        {form.corkageOn && (
                          <Grid container spacing={2}>
                            <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Corkage description" value={form.corkageDescription} onChange={(e) => set('corkageDescription', e.target.value)} /></Grid>
                            <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Amount" value={form.corkageAmount} onChange={(e) => set('corkageAmount', e.target.value)} /></Grid>
                            <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Quantity" value={form.corkageQuantity} onChange={(e) => set('corkageQuantity', e.target.value)} helperText="Optional" /></Grid>
                            <Grid item xs={12}><TextField fullWidth size="small" label="Notes / terms" value={form.corkageNotes} onChange={(e) => set('corkageNotes', e.target.value)} /></Grid>
                          </Grid>
                        )}
                      </>
                    ) : (
                      <Alert severity="info">A manager enters the corkage amount. Save the booking and ask them to add it.</Alert>
                    )
                  )}
                </Stack>
              </Section>

              <Section letter="E" title="Accommodation" hint="Rooms are optional and checked separately from the venue. Room promotions do not apply here.">
                <Stack spacing={2}>
                  <ToggleButtonGroup exclusive size="small" value={form.withRooms ? 'rooms' : 'venue'} onChange={(_e, v) => v && setForm((f) => ({ ...f, withRooms: v === 'rooms', checkIn: f.startDate, checkOut: f.endDate > f.startDate ? f.endDate : ymd(new Date(new Date(`${f.startDate}T00:00`).getTime() + 86_400_000)) }))}>
                    <ToggleButton value="venue">Venue only</ToggleButton>
                    <ToggleButton value="rooms">Venue + accommodation</ToggleButton>
                  </ToggleButtonGroup>
                  {form.withRooms && (
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField select fullWidth size="small" label="Room type" value={form.roomTypeCode} onChange={(e) => set('roomTypeCode', e.target.value)}>
                          {roomTypes.map((r) => <MenuItem key={r.code} value={r.code}>{r.name}{r.baseRate ? ` · ${formatCurrency(r.baseRate)}` : ''}</MenuItem>)}
                        </TextField>
                      </Grid>
                      <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Number of rooms" value={form.rooms} onChange={(e) => set('rooms', e.target.value)} /></Grid>
                      <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Guests staying" value={form.roomGuests} onChange={(e) => set('roomGuests', e.target.value)} /></Grid>
                      <Grid item xs={6} md={4}><TextField fullWidth size="small" type="date" label="Check-in" InputLabelProps={{ shrink: true }} value={form.checkIn} onChange={(e) => set('checkIn', e.target.value)} /></Grid>
                      <Grid item xs={6} md={4}><TextField fullWidth size="small" type="date" label="Check-out" InputLabelProps={{ shrink: true }} inputProps={{ min: form.checkIn }} value={form.checkOut} onChange={(e) => set('checkOut', e.target.value)} /></Grid>
                      <Grid item xs={12} md={4}>
                        <TextField fullWidth size="small" type="number" label="Room rate" value={form.roomRate} placeholder={String(roomTypes.find((r) => r.code === form.roomTypeCode)?.baseRate ?? '')}
                          onChange={(e) => set('roomRate', e.target.value)} disabled={!canPrice} helperText={canPrice ? 'Blank = standard rate' : 'Standard rate'} />
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">
                          The rooms are booked as reservations linked to this event and billed on its invoice, so the desk only collects extras at check-out.
                        </Typography>
                      </Grid>
                    </Grid>
                  )}
                </Stack>
              </Section>

              <Section letter="F" title="Promotions" hint="Applied to the event total. Set event promotions up under Promotions → Event promotions.">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField select fullWidth size="small" label="Event promotion" value={form.promotionId} onChange={(e) => setForm((f) => ({ ...f, promotionId: e.target.value, promotionCode: '' }))}>
                      <MenuItem value="">None</MenuItem>
                      {promotions.map((p) => <MenuItem key={p.id} value={p.id}>{p.name} ({p.mechanism === 'FIXED' ? formatCurrency(p.value) : `${p.value}%`})</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="…or promotion code" value={form.promotionCode} onChange={(e) => setForm((f) => ({ ...f, promotionCode: e.target.value.toUpperCase(), promotionId: '' }))} />
                  </Grid>
                  {canPrice && (
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth size="small" type="number" label="Extra discount (manager)" value={form.manualDiscount} onChange={(e) => set('manualDiscount', e.target.value)} helperText="Recorded in the audit trail" />
                    </Grid>
                  )}
                  <Grid item xs={12}>
                    <TextField fullWidth size="small" label="Terms and conditions (on the invoice)" value={form.terms} onChange={(e) => set('terms', e.target.value)} multiline minRows={2} />
                  </Grid>
                </Grid>
              </Section>
            </Stack>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, position: { lg: 'sticky' }, top: { lg: 88 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography fontWeight={800}>Quote</Typography>
                {quoting && <CircularProgress size={16} />}
              </Stack>
              {!ready ? (
                <Typography variant="body2" color="text.secondary">Fill in the contact, event name, type and dates to see the price.</Typography>
              ) : quoteError ? (
                <Alert severity="error">{quoteError}</Alert>
              ) : quote ? (
                <Stack spacing={1}>
                  {quote.lines.map((line, i) => (
                    <Stack key={i} direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {line.description}
                        {line.type === 'CATERING' && <Typography component="span" variant="caption" color="text.secondary"> · {line.quantity} × {formatCurrency(line.unitPrice)}</Typography>}
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>{formatCurrency(line.amount)}</Typography>
                    </Stack>
                  ))}
                  <Divider />
                  <Row label="Subtotal" value={formatCurrency(quote.subtotal)} />
                  {quote.discount > 0 && <Row label={quote.promotion ? `Discount (${quote.promotion.name})` : 'Discount'} value={`− ${formatCurrency(quote.discount)}`} />}
                  {quote.serviceCharge > 0 && <Row label={`Service charge (${quote.serviceChargeRate}%)`} value={formatCurrency(quote.serviceCharge)} />}
                  {quote.tax > 0 && <Row label={`VAT (${quote.vatRate}%)`} value={formatCurrency(quote.tax)} />}
                  <Divider />
                  <Row label="Total" value={formatCurrency(quote.total)} strong />
                  <Typography variant="caption" color="text.secondary">{quote.days} day{quote.days === 1 ? '' : 's'} at {quote.location}</Typography>
                  {quote.promotionReasons.length > 0 && <Alert severity="warning">Promotion not applied: {quote.promotionReasons.join('; ')}</Alert>}
                  {quote.conflicts.length > 0 && (
                    <Alert severity="error">
                      {quote.location} is already confirmed for {quote.conflicts.map((c) => `${c.eventName} (${c.reference})`).join(', ')} at that time. You can save it as pending, but it cannot be confirmed.
                    </Alert>
                  )}
                  {quote.warnings.map((w) => <Alert key={w} severity="warning">{w}</Alert>)}
                  {quote.needsPricingPermission && <Alert severity="info">Some prices differ from the list: {quote.overrides.join('; ')}. A manager must save this.</Alert>}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">Pricing…</Typography>
              )}

              <Stack spacing={1} sx={{ mt: 2 }}>
                {editing ? (
                  <Button variant="contained" onClick={() => void save()} disabled={Boolean(saving) || !ready}>Save changes</Button>
                ) : (
                  <>
                    <Button variant="contained" onClick={() => void save('CONFIRMED')} disabled={Boolean(saving) || !ready || Boolean(quote?.conflicts.length)}>Confirm booking</Button>
                    <Button variant="outlined" onClick={() => void save('QUOTATION_SENT')} disabled={Boolean(saving) || !ready}>Save and send quotation</Button>
                    <Button variant="outlined" onClick={() => void save('PENDING')} disabled={Boolean(saving) || !ready}>Save as pending</Button>
                    <Button onClick={() => void save('DRAFT')} disabled={Boolean(saving) || !ready}>Save draft</Button>
                  </>
                )}
                <Button color="inherit" onClick={() => navigate(editing ? `/business/events/${id}` : '/business/events')} disabled={Boolean(saving)}>Cancel</Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Layout>
  );
};

const Row: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <Stack direction="row" justifyContent="space-between">
    <Typography variant="body2" fontWeight={strong ? 800 : 400}>{label}</Typography>
    <Typography variant="body2" fontWeight={strong ? 800 : 600}>{value}</Typography>
  </Stack>
);

export default EventFormPage;
