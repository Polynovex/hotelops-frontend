import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
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
  Tooltip,
  Typography
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import Layout from '../../../components/Layout';
import { eventsApi, type EventType, type EventTypeInput } from '../../../services/events';
import { formatCurrency } from '../../../utils/formatters';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * Event types: what the hotel hosts and where (Wedding — Banquet Hall), with
 * its price, capacity, service charge and setup buffer. A moveable type can
 * be booked at another location while keeping everything else.
 */

const blank: EventTypeInput = {
  name: '',
  description: '',
  location: '',
  capacity: null,
  isActive: true,
  price: 0,
  pricingUnit: 'PER_DAY',
  serviceChargeRate: 0,
  bufferMinutes: 0,
  moveable: false
};

const EventTypesPage: React.FC = () => {
  const [rows, setRows] = useState<EventType[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<EventType | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EventTypeInput>(blank);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await eventsApi.listTypes());
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load event types'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (row: EventType | null) => {
    setEditing(row);
    setForm(row ? { ...row, description: row.description ?? '' } : blank);
    setFormError('');
    setOpen(true);
  };

  const set = <K extends keyof EventTypeInput>(key: K, value: EventTypeInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (form.name.trim().length < 2 || form.location.trim().length < 2) {
      setFormError('Give the event type a name and a location.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form, description: form.description?.trim() || null, capacity: form.capacity || null };
      if (editing) await eventsApi.updateType(editing.id, payload);
      else await eventsApi.createType(payload);
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: EventType) => {
    if (!window.confirm(`Remove ${row.name}?${row.bookingCount ? ' It has bookings, so it will be switched off instead.' : ''}`)) return;
    try {
      await eventsApi.deleteType(row.id);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not remove it'));
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800}>Event types</Typography>
            <Typography variant="body2" color="text.secondary">
              What you host and where — banquet hall, conference hall, poolside, lakeside — with prices and capacity.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => startEdit(null)}>New event type</Button>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Event type</TableCell>
                <TableCell>Location</TableCell>
                <TableCell align="right">Capacity</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right">Service charge</TableCell>
                <TableCell align="right">Buffer</TableCell>
                <TableCell>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                    No event types yet. Add your halls and outdoor spaces to start taking event bookings.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Typography fontWeight={700} fontSize={14}>{row.name}</Typography>
                      {row.description && <Typography variant="caption" color="text.secondary">{row.description}</Typography>}
                    </TableCell>
                    <TableCell>
                      {row.location}{' '}
                      <Chip size="small" variant="outlined" label={row.moveable ? 'Moveable' : 'Fixed'} sx={{ ml: 0.5 }} />
                    </TableCell>
                    <TableCell align="right">{row.capacity ?? '—'}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(row.price)}
                      <Typography variant="caption" color="text.secondary" display="block">{row.pricingUnit === 'PER_DAY' ? 'per day' : 'per event'}</Typography>
                    </TableCell>
                    <TableCell align="right">{row.serviceChargeRate ? `${row.serviceChargeRate}%` : '—'}</TableCell>
                    <TableCell align="right">{row.bufferMinutes ? `${row.bufferMinutes} min` : '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" color={row.isActive ? 'success' : 'default'} label={row.isActive ? 'Available' : 'Unavailable'} />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => startEdit(row)}><EditRoundedIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Remove"><IconButton size="small" onClick={() => void remove(row)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>

        <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontWeight: 800 }}>{editing ? 'Edit event type' : 'New event type'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {formError && <Grid item xs={12}><Alert severity="error">{formError}</Alert></Grid>}
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Event type name" placeholder="Banquet Hall" value={form.name} onChange={(e) => set('name', e.target.value)} required />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Venue / location" placeholder="Main banquet hall, ground floor" value={form.location} onChange={(e) => set('location', e.target.value)} required />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Description" placeholder="Weddings, receptions and formal gatherings" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} multiline minRows={2} />
              </Grid>
              <Grid item xs={6} md={4}>
                <TextField fullWidth size="small" type="number" label="Price" value={form.price} onChange={(e) => set('price', Number(e.target.value))} />
              </Grid>
              <Grid item xs={6} md={4}>
                <TextField select fullWidth size="small" label="Charged" value={form.pricingUnit} onChange={(e) => set('pricingUnit', e.target.value as EventTypeInput['pricingUnit'])}>
                  <MenuItem value="PER_DAY">Per day</MenuItem>
                  <MenuItem value="PER_EVENT">Per event</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6} md={4}>
                <TextField fullWidth size="small" type="number" label="Capacity (guests)" value={form.capacity ?? ''} onChange={(e) => set('capacity', e.target.value === '' ? null : Number(e.target.value))} />
              </Grid>
              <Grid item xs={6} md={6}>
                <TextField fullWidth size="small" type="number" label="Service charge (%)" value={form.serviceChargeRate} onChange={(e) => set('serviceChargeRate', Number(e.target.value))} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" type="number" label="Setup / cleanup buffer (minutes)" value={form.bufferMinutes} onChange={(e) => set('bufferMinutes', Number(e.target.value))} helperText="Kept free before and after each event" />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Switch checked={form.moveable} onChange={(e) => set('moveable', e.target.checked)} />}
                  label="Moveable — a booking can choose another location and keep this price and setup"
                />
                <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />} label="Available for booking" />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Discounts for event types are set up under Promotions → Event promotions. VAT uses the hotel&apos;s VAT rate.
                </Typography>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="contained" onClick={() => void save()} disabled={saving}>Save</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default EventTypesPage;
