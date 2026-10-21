import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
  Typography
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { CATERING_LABEL, eventsApi, type BanquetMenuItem, type CateringService, type EventDetail } from '../../services/events';
import { roomOpsService } from '../../services/operations';
import { formatCurrency } from '../../utils/formatters';
import { getApiErrorMessage } from '../../utils/apiError';
import RoomBlocksEditor, { toAccommodation, type RoomBlock } from './RoomBlocksEditor';

type CateringRow = { key: string; service: CateringService; menuItemId: string; description: string; date: string; time: string; people: string; price: string };

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const key = () => Math.random().toString(36).slice(2);

const Section: React.FC<{ letter: string; title: string; hint?: string; children: React.ReactNode }> = ({ letter, title, hint, children }) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
    <Typography fontWeight={800} sx={{ mb: 0.5 }}>{letter}. {title}</Typography>
    {hint && <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>{hint}</Typography>}
    {children}
  </Paper>
);

/**
 * Add-ons after payment. What was booked and paid for stays as it was; this
 * adds an extension (B), catering (C), corkage (D), rooms (E) and a manager
 * discount (F). The server prices them and recalculates the balance.
 */
const AddOnsDialog: React.FC<{ open: boolean; event: EventDetail; canPrice: boolean; onClose: () => void; onDone: () => void }> = ({ open, event, canPrice, onClose, onDone }) => {
  const [extendTo, setExtendTo] = useState('');
  const [catering, setCatering] = useState<CateringRow[]>([]);
  const [corkage, setCorkage] = useState({ description: 'Corkage fee', amount: '', quantity: '1' });
  const [rooms, setRooms] = useState<RoomBlock[]>([]);
  const [discount, setDiscount] = useState('');
  const [note, setNote] = useState('');
  const [menu, setMenu] = useState<BanquetMenuItem[]>([]);
  const [roomTypes, setRoomTypes] = useState<Array<{ code: string; name: string; baseRate: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setExtendTo('');
    setCatering([]);
    setCorkage({ description: 'Corkage fee', amount: '', quantity: '1' });
    setRooms([]);
    setDiscount('');
    setNote('');
    setError('');
    eventsApi.menu().then((m) => setMenu(m.items)).catch(() => setMenu([]));
    roomOpsService.listRoomTypes().then((rows) => setRoomTypes(rows.filter((r) => r.isActive))).catch(() => setRoomTypes([]));
  }, [open]);

  const start = ymd(new Date(event.startAt));
  const end = ymd(new Date(event.endAt));
  const update = (k: string, patch: Partial<CateringRow>) => setCatering((rows) => rows.map((r) => (r.key === k ? { ...r, ...patch } : r)));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await eventsApi.addOns(event.id, {
        extendTo: extendTo ? new Date(extendTo).toISOString() : null,
        catering: catering
          .filter((r) => r.menuItemId || r.price.trim())
          .map((r) => ({
            service: r.service,
            menuItemId: r.menuItemId || null,
            description: r.description.trim() || null,
            serviceDate: new Date(`${r.date}T${r.time || '12:00'}`).toISOString(),
            serviceTime: r.time || null,
            people: Number(r.people) || 1,
            unitPrice: r.price.trim() === '' ? null : Number(r.price)
          })),
        corkage: Number(corkage.amount) > 0 ? { description: corkage.description, amount: Number(corkage.amount), quantity: Number(corkage.quantity) || 1 } : null,
        accommodation: toAccommodation(rooms),
        manualDiscount: discount.trim() ? Number(discount) : null,
        note: note.trim() || null
      });
      onDone();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not add these to the event'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle sx={{ fontWeight: 800 }}>Add-ons for {event.eventName}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">
            Payments have been made, so what was booked stays as it is. Add-ons are priced separately and added to the balance; service charge and VAT are worked out again on the new total.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}

          <Section letter="B" title="Extend the event" hint={`Currently ends ${new Date(event.endAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. Extra days are charged at this booking's venue rate.`}>
            <TextField size="small" type="datetime-local" label="New end date and time" InputLabelProps={{ shrink: true }} value={extendTo} onChange={(e) => setExtendTo(e.target.value)} sx={{ minWidth: 260 }} />
          </Section>

          <Section letter="C" title="More catering">
            <Stack spacing={1.5}>
              {catering.map((row) => (
                <Grid container spacing={1.5} key={row.key} alignItems="center">
                  <Grid item xs={6} md={3}>
                    <TextField select fullWidth size="small" label="Service" value={row.service} onChange={(e) => update(row.key, { service: e.target.value as CateringService, menuItemId: '' })}>
                      {(Object.keys(CATERING_LABEL) as CateringService[]).map((s) => <MenuItem key={s} value={s}>{CATERING_LABEL[s]}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={6} md={4}>
                    {row.service === 'CUSTOM' ? (
                      <TextField fullWidth size="small" label="What is being served" value={row.description} onChange={(e) => update(row.key, { description: e.target.value })} />
                    ) : (
                      <TextField select fullWidth size="small" label="Menu / package" value={row.menuItemId} onChange={(e) => update(row.key, { menuItemId: e.target.value })}>
                        {menu.map((m) => <MenuItem key={m.id} value={m.id}>{m.name} · {formatCurrency(m.price)}</MenuItem>)}
                      </TextField>
                    )}
                  </Grid>
                  <Grid item xs={6} md={2}><TextField fullWidth size="small" type="date" label="Day" InputLabelProps={{ shrink: true }} value={row.date} onChange={(e) => update(row.key, { date: e.target.value })} /></Grid>
                  <Grid item xs={6} md={2}><TextField fullWidth size="small" type="number" label="People" value={row.people} onChange={(e) => update(row.key, { people: e.target.value })} /></Grid>
                  <Grid item xs={10} md={4}>
                    <TextField fullWidth size="small" type="number" label="Price per person" value={row.price} onChange={(e) => update(row.key, { price: e.target.value })}
                      disabled={!canPrice && row.service !== 'CUSTOM'} helperText={!canPrice ? 'Menu price' : 'Blank = menu price'} />
                  </Grid>
                  <Grid item xs={2} md={1}>
                    <IconButton size="small" onClick={() => setCatering((rows) => rows.filter((r) => r.key !== row.key))} aria-label="Remove"><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                  </Grid>
                </Grid>
              ))}
              <Button size="small" startIcon={<AddRoundedIcon />} sx={{ alignSelf: 'flex-start' }}
                onClick={() => setCatering((rows) => [...rows, { key: key(), service: 'LUNCH', menuItemId: '', description: '', date: end, time: '13:00', people: String(event.expectedGuests), price: '' }])}>
                Add catering
              </Button>
            </Stack>
          </Section>

          <Section letter="D" title="Corkage" hint={canPrice ? 'Added as its own invoice line.' : 'A manager adds corkage.'}>
            {canPrice ? (
              <Grid container spacing={1.5}>
                <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Description" value={corkage.description} onChange={(e) => setCorkage({ ...corkage, description: e.target.value })} /></Grid>
                <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Amount" value={corkage.amount} onChange={(e) => setCorkage({ ...corkage, amount: e.target.value })} /></Grid>
                <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Quantity" value={corkage.quantity} onChange={(e) => setCorkage({ ...corkage, quantity: e.target.value })} /></Grid>
              </Grid>
            ) : null}
          </Section>

          <Section letter="E" title="More rooms">
            <RoomBlocksEditor blocks={rooms} onChange={setRooms} roomTypes={roomTypes} canPrice={canPrice} defaultCheckIn={start} defaultCheckOut={end > start ? end : ymd(new Date(new Date(`${start}T00:00`).getTime() + 86_400_000))} />
          </Section>

          <Section letter="F" title="Manager discount" hint={canPrice ? 'Taken off on top of any discount already given. Recorded in the audit trail.' : 'Only a manager can give a discount.'}>
            {canPrice && <TextField size="small" type="number" label="Discount (₦)" value={discount} onChange={(e) => setDiscount(e.target.value)} />}
          </Section>

          <Box>
            <TextField fullWidth size="small" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>Add to event</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddOnsDialog;
