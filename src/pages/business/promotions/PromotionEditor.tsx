import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  promotionsApi,
  type Lookups,
  type Mechanism,
  type PreviewResult,
  type PromotionInput,
  type PromotionKind,
  type PromotionRecord
} from '../../../services/promotions';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * The full setup template. Rooms: A details, B room selection, C discount,
 * D validity, E eligibility, F preview & publish. Food & beverage: A details,
 * B scope, C offer, D schedule, E redemption rules, F profitability,
 * G preview & publish.
 */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ROOM_TYPES = ['Discount', 'Special Rate', 'Package', 'Stay Extension'];
const FNB_MECHANISMS: Array<[Mechanism, string]> = [
  ['PERCENTAGE', 'Percentage discount'],
  ['FIXED', 'Fixed amount discount'],
  ['COMBO', 'Combo offer'],
  ['BUY_X_GET_Y', 'Buy X get Y'],
  ['SPECIAL_PRICE', 'Special price']
];
const ROOM_CHANNELS = [['WEBSITE', 'Website'], ['GUEST_PORTAL', 'Guest portal'], ['FRONT_DESK', 'Front desk']];
const FNB_CHANNELS = [['POS', 'POS'], ['QR', 'QR ordering'], ['ROOM_SERVICE', 'Room service']];
const ORDER_TYPES = [['DINE_IN', 'Dine-in'], ['QR', 'QR order'], ['TAKEAWAY', 'Takeaway'], ['ROOM_SERVICE', 'Room service']];

const toLocalInput = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
const toLocalDate = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
const num = (value: string) => (value === '' ? null : Number(value));

export const emptyPromotion = (kind: PromotionKind): PromotionInput => ({
  kind,
  name: '',
  code: '',
  description: '',
  promotionType: kind === 'ROOM' ? 'Discount' : 'Percentage',
  mechanism: 'PERCENTAGE',
  value: 10,
  rewardMenuItemIds: [],
  discountAppliesTo: kind === 'ROOM' ? 'ROOM_RATE' : 'ELIGIBLE_ITEMS',
  stackable: false,
  autoApply: false,
  roomIds: [],
  roomTypeCodes: [],
  ratePlanIds: [],
  applicableOutletIds: [],
  applicableCategoryIds: [],
  applicableMenuItemIds: [],
  channels: [],
  orderTypes: [],
  tableNumbers: [],
  blackoutDates: [],
  applicableDays: [],
  eligibleGuests: 'ALL'
});

const fromRecord = (record: PromotionRecord): PromotionInput => {
  const { kind, name, code, description, promotionType, mechanism, value, specialPrice, buyQuantity, getQuantity, rewardMenuItemIds,
    discountAppliesTo, maxDiscount, stackable, autoApply, imageUrl, roomIds, roomTypeCodes, ratePlanIds, applicableOutletIds,
    applicableCategoryIds, applicableMenuItemIds, channels, orderTypes, tableNumbers, minNights, maxNights, minQuantity, minOrderAmount,
    startsAt, endsAt, stayStartsAt, stayEndsAt, bookingCutoffHours, blackoutDates, applicableDays, startTime, endTime, eligibleGuests,
    minGuestAge, maxRedemptions, perGuestLimit, stockLimit, cancellationPolicy, terms } = record;
  return {
    kind, name, code, description: description ?? '', promotionType: promotionType ?? '', mechanism, value, specialPrice, buyQuantity,
    getQuantity, rewardMenuItemIds, discountAppliesTo, maxDiscount, stackable, autoApply, imageUrl, roomIds, roomTypeCodes, ratePlanIds,
    applicableOutletIds, applicableCategoryIds, applicableMenuItemIds, channels, orderTypes, tableNumbers, minNights, maxNights, minQuantity,
    minOrderAmount, startsAt, endsAt, stayStartsAt, stayEndsAt, bookingCutoffHours, blackoutDates, applicableDays, startTime, endTime,
    eligibleGuests, minGuestAge, maxRedemptions, perGuestLimit, stockLimit, cancellationPolicy, terms
  };
};

/** Strips empty optional values so the server's validation sees what was meant. */
const clean = (input: PromotionInput): PromotionInput => {
  const out: Record<string, unknown> = { ...input };
  for (const [key, value] of Object.entries(out)) {
    if (value === '' || value === undefined || (typeof value === 'number' && Number.isNaN(value))) delete out[key];
  }
  return out as unknown as PromotionInput;
};

