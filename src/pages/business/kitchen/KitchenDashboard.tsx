import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import { useSnackbar } from 'notistack';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import { useAuthStore } from '../../../store/authStore';
import { posFlow, type KitchenOverview, type KitchenStation, type TimetableEntry } from '../../../services/posFlow';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * Kitchen dashboard: production and materials, not money.
 *
 * Today's food timetable, the stations and their remark tags, the order queue,
 * and the stock the kitchen draws from — received today, used today, on hand —
 * with a quick way to log what was used.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MEALS: TimetableEntry['mealPeriod'][] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
const title = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

export default function KitchenDashboard() {
  const { enqueueSnackbar } = useSnackbar();
  const role = useAuthStore((state) => String(state.user?.role || '').toUpperCase());
  const canPlan = role === 'BUSINESS_ADMIN' || role === 'MANAGER';
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [overview, setOverview] = useState<KitchenOverview | null>(null);
  const [week, setWeek] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState<KitchenOverview['stock'][number] | null>(null);
  const [usageQty, setUsageQty] = useState('');
  const [usageNote, setUsageNote] = useState('');
  const [planning, setPlanning] = useState(false);
  const [entry, setEntry] = useState({ dayOfWeek: new Date().getDay(), mealPeriod: 'LUNCH' as TimetableEntry['mealPeriod'], dishName: '', stationCode: '' });
  const [tagging, setTagging] = useState<KitchenStation | null>(null);
  const [remark, setRemark] = useState('');

  const load = useCallback(async () => {
    try {
      const [data, timetable] = await Promise.all([posFlow.kitchenOverview(date), posFlow.timetable()]);
      setOverview(data);
      setWeek(timetable);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the kitchen dashboard'));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const logUsage = async () => {
    if (!usage) return;
    try {
      await posFlow.logUsage(usage.id, Number(usageQty), usageNote.trim() || undefined);
      enqueueSnackbar(`${usageQty} ${usage.unit} of ${usage.name} logged as used`, { variant: 'success' });
      setUsage(null);
      setUsageQty('');
      setUsageNote('');
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not log usage'), { variant: 'error' });
    }
  };

  const addEntry = async () => {
    try {
      await posFlow.addTimetableEntry({ ...entry, stationCode: entry.stationCode || undefined });
      enqueueSnackbar('Added to the timetable', { variant: 'success' });
      setEntry((current) => ({ ...current, dishName: '' }));
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not add the dish'), { variant: 'error' });
    }
  };

  const removeEntry = async (id: string) => {
    try {
      await posFlow.deleteTimetableEntry(id);
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not remove the dish'), { variant: 'error' });
    }
  };

  const setStation = async (station: KitchenStation, status: KitchenStation['status']) => {
    try {
      await posFlow.setStationStatus(station.id, status, status === 'OUT_OF_ORDER' ? remark.trim() : undefined);
      setTagging(null);
      setRemark('');
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not update the station'), { variant: 'error' });
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Kitchen</Typography>
            <Typography variant="body2" color="text.secondary">Today's menu, stations, orders and the stock the kitchen uses.</Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <TextField size="small" type="date" label="Day" value={date} onChange={(event) => setDate(event.target.value)} InputLabelProps={{ shrink: true }} />
            {canPlan && <Button variant="outlined" onClick={() => setPlanning(true)}>Plan the week</Button>}
          </Stack>
        </Stack>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {overview && (
          <>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {[
                ['In the kitchen', overview.orders.inKitchen],
                ['Ready at the pass', overview.orders.ready],
                ['Served today', overview.orders.served],
                ['Average prep time', overview.orders.averagePrepMinutes != null ? `${overview.orders.averagePrepMinutes} min` : '—']
              ].map(([label, value]) => (
                <Grid item xs={6} md={3} key={String(label)}>
                  <Card><CardContent>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="h5" fontWeight={700}>{value}</Typography>
                  </CardContent></Card>
                </Grid>
              ))}
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} lg={5}>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>{DAYS[overview.dayOfWeek]}'s food timetable</Typography>
                  {overview.timetable.map((meal) => (
                    <Box key={meal.mealPeriod} sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle2" color="text.secondary">{title(meal.mealPeriod)}</Typography>
                      {meal.entries.length === 0 ? (
                        <Typography variant="body2" color="text.disabled">Nothing planned</Typography>
                      ) : (
                        meal.entries.map((item) => (
                          <Typography key={item.id} variant="body2">
                            • {item.dishName}{item.stationCode ? ` (${item.stationCode})` : ''}{item.notes ? ` — ${item.notes}` : ''}
                          </Typography>
                        ))
                      )}
                    </Box>
                  ))}
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>Stations</Typography>
                  <Stack spacing={1}>
                    {overview.stations.length === 0 && <Typography variant="body2" color="text.secondary">No stations configured.</Typography>}
                    {overview.stations.map((station) => (
                      <Stack key={station.id} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                        <Box>
                          <Typography fontWeight={700}>{station.name}</Typography>
                          {station.remark && <Typography variant="caption" color="text.secondary">{station.remark}</Typography>}
                        </Box>
                        <Chip
                          label={station.status === 'OUT_OF_ORDER' ? 'Out of order' : 'Taking orders'}
                          color={station.status === 'OUT_OF_ORDER' ? 'error' : 'success'}
                          onClick={() => (station.status === 'OUT_OF_ORDER' ? void setStation(station, 'ACTIVE') : setTagging(station))}
                        />
                      </Stack>
                    ))}
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={12} lg={7}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>Food stock</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Item</TableCell>
                          <TableCell align="right">Received</TableCell>
                          <TableCell align="right">Used</TableCell>
                          <TableCell align="right">On hand</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {overview.stock.length === 0 && (
                          <TableRow><TableCell colSpan={5}>
                            <Typography variant="body2" color="text.secondary">
                              No items in the Kitchen, Fresh Bakery or Kitchen Stationeries inventory yet.
                            </Typography>
                          </TableCell></TableRow>
                        )}
                        {overview.stock.map((item) => (
                          <TableRow key={item.id} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{item.name}</Typography>
                              <Typography variant="caption" color="text.secondary">{item.category}</Typography>
                            </TableCell>
                            <TableCell align="right">{item.receivedToday} {item.unit}</TableCell>
                            <TableCell align="right">{item.usedToday} {item.unit}</TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={700} color={item.low ? 'error.main' : undefined}>
                                {item.currentStock} {item.unit}
                              </Typography>
                              {item.low && <Typography variant="caption" color="error.main">Reorder</Typography>}
                            </TableCell>
                            <TableCell align="right">
                              <Button size="small" onClick={() => setUsage(item)} disabled={item.currentStock <= 0}>Log usage</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          </>
        )}

        <Dialog open={Boolean(usage)} onClose={() => setUsage(null)} fullWidth maxWidth="xs">
          <DialogTitle>Log usage: {usage?.name}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField autoFocus type="number" label={`Quantity used (${usage?.unit ?? ''})`} value={usageQty} onChange={(event) => setUsageQty(event.target.value)} inputProps={{ min: 0, step: 0.01 }} helperText={`${usage?.currentStock ?? 0} on hand`} />
              <TextField label="Note (optional)" value={usageNote} onChange={(event) => setUsageNote(event.target.value)} placeholder="e.g. Lunch service" />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUsage(null)}>Cancel</Button>
            <Button variant="contained" onClick={() => void logUsage()} disabled={!(Number(usageQty) > 0)}>Log</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(tagging)} onClose={() => setTagging(null)} fullWidth maxWidth="xs">
          <DialogTitle>Mark {tagging?.name} out of order</DialogTitle>
          <DialogContent>
            <TextField autoFocus fullWidth label="Reason" value={remark} onChange={(event) => setRemark(event.target.value)} sx={{ mt: 1 }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTagging(null)}>Cancel</Button>
            <Button color="error" variant="contained" disabled={!remark.trim()} onClick={() => tagging && void setStation(tagging, 'OUT_OF_ORDER')}>Mark out of order</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={planning} onClose={() => setPlanning(false)} fullWidth maxWidth="md">
          <DialogTitle>Weekly food timetable</DialogTitle>
          <DialogContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1, mb: 2 }}>
              <TextField select size="small" label="Day" value={entry.dayOfWeek} onChange={(event) => setEntry({ ...entry, dayOfWeek: Number(event.target.value) })} sx={{ minWidth: 140 }}>
                {DAYS.map((day, index) => <MenuItem key={day} value={index}>{day}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Meal" value={entry.mealPeriod} onChange={(event) => setEntry({ ...entry, mealPeriod: event.target.value as TimetableEntry['mealPeriod'] })} sx={{ minWidth: 130 }}>
                {MEALS.map((meal) => <MenuItem key={meal} value={meal}>{title(meal)}</MenuItem>)}
              </TextField>
              <TextField size="small" label="Dish" value={entry.dishName} onChange={(event) => setEntry({ ...entry, dishName: event.target.value })} fullWidth />
              <TextField select size="small" label="Station" value={entry.stationCode} onChange={(event) => setEntry({ ...entry, stationCode: event.target.value })} sx={{ minWidth: 150 }}>
                <MenuItem value="">Any</MenuItem>
                {(overview?.stations ?? []).map((station) => <MenuItem key={station.id} value={station.code}>{station.name}</MenuItem>)}
              </TextField>
              <Button variant="contained" onClick={() => void addEntry()} disabled={!entry.dishName.trim()}>Add</Button>
            </Stack>
            <Grid container spacing={1.5}>
              {DAYS.map((day, index) => (
                <Grid item xs={12} sm={6} md={4} key={day}>
                  <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                    <Typography fontWeight={800}>{day}</Typography>
                    {week.filter((item) => item.dayOfWeek === index).map((item) => (
                      <Stack key={item.id} direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="body2">{title(item.mealPeriod)}: {item.dishName}</Typography>
                        <IconButton size="small" onClick={() => void removeEntry(item.id)} aria-label={`Remove ${item.dishName}`}><DeleteOutlineRounded fontSize="small" /></IconButton>
                      </Stack>
                    ))}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </DialogContent>
          <DialogActions><Button onClick={() => setPlanning(false)}>Done</Button></DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
}
