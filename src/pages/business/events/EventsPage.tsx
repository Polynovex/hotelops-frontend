import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import Layout from '../../../components/Layout';
import { usePermissionStore } from '../../../store/permissionStore';
import {
  EVENT_STATUS_COLOR,
  EVENT_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  eventsApi,
  type EventBooking,
  type EventStatus
} from '../../../services/events';
import { formatCurrency } from '../../../utils/formatters';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * Banquet / Event: the event calendar and the booking list. Days with an
 * event are marked; clicking one opens the events on that day and every date
 * each of them covers.
 */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** The local calendar days an event touches. */
export const eventDates = (event: Pick<EventBooking, 'startAt' | 'endAt'>) => {
  const days: Date[] = [];
  const last = startOfDay(new Date(event.endAt));
  for (let d = startOfDay(new Date(event.startAt)); d <= last && days.length < 400; d = addDays(d, 1)) days.push(d);
  return days;
};

export const StatusChip: React.FC<{ status: EventStatus }> = ({ status }) => (
  <Chip
    size="small"
    label={EVENT_STATUS_LABEL[status]}
    sx={{ fontWeight: 700, color: EVENT_STATUS_COLOR[status], bgcolor: alpha(EVENT_STATUS_COLOR[status], 0.12) }}
  />
);