const Section: React.FC<{ letter: string; title: string; hint?: string; children: React.ReactNode }> = ({ letter, title, hint, children }) => (
  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
      <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14 }}>
        {letter}
      </Box>
      <Box>
        <Typography fontWeight={800}>{title}</Typography>
        {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
      </Box>
    </Stack>
    {children}
  </Paper>
);

function MultiPick<T>(props: {
  label: string;
  options: T[];
  value: string[];
  getId: (option: T) => string;
  getLabel: (option: T) => string;
  onChange: (ids: string[]) => void;
  helperText?: string;
}) {
  const selected = props.options.filter((option) => props.value.includes(props.getId(option)));
  return (
    <Autocomplete
      multiple
      size="small"
      options={props.options}
      value={selected}
      disableCloseOnSelect
      getOptionLabel={props.getLabel}
      isOptionEqualToValue={(a, b) => props.getId(a) === props.getId(b)}
      onChange={(_event, next) => props.onChange(next.map(props.getId))}
      renderInput={(params) => <TextField {...params} label={props.label} placeholder={selected.length ? '' : 'All'} helperText={props.helperText} />}
    />
  );
}

const ChipToggles: React.FC<{ options: string[][]; value: string[]; onChange: (next: string[]) => void; allLabel?: string }> = ({ options, value, onChange, allLabel = 'All' }) => (
  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
    <Chip label={allLabel} color={value.length === 0 ? 'primary' : 'default'} onClick={() => onChange([])} />
    {options.map(([id, label]) => (
      <Chip
        key={id}
        label={label}
        color={value.includes(id) ? 'primary' : 'default'}
        variant={value.includes(id) ? 'filled' : 'outlined'}
        onClick={() => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])}
      />
    ))}
  </Stack>
);