const EventsPage: React.FC = () => {
  const navigate = useNavigate();
  const can = usePermissionStore((state) => state.can);
  const canManage = can('MANAGE_EVENTS');
  const canPrice = can('EVENT_PRICING');

  const [tab, setTab] = useState<'calendar' | 'list'>('calendar');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [events, setEvents] = useState<EventBooking[]>([]);
  const [list, setList] = useState<EventBooking[]>([]);
  const [status, setStatus] = useState<EventStatus | ''>('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<Date | null>(null);

  // Grid: Monday-first weeks covering the month.
  const grid = useMemo(() => {
    const first = month;
    const lead = (first.getDay() + 6) % 7;
    const start = addDays(first, -lead);
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const weeks = Math.ceil((lead + daysInMonth) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
  }, [month]);

  const loadMonth = useCallback(async () => {
    try {
      const from = grid[0];
      const to = addDays(grid[grid.length - 1], 1);
      setEvents((await eventsApi.list({ from: from.toISOString(), to: to.toISOString() })).filter((e) => e.status !== 'CANCELLED'));
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load events'));
    }
  }, [grid]);

  const loadList = useCallback(async () => {
    try {
      setList(await eventsApi.list({ ...(status ? { status } : {}), ...(q.trim() ? { q: q.trim() } : {}) }));
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load events'));
    }
  }, [status, q]);

  useEffect(() => {
    if (tab === 'calendar') void loadMonth();
  }, [tab, loadMonth]);

  useEffect(() => {
    if (tab !== 'list') return;
    const timer = window.setTimeout(() => void loadList(), 300);
    return () => window.clearTimeout(timer);
  }, [tab, loadList]);

  const byDay = useMemo(() => {
    const map = new Map<string, EventBooking[]>();
    for (const event of events) {
      for (const d of eventDates(event)) {
        const key = d.toDateString();
        map.set(key, [...(map.get(key) ?? []), event]);
      }
    }
    return map;
  }, [events]);

  const pickedEvents = picked ? byDay.get(picked.toDateString()) ?? [] : [];
  const today = startOfDay(new Date());

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800}>Banquet / Event</Typography>
            <Typography variant="body2" color="text.secondary">
              Conferences, meetings, banquets, weddings and outdoor functions — the venue, rooms, catering and invoice in one booking.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            {canPrice && <Button variant="outlined" onClick={() => navigate('/business/events/types')}>Event types</Button>}
            {canManage && (
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate('/business/events/new')}>
                Create new event
              </Button>
            )}
          </Stack>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="calendar" label="Calendar" />
          <Tab value="list" label="All events" />
        </Tabs>

        {tab === 'calendar' ? (
          <Paper variant="outlined" sx={{ borderRadius: 2, p: { xs: 1, md: 2 } }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <IconButton onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeftRoundedIcon /></IconButton>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h6" fontWeight={800}>{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</Typography>
                <Button size="small" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</Button>
              </Stack>
              <IconButton onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRightRoundedIcon /></IconButton>
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.5 }}>
              {WEEKDAYS.map((d) => (
                <Typography key={d} variant="caption" fontWeight={700} color="text.secondary" textAlign="center" sx={{ py: 0.5 }}>{d}</Typography>
              ))}
              {grid.map((d) => {
                const dayEvents = byDay.get(d.toDateString()) ?? [];
                const inMonth = d.getMonth() === month.getMonth();
                const has = dayEvents.length > 0;
                const lead = has ? EVENT_STATUS_COLOR[dayEvents[0].status] : undefined;
                return (
                  <Box
                    key={d.toISOString()}
                    role={has ? 'button' : undefined}
                    tabIndex={has ? 0 : -1}
                    onClick={() => has && setPicked(d)}
                    onKeyDown={(e) => has && (e.key === 'Enter' || e.key === ' ') && setPicked(d)}
                    sx={{
                      minHeight: { xs: 52, md: 92 },
                      p: 0.75,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: sameDay(d, today) ? 'primary.main' : 'divider',
                      bgcolor: has ? alpha(lead!, 0.1) : 'transparent',
                      opacity: inMonth ? 1 : 0.45,
                      cursor: has ? 'pointer' : 'default',
                      overflow: 'hidden',
                      '&:hover': has ? { bgcolor: alpha(lead!, 0.18) } : undefined
                    }}
                  >
                    <Typography variant="caption" fontWeight={has ? 800 : 500}>{d.getDate()}</Typography>
                    <Stack spacing={0.25} sx={{ mt: 0.25, display: { xs: 'none', md: 'flex' } }}>
                      {dayEvents.slice(0, 2).map((e) => (
                        <Box key={e.id} sx={{ px: 0.5, borderRadius: 0.75, bgcolor: EVENT_STATUS_COLOR[e.status], color: '#fff', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {e.eventName}
                        </Box>
                      ))}
                      {dayEvents.length > 2 && <Typography variant="caption" color="text.secondary">+{dayEvents.length - 2} more</Typography>}
                    </Stack>
                    {has && (
                      <Stack direction="row" spacing={0.25} sx={{ mt: 0.25, display: { xs: 'flex', md: 'none' } }}>
                        {dayEvents.slice(0, 3).map((e) => <Box key={e.id} sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: EVENT_STATUS_COLOR[e.status] }} />)}
                      </Stack>
                    )}
                  </Box>
                );
              })}
            </Box>

            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
              {(['PENDING', 'QUOTATION_SENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'DRAFT'] as EventStatus[]).map((s) => (
                <Stack key={s} direction="row" spacing={0.5} alignItems="center">
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: EVENT_STATUS_COLOR[s] }} />
                  <Typography variant="caption">{EVENT_STATUS_LABEL[s]}</Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ borderRadius: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ p: 2 }}>
              <TextField size="small" label="Search" placeholder="Reference, event, contact or company" value={q} onChange={(e) => setQ(e.target.value)} sx={{ flex: 1 }} />
              <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value as EventStatus | '')} sx={{ minWidth: 180 }}>
                <MenuItem value="">All</MenuItem>
                {(Object.keys(EVENT_STATUS_LABEL) as EventStatus[]).map((s) => <MenuItem key={s} value={s}>{EVENT_STATUS_LABEL[s]}</MenuItem>)}
              </TextField>
            </Stack>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Reference</TableCell>
                    <TableCell>Event</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>Dates</TableCell>
                    <TableCell align="right">Guests</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Payment</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow><TableCell colSpan={9} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No events found.</TableCell></TableRow>
                  ) : (
                    list.map((e) => (
                      <TableRow key={e.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/business/events/${e.id}`)}>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{e.reference}</TableCell>
                        <TableCell>
                          <Typography fontSize={14} fontWeight={700}>{e.eventName}</Typography>
                          <Typography variant="caption" color="text.secondary">{e.eventTypeName} · {e.location}</Typography>
                        </TableCell>
                        <TableCell>
                          {e.contactName}
                          {e.organization && <Typography variant="caption" color="text.secondary" display="block">{e.organization}</Typography>}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {fmtDay(new Date(e.startAt))}
                          {!sameDay(new Date(e.startAt), new Date(e.endAt)) && ` – ${fmtDay(new Date(e.endAt))}`}
                        </TableCell>
                        <TableCell align="right">{e.expectedGuests}</TableCell>
                        <TableCell><StatusChip status={e.status} /></TableCell>
                        <TableCell>{PAYMENT_STATUS_LABEL[e.paymentStatus]}</TableCell>
                        <TableCell align="right">{formatCurrency(e.total)}</TableCell>
                        <TableCell align="right">{formatCurrency(e.balance)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>
          </Paper>
        )}

        <Dialog open={Boolean(picked)} onClose={() => setPicked(null)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontWeight: 800, pr: 6 }}>
            {picked?.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            <IconButton onClick={() => setPicked(null)} sx={{ position: 'absolute', right: 8, top: 8 }} aria-label="Close"><CloseRoundedIcon /></IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.5}>
              {pickedEvents.map((e) => {
                const dates = eventDates(e);
                return (
                  <Paper
                    key={e.id}
                    variant="outlined"
                    onClick={() => navigate(`/business/events/${e.id}`)}
                    sx={{ p: 1.5, borderRadius: 2, cursor: 'pointer', borderLeft: `4px solid ${EVENT_STATUS_COLOR[e.status]}`, '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box>
                        <Typography fontWeight={800}>{e.eventName}</Typography>
                        <Typography variant="caption" color="text.secondary">{e.reference} · {e.eventTypeName} · {e.location}</Typography>
                      </Box>
                      <StatusChip status={e.status} />
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {fmtDateTime(e.startAt)} → {fmtDateTime(e.endAt)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {dates.length} day{dates.length === 1 ? '' : 's'}:
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                      {dates.map((d) => (
                        <Chip
                          key={d.toISOString()}
                          size="small"
                          label={fmtDay(d)}
                          variant="outlined"
                          sx={picked && sameDay(d, picked) ? { bgcolor: EVENT_STATUS_COLOR[e.status], borderColor: EVENT_STATUS_COLOR[e.status], color: '#fff', fontWeight: 700 } : undefined}
                        />
                      ))}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      {e.contactName}{e.organization ? ` · ${e.organization}` : ''} · {e.expectedGuests} guests
                    </Typography>
                  </Paper>
                );
              })}
            </Stack>
          </DialogContent>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default EventsPage;