const PromotionEditor: React.FC<{
  open: boolean;
  kind: PromotionKind;
  record?: PromotionRecord | null;
  lookups: Lookups | null;
  currency: (value: number) => string;
  onClose: () => void;
  onSaved: (record: PromotionRecord) => void;
}> = ({ open, kind, record, lookups, currency, onClose, onSaved }) => {
  const [form, setForm] = useState<PromotionInput>(emptyPromotion(kind));
  const [image, setImage] = useState<File | null>(null);
  const [blackout, setBlackout] = useState('');
  const [saving, setSaving] = useState<'' | 'DRAFT' | 'PUBLISH' | 'SCHEDULE' | 'PREVIEW'>('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(record ? fromRecord(record) : emptyPromotion(kind));
    setImage(null);
    setError('');
    setPreview(null);
  }, [open, record, kind]);

  const set = <K extends keyof PromotionInput>(key: K, value: PromotionInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const isRoom = form.kind === 'ROOM';
  const items = lookups?.items ?? [];
  const eligibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          (!form.applicableOutletIds.length || form.applicableOutletIds.includes(item.outletId))
          && (!form.applicableCategoryIds.length || (item.categoryId != null && form.applicableCategoryIds.includes(item.categoryId)))
      ),
    [items, form.applicableOutletIds, form.applicableCategoryIds]
  );
  const scheduled = Boolean(form.startsAt && new Date(form.startsAt).getTime() > Date.now());

  const runPreview = async () => {
    setSaving('PREVIEW');
    setError('');
    try {
      setPreview(await promotionsApi.preview(clean({ ...form, action: 'PUBLISH' })));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not preview this promotion'));
    } finally {
      setSaving('');
    }
  };

  // Profitability (F&B section F) refreshes as the offer changes.
  useEffect(() => {
    if (!open || isRoom || !form.name.trim()) return;
    const timer = window.setTimeout(() => {
      promotionsApi.preview(clean({ ...form, action: 'PUBLISH' })).then(setPreview).catch(() => undefined);
    }, 600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isRoom, form.mechanism, form.value, form.specialPrice, form.buyQuantity, form.getQuantity, form.applicableMenuItemIds, form.applicableCategoryIds, form.applicableOutletIds, form.minQuantity, form.discountAppliesTo]);

  const save = async (mode: 'DRAFT' | 'PUBLISH' | 'SCHEDULE') => {
    if (form.name.trim().length < 2) {
      setError('Give the promotion a name.');
      return;
    }
    if (mode === 'SCHEDULE' && !scheduled) {
      setError('To schedule, set a booking/offer start date in the future (section D).');
      return;
    }
    setSaving(mode);
    setError('');
    try {
      const payload = clean({ ...form, code: form.code?.toUpperCase(), action: mode === 'DRAFT' ? 'DRAFT' : 'PUBLISH' });
      let saved = record ? await promotionsApi.update(record.id, payload) : await promotionsApi.create(payload);
      if (image) saved = await promotionsApi.uploadImage(saved.id, image);
      onSaved(saved);
    } catch (err: any) {
      const issues = err?.response?.data?.issues as Array<{ path: string[]; message: string }> | undefined;
      setError(issues?.length ? issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') : getApiErrorMessage(err, 'Could not save'));
    } finally {
      setSaving('');
    }
  };

  const valueLabel =
    form.mechanism === 'PERCENTAGE' ? 'Discount (%)' : form.mechanism === 'FIXED' ? 'Discount amount' : form.mechanism === 'COMBO' ? 'Combo price' : 'Discount value';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle sx={{ fontWeight: 800 }}>
        {record ? 'Edit' : 'New'} {isRoom ? 'room' : 'food & beverage'} promotion
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
          {record?.rejectionReason && record.status === 'DRAFT' && <Alert severity="warning">Returned by approver: {record.rejectionReason}</Alert>}

          <Section letter="A" title="Promotion details">
            <Grid container spacing={2}>
              <Grid item xs={12} md={7}>
                <TextField fullWidth size="small" label="Promotion name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
              </Grid>
              <Grid item xs={12} md={5}>
                <TextField fullWidth size="small" label="Promotion code" value={form.code ?? ''} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} helperText="Leave blank to generate one" />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Description" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} multiline minRows={2} />
              </Grid>
              <Grid item xs={12} md={6}>
                {isRoom ? (
                  <TextField select fullWidth size="small" label="Promotion type" value={form.promotionType ?? 'Discount'} onChange={(e) => {
                    set('promotionType', e.target.value);
                    if (e.target.value === 'Special Rate') set('mechanism', 'SPECIAL_PRICE');
                  }}>
                    {ROOM_TYPES.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                  </TextField>
                ) : (
                  <TextField select fullWidth size="small" label="Promotion type" value={form.promotionType === 'Happy Hour' ? 'HAPPY_HOUR' : form.mechanism} onChange={(e) => {
                    if (e.target.value === 'HAPPY_HOUR') {
                      set('promotionType', 'Happy Hour');
                      set('mechanism', 'PERCENTAGE');
                    } else {
                      set('mechanism', e.target.value as Mechanism);
                      set('promotionType', FNB_MECHANISMS.find(([m]) => m === e.target.value)?.[1] ?? '');
                    }
                  }}>
                    {FNB_MECHANISMS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                    <MenuItem value="HAPPY_HOUR">Happy hour</MenuItem>
                  </TextField>
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button component="label" variant="outlined" size="small">
                    {image ? image.name.slice(0, 24) : form.imageUrl ? 'Replace banner' : 'Upload banner'}
                    <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
                  </Button>
                  {form.imageUrl && !image && <Box component="img" src={form.imageUrl} alt="" sx={{ height: 36, borderRadius: 1 }} />}
                </Stack>
              </Grid>
              {record && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Status: {record.effectiveStatus.replace('_', ' ').toLowerCase()}</Typography>
                </Grid>
              )}
            </Grid>
          </Section>

          {isRoom ? (
            <>
              <Section letter="B" title="Room selection" hint="Leave a list empty to cover everything.">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <MultiPick label="Room categories" options={lookups?.roomTypes ?? []} value={form.roomTypeCodes} getId={(t) => t.code} getLabel={(t) => t.name} onChange={(v) => set('roomTypeCodes', v)} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MultiPick label="Specific rooms" options={(lookups?.rooms ?? []).filter((r) => !form.roomTypeCodes.length || form.roomTypeCodes.includes(r.roomType))} value={form.roomIds} getId={(r) => r.id} getLabel={(r) => `${r.roomNumber}${r.name ? ` · ${r.name}` : ''} (${r.roomType})`} onChange={(v) => set('roomIds', v)} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MultiPick label="Rate plans" options={lookups?.ratePlans ?? []} value={form.ratePlanIds} getId={(p) => p.id} getLabel={(p) => `${p.name} (${p.roomTypeCode})`} onChange={(v) => set('ratePlanIds', v)} />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <TextField fullWidth size="small" type="number" label="Min stay (nights)" value={form.minNights ?? ''} onChange={(e) => set('minNights', num(e.target.value))} />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <TextField fullWidth size="small" type="number" label="Max stay (nights)" value={form.maxNights ?? ''} onChange={(e) => set('maxNights', num(e.target.value))} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" type="number" label="Minimum booking value" value={form.minOrderAmount ?? ''} onChange={(e) => set('minOrderAmount', num(e.target.value))} />
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Applicable days</Typography>
                    <ChipToggles options={DAYS.map((d, i) => [String(i), d])} value={form.applicableDays.map(String)} onChange={(v) => set('applicableDays', v.map(Number))} allLabel="Every day" />
                  </Grid>
                </Grid>
              </Section>

              <Section letter="C" title="Discount configuration">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField select fullWidth size="small" label="Discount type" value={form.mechanism} onChange={(e) => set('mechanism', e.target.value as Mechanism)}>
                      <MenuItem value="PERCENTAGE">Percentage</MenuItem>
                      <MenuItem value="FIXED">Fixed amount</MenuItem>
                      <MenuItem value="SPECIAL_PRICE">Special rate per night</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    {form.mechanism === 'SPECIAL_PRICE' ? (
                      <TextField fullWidth size="small" type="number" label="Special nightly rate" value={form.specialPrice ?? ''} onChange={(e) => set('specialPrice', num(e.target.value))} />
                    ) : (
                      <TextField fullWidth size="small" type="number" label={form.mechanism === 'PERCENTAGE' ? 'Discount value (%)' : 'Discount value'} value={form.value} onChange={(e) => set('value', Number(e.target.value))} />
                    )}
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField select fullWidth size="small" label="Applies to" value={form.discountAppliesTo ?? 'ROOM_RATE'} onChange={(e) => set('discountAppliesTo', e.target.value)}>
                      <MenuItem value="ROOM_RATE">Room rate (every night)</MenuItem>
                      <MenuItem value="FIRST_NIGHT">First night only</MenuItem>
                      <MenuItem value="LAST_NIGHT">Last night only</MenuItem>
                      <MenuItem value="BOOKING_TOTAL">Booking total</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField fullWidth size="small" type="number" label="Maximum discount" value={form.maxDiscount ?? ''} onChange={(e) => set('maxDiscount', num(e.target.value))} />
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <FormControlLabel control={<Switch checked={form.stackable} onChange={(e) => set('stackable', e.target.checked)} />} label="Can combine with other promotions" />
                    <FormControlLabel control={<Switch checked={form.autoApply} onChange={(e) => set('autoApply', e.target.checked)} />} label="Apply automatically when eligible" />
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Taxes are charged on the discounted rate.</Typography>
                  </Grid>
                </Grid>
              </Section>

              <Section letter="D" title="Validity" hint="Dates use the hotel's time zone automatically.">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}><TextField fullWidth size="small" type="datetime-local" label="Booking start" InputLabelProps={{ shrink: true }} value={toLocalInput(form.startsAt)} onChange={(e) => set('startsAt', e.target.value ? new Date(e.target.value).toISOString() : undefined)} /></Grid>
                  <Grid item xs={12} md={6}><TextField fullWidth size="small" type="datetime-local" label="Booking end" InputLabelProps={{ shrink: true }} value={toLocalInput(form.endsAt)} onChange={(e) => set('endsAt', e.target.value ? new Date(e.target.value).toISOString() : null)} /></Grid>
                  <Grid item xs={12} md={6}><TextField fullWidth size="small" type="date" label="Stay start" InputLabelProps={{ shrink: true }} value={toLocalDate(form.stayStartsAt)} onChange={(e) => set('stayStartsAt', e.target.value ? new Date(e.target.value).toISOString() : null)} /></Grid>
                  <Grid item xs={12} md={6}><TextField fullWidth size="small" type="date" label="Stay end" InputLabelProps={{ shrink: true }} value={toLocalDate(form.stayEndsAt)} onChange={(e) => set('stayEndsAt', e.target.value ? new Date(e.target.value).toISOString() : null)} /></Grid>
                  <Grid item xs={12} md={6}><TextField fullWidth size="small" type="number" label="Booking cutoff (hours before check-in)" value={form.bookingCutoffHours ?? ''} onChange={(e) => set('bookingCutoffHours', num(e.target.value))} /></Grid>
                  <Grid item xs={12} md={6}>
                    <BlackoutDates value={form.blackoutDates} draft={blackout} setDraft={setBlackout} onChange={(v) => set('blackoutDates', v)} />
                  </Grid>
                </Grid>
              </Section>

              <Section letter="E" title="Eligibility rules">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField select fullWidth size="small" label="Guest type" value={form.eligibleGuests} onChange={(e) => set('eligibleGuests', e.target.value as PromotionInput['eligibleGuests'])}>
                      <MenuItem value="ALL">All guests</MenuItem>
                      <MenuItem value="NEW">New guests</MenuItem>
                      <MenuItem value="RETURNING">Returning guests</MenuItem>
                      <MenuItem value="LOYALTY">Loyalty members</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={6}><TextField fullWidth size="small" type="number" label="Minimum guest age" value={form.minGuestAge ?? ''} onChange={(e) => set('minGuestAge', num(e.target.value))} /></Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Booking channels</Typography>
                    <ChipToggles options={ROOM_CHANNELS} value={form.channels} onChange={(v) => set('channels', v)} allLabel="All channels" />
                  </Grid>
                  <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Redemption limit" value={form.maxRedemptions ?? ''} onChange={(e) => set('maxRedemptions', num(e.target.value))} /></Grid>
                  <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Uses per guest" value={form.perGuestLimit ?? ''} onChange={(e) => set('perGuestLimit', num(e.target.value))} /></Grid>
                  <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Cancellation / refund rules" value={form.cancellationPolicy ?? ''} onChange={(e) => set('cancellationPolicy', e.target.value)} /></Grid>
                  <Grid item xs={12}><TextField fullWidth size="small" label="Terms & conditions" value={form.terms ?? ''} onChange={(e) => set('terms', e.target.value)} multiline minRows={2} /></Grid>
                </Grid>
              </Section>
            </>
          ) : (
            <>
              <Section letter="B" title="Promotion scope" hint="Leave a list empty to cover everything.">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <MultiPick label="Outlets" options={lookups?.outlets ?? []} value={form.applicableOutletIds} getId={(o) => o.id} getLabel={(o) => o.name} onChange={(v) => set('applicableOutletIds', v)} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MultiPick label="Menu categories" options={lookups?.categories ?? []} value={form.applicableCategoryIds} getId={(c) => c.id} getLabel={(c) => c.name} onChange={(v) => set('applicableCategoryIds', v)} />
                  </Grid>
                  <Grid item xs={12}>
                    <MultiPick label="Eligible items" options={eligibleItems} value={form.applicableMenuItemIds} getId={(i) => i.id} getLabel={(i) => `${i.name} · ${currency(i.price)}`} onChange={(v) => set('applicableMenuItemIds', v)} />
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Order types</Typography>
                    <ChipToggles options={ORDER_TYPES} value={form.orderTypes} onChange={(v) => set('orderTypes', v)} allLabel="All order types" />
                  </Grid>
                  <Grid item xs={12}>
                    <Autocomplete multiple freeSolo size="small" options={[]} value={form.tableNumbers} onChange={(_e, v) => set('tableNumbers', v.map(String).slice(0, 200))} renderInput={(params) => <TextField {...params} label="Tables (type and press Enter)" placeholder={form.tableNumbers.length ? '' : 'All tables'} />} />
                  </Grid>
                </Grid>
              </Section>

              <Section letter="C" title="Offer configuration">
                <Grid container spacing={2}>
                  {form.mechanism === 'BUY_X_GET_Y' ? (
                    <>
                      <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Buy (X)" value={form.buyQuantity ?? ''} onChange={(e) => set('buyQuantity', num(e.target.value))} /></Grid>
                      <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Get free (Y)" value={form.getQuantity ?? ''} onChange={(e) => set('getQuantity', num(e.target.value))} /></Grid>
                      <Grid item xs={12} md={6}>
                        <MultiPick label="Reward items (empty = same items)" options={items} value={form.rewardMenuItemIds} getId={(i) => i.id} getLabel={(i) => i.name} onChange={(v) => set('rewardMenuItemIds', v)} />
                      </Grid>
                    </>
                  ) : form.mechanism === 'SPECIAL_PRICE' ? (
                    <Grid item xs={12} md={4}><TextField fullWidth size="small" type="number" label="Special price per item" value={form.specialPrice ?? ''} onChange={(e) => set('specialPrice', num(e.target.value))} /></Grid>
                  ) : (
                    <Grid item xs={12} md={4}><TextField fullWidth size="small" type="number" label={valueLabel} value={form.mechanism === 'COMBO' ? form.specialPrice ?? '' : form.value} onChange={(e) => (form.mechanism === 'COMBO' ? set('specialPrice', num(e.target.value)) : set('value', Number(e.target.value)))} /></Grid>
                  )}
                  <Grid item xs={6} md={4}><TextField fullWidth size="small" type="number" label="Minimum quantity" value={form.minQuantity ?? ''} onChange={(e) => set('minQuantity', num(e.target.value))} /></Grid>
                  <Grid item xs={6} md={4}><TextField fullWidth size="small" type="number" label="Minimum order value" value={form.minOrderAmount ?? ''} onChange={(e) => set('minOrderAmount', num(e.target.value))} /></Grid>
                  <Grid item xs={6} md={4}><TextField fullWidth size="small" type="number" label="Maximum discount" value={form.maxDiscount ?? ''} onChange={(e) => set('maxDiscount', num(e.target.value))} /></Grid>
                  {form.mechanism === 'PERCENTAGE' || form.mechanism === 'FIXED' ? (
                    <Grid item xs={12} md={8}>
                      <TextField select fullWidth size="small" label="Discount applies to" value={form.discountAppliesTo ?? 'ELIGIBLE_ITEMS'} onChange={(e) => set('discountAppliesTo', e.target.value)}>
                        <MenuItem value="ELIGIBLE_ITEMS">Selected (eligible) items</MenuItem>
                        <MenuItem value="CHEAPEST_ITEM">Cheapest eligible item</MenuItem>
                        <MenuItem value="ORDER_SUBTOTAL">Order subtotal</MenuItem>
                      </TextField>
                    </Grid>
                  ) : null}
                  <Grid item xs={12}>
                    <FormControlLabel control={<Switch checked={form.stackable} onChange={(e) => set('stackable', e.target.checked)} />} label="Can combine with other promotions" />
                    <FormControlLabel control={<Switch checked={form.autoApply} onChange={(e) => set('autoApply', e.target.checked)} />} label="Apply automatically (no code needed)" />
                  </Grid>
                </Grid>
              </Section>

              <Section letter="D" title="Schedule" hint="Times use the hotel's time zone automatically.">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}><TextField fullWidth size="small" type="datetime-local" label="Start date" InputLabelProps={{ shrink: true }} value={toLocalInput(form.startsAt)} onChange={(e) => set('startsAt', e.target.value ? new Date(e.target.value).toISOString() : undefined)} /></Grid>
                  <Grid item xs={12} md={6}><TextField fullWidth size="small" type="datetime-local" label="End date" InputLabelProps={{ shrink: true }} value={toLocalInput(form.endsAt)} onChange={(e) => set('endsAt', e.target.value ? new Date(e.target.value).toISOString() : null)} /></Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Active days</Typography>
                    <ChipToggles options={DAYS.map((d, i) => [String(i), d])} value={form.applicableDays.map(String)} onChange={(v) => set('applicableDays', v.map(Number))} allLabel="Every day" />
                  </Grid>
                  <Grid item xs={6} md={3}><TextField fullWidth size="small" type="time" label="Start time" InputLabelProps={{ shrink: true }} value={form.startTime ?? ''} onChange={(e) => set('startTime', e.target.value || null)} /></Grid>
                  <Grid item xs={6} md={3}><TextField fullWidth size="small" type="time" label="End time" InputLabelProps={{ shrink: true }} value={form.endTime ?? ''} onChange={(e) => set('endTime', e.target.value || null)} /></Grid>
                  <Grid item xs={12} md={6}><BlackoutDates value={form.blackoutDates} draft={blackout} setDraft={setBlackout} onChange={(v) => set('blackoutDates', v)} /></Grid>
                </Grid>
              </Section>

              <Section letter="E" title="Redemption rules">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField select fullWidth size="small" label="Eligible customers" value={form.eligibleGuests} onChange={(e) => set('eligibleGuests', e.target.value as PromotionInput['eligibleGuests'])}>
                      <MenuItem value="ALL">All customers</MenuItem>
                      <MenuItem value="NEW">New customers</MenuItem>
                      <MenuItem value="RETURNING">Returning customers</MenuItem>
                      <MenuItem value="LOYALTY">Loyalty members</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">Channels</Typography>
                    <ChipToggles options={FNB_CHANNELS} value={form.channels} onChange={(v) => set('channels', v)} allLabel="All channels" />
                  </Grid>
                  <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Max redemptions" value={form.maxRedemptions ?? ''} onChange={(e) => set('maxRedemptions', num(e.target.value))} /></Grid>
                  <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Per customer" value={form.perGuestLimit ?? ''} onChange={(e) => set('perGuestLimit', num(e.target.value))} /></Grid>
                  <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Refund / cancellation rules" value={form.cancellationPolicy ?? ''} onChange={(e) => set('cancellationPolicy', e.target.value)} /></Grid>
                  <Grid item xs={12}><TextField fullWidth size="small" label="Terms & conditions" value={form.terms ?? ''} onChange={(e) => set('terms', e.target.value)} multiline minRows={2} /></Grid>
                </Grid>
              </Section>

              <Section letter="F" title="Profitability" hint="Cost prices come from the menu and cannot be edited here.">
                <Grid container spacing={2} sx={{ mb: 1 }}>
                  <Grid item xs={6} md={4}><TextField fullWidth size="small" type="number" label="Stock limit (items)" value={form.stockLimit ?? ''} onChange={(e) => set('stockLimit', num(e.target.value))} helperText={record ? `${record.stockRedeemed} redeemed` : undefined} /></Grid>
                </Grid>
                <ProfitTable preview={preview} currency={currency} />
              </Section>
            </>
          )}

          <Section letter={isRoom ? 'F' : 'G'} title="Preview & publish">
            {preview ? (
              <Stack spacing={1.5}>
                {preview.approval.requiresApproval ? (
                  <Alert severity="warning" icon={<WarningAmberRoundedIcon />}>
                    Needs manager approval before it goes live: {preview.approval.reasons.join('; ')}
                  </Alert>
                ) : (
                  <Alert severity="success">Within your discount and margin policy — publishes immediately.</Alert>
                )}
                {isRoom && <RoomPreviewTable preview={preview} currency={currency} />}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">Press Preview to see the promotional prices and whether approval is needed.</Typography>
            )}
          </Section>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={Boolean(saving)}>Cancel</Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="outlined" onClick={() => void save('DRAFT')} disabled={Boolean(saving)}>
          {saving === 'DRAFT' ? <CircularProgress size={18} /> : 'Save as draft'}
        </Button>
        <Button variant="outlined" onClick={() => void runPreview()} disabled={Boolean(saving)}>
          {saving === 'PREVIEW' ? <CircularProgress size={18} /> : 'Preview'}
        </Button>
        <Button variant="outlined" color="secondary" onClick={() => void save('SCHEDULE')} disabled={Boolean(saving)}>
          {saving === 'SCHEDULE' ? <CircularProgress size={18} /> : 'Schedule'}
        </Button>
        <Button variant="contained" onClick={() => void save('PUBLISH')} disabled={Boolean(saving)}>
          {saving === 'PUBLISH' ? <CircularProgress size={18} color="inherit" /> : 'Publish'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const BlackoutDates: React.FC<{ value: string[]; draft: string; setDraft: (v: string) => void; onChange: (v: string[]) => void }> = ({ value, draft, setDraft, onChange }) => (
  <Stack spacing={1}>
    <Stack direction="row" spacing={1}>
      <TextField size="small" type="date" label="Blackout date" InputLabelProps={{ shrink: true }} value={draft} onChange={(e) => setDraft(e.target.value)} sx={{ flexGrow: 1 }} />
      <Button size="small" onClick={() => { if (draft && !value.includes(draft)) onChange([...value, draft].sort()); setDraft(''); }} disabled={!draft}>Add</Button>
    </Stack>
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {value.map((day) => <Chip key={day} size="small" label={day} onDelete={() => onChange(value.filter((d) => d !== day))} />)}
    </Stack>
  </Stack>
);

const ProfitTable: React.FC<{ preview: PreviewResult | null; currency: (v: number) => string }> = ({ preview, currency }) => {
  if (!preview || preview.kind !== 'FOOD_BEVERAGE') {
    return <Typography variant="body2" color="text.secondary">Name the promotion and choose items to see prices and margins.</Typography>;
  }
  if (!preview.rows.length) return <Typography variant="body2" color="text.secondary">No menu items match this scope.</Typography>;
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Item</TableCell>
            <TableCell align="right">Cost price</TableCell>
            <TableCell align="right">Regular price</TableCell>
            <TableCell align="right">Promotional price</TableCell>
            <TableCell align="right">Est. margin</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {preview.rows.slice(0, 25).map((row) => (
            <TableRow key={row.menuItemId}>
              <TableCell>{row.name}</TableCell>
              <TableCell align="right">{row.cost != null ? currency(row.cost) : '—'}</TableCell>
              <TableCell align="right">{currency(row.originalPrice)}</TableCell>
              <TableCell align="right">{currency(row.promotionalPrice)}</TableCell>
              <TableCell align="right">
                {row.margin == null ? '—' : (
                  <Chip size="small" color={row.lowMargin ? 'warning' : 'success'} label={`${row.margin}%${row.lowMargin ? ' · low' : ''}`} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {preview.rows.some((row) => row.lowMargin) && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Some items fall below the {preview.policy?.minMarginPercent ?? 15}% minimum margin — this promotion will need manager approval.
        </Alert>
      )}
    </Box>
  );
};

const RoomPreviewTable: React.FC<{ preview: PreviewResult; currency: (v: number) => string }> = ({ preview, currency }) => (
  <Box sx={{ overflowX: 'auto' }}>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Room category</TableCell>
          <TableCell align="right">Original rate</TableCell>
          <TableCell align="right">Promotional rate</TableCell>
          <TableCell align="right">Nights</TableCell>
          <TableCell align="right">Guest saves</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {preview.rows.map((row) => (
          <TableRow key={row.code}>
            <TableCell>{row.roomType}</TableCell>
            <TableCell align="right">{currency(row.originalRate)}</TableCell>
            <TableCell align="right">{currency(row.promotionalRate)}</TableCell>
            <TableCell align="right">{row.nights}</TableCell>
            <TableCell align="right">{currency(row.discount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    <Divider sx={{ my: 1 }} />
  </Box>
);

/** "Add quick promotion": just a name and a discount. */
export const QuickPromotionDialog: React.FC<{
  open: boolean;
  kind: PromotionKind;
  onClose: () => void;
  onSaved: (record: PromotionRecord) => void;
}> = ({ open, kind, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [discount, setDiscount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setDiscount('');
      setError('');
    }
  }, [open]);

  const save = async () => {
    const value = Number(discount);
    if (name.trim().length < 2 || !Number.isFinite(value) || value <= 0 || (type === 'PERCENT' && value > 100)) {
      setError('Enter a name and a discount (1–100% or an amount).');
      return;
    }
    setSaving(true);
    try {
      onSaved(await promotionsApi.quick({ kind, name: name.trim(), ...(type === 'PERCENT' ? { discountPercent: value } : { discountAmount: value }) }));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create the promotion'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 800 }}>Quick {kind === 'ROOM' ? 'room' : 'F&B'} promotion</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Promotion name" value={name} onChange={(e) => setName(e.target.value)} autoFocus fullWidth />
          <ToggleButtonGroup exclusive size="small" value={type} onChange={(_e, v) => v && setType(v)}>
            <ToggleButton value="PERCENT">Percent</ToggleButton>
            <ToggleButton value="AMOUNT">Amount</ToggleButton>
          </ToggleButtonGroup>
          <TextField label={type === 'PERCENT' ? 'Discount (%)' : 'Discount amount'} type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} fullWidth />
          <Typography variant="caption" color="text.secondary">
            Goes live now for every {kind === 'ROOM' ? 'room' : 'item'} and channel. Large discounts still go to a manager for approval.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PromotionEditor;

