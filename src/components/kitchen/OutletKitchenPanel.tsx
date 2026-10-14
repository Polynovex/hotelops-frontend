import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
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
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import { useSnackbar } from 'notistack';
import {
  posFlow,
  type KitchenProduction,
  type MenuItem as PosMenuItem,
  type Outlet,
  type ProductionLogRow,
  type TimetableEntry
} from '../../services/posFlow';
import { getApiErrorMessage } from '../../utils/apiError';

/**
 * Each outlet kitchen's own plan and production log. The dish is always
 * chosen from that outlet's active menu (a fixed reference); the number of
 * portions is what the kitchen enters, and stays editable. Each entry is
 * stamped with the shift it was made in.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MEALS: TimetableEntry['mealPeriod'][] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
const title = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

type Recording = { timetableEntryId: string | null; menuItemId: string; dishName: string; mealPeriod: TimetableEntry['mealPeriod'] };

const OutletKitchenPanel: React.FC<{ date: string; canPlan: boolean }> = ({ date, canPlan }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState('');
  const [menu, setMenu] = useState<PosMenuItem[]>([]);
  const [production, setProduction] = useState<KitchenProduction | null>(null);
  const [log, setLog] = useState<ProductionLogRow[]>([]);
  const [week, setWeek] = useState<TimetableEntry[]>([]);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState<Recording | null>(null);
  const [portions, setPortions] = useState('');
  const [wasted, setWasted] = useState('');
  const [notes, setNotes] = useState('');
  const [editing, setEditing] = useState<ProductionLogRow | null>(null);
  const [planning, setPlanning] = useState(false);
  const [entry, setEntry] = useState({ dayOfWeek: new Date().getDay(), mealPeriod: 'LUNCH' as TimetableEntry['mealPeriod'], menuItemId: '', plannedQuantity: '' });

  useEffect(() => {
    posFlow
      .outlets()
      .then((rows) => {
        setOutlets(rows);
        setOutletId((current) => current || rows[0]?.id || '');
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Could not load outlets')));
  }, []);

  const load = useCallback(async () => {
    if (!outletId) return;
    try {
      const [items, made, rows, plan] = await Promise.all([
        posFlow.menu(outletId),
        posFlow.production(date, outletId),
        posFlow.productionLog({ outletId, from: date, to: date }),
        posFlow.timetable(outletId)
      ]);
      setMenu(items.filter((item) => item.isActive));
      setProduction(made);
      setLog(rows);
      setWeek(plan);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the kitchen log'));
    }
  }, [outletId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const menuById = useMemo(() => new Map(menu.map((item) => [item.id, item])), [menu]);
  const outletName = outlets.find((o) => o.id === outletId)?.name ?? '';

  const openRecord = (value: Recording) => {
    setRecording(value);
    setPortions('');
    setWasted('');
    setNotes('');
  };

  const save = async () => {
    if (!recording) return;
    try {
      await posFlow.recordProduction({
        outletId,
        menuItemId: recording.menuItemId,
        ...(recording.timetableEntryId ? { timetableEntryId: recording.timetableEntryId } : {}),
        portions: Number(portions),
        wasted: wasted ? Number(wasted) : 0,
        notes: notes.trim() || undefined,
        date
      });
      enqueueSnackbar(`${portions} portions of ${recording.dishName || menuById.get(recording.menuItemId)?.name} recorded`, { variant: 'success' });
      setRecording(null);
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not record production'), { variant: 'error' });
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await posFlow.updateProduction(editing.id, { portions: Number(portions), wasted: wasted ? Number(wasted) : 0, notes: notes.trim() });
      enqueueSnackbar('Entry corrected', { variant: 'success' });
      setEditing(null);
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not correct the entry'), { variant: 'error' });
    }
  };

  const addPlan = async () => {
    try {
      await posFlow.addTimetableEntry({
        outletId,
        menuItemId: entry.menuItemId,
        dishName: menuById.get(entry.menuItemId)?.name ?? '',
        dayOfWeek: entry.dayOfWeek,
        mealPeriod: entry.mealPeriod,
        ...(entry.plannedQuantity ? { plannedQuantity: Number(entry.plannedQuantity), unit: 'portions' } : {})
      });
      setEntry((current) => ({ ...current, menuItemId: '', plannedQuantity: '' }));
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not add the dish'), { variant: 'error' });
    }
  };

  const removePlan = async (id: string) => {
    try {
      await posFlow.deleteTimetableEntry(id);
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not remove the dish'), { variant: 'error' });
    }
  };

  const dishSelect = (value: string, onChange: (id: string) => void, label = 'Food (from the menu)') => (
    <TextField select size="small" label={label} value={value} onChange={(e) => onChange(e.target.value)} fullWidth>
      {menu.map((item) => (
        <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
      ))}
    </TextField>
  );

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.5} sx={{ mb: 1.5 }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>Outlet kitchen production</Typography>
          <Typography variant="body2" color="text.secondary">Each outlet logs the meals it makes each day: food from its menu, number of portions.</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <TextField select size="small" label="Outlet" value={outletId} onChange={(e) => setOutletId(e.target.value)} sx={{ minWidth: 200 }}>
            {outlets.map((outlet) => <MenuItem key={outlet.id} value={outlet.id}>{outlet.name}</MenuItem>)}
          </TextField>
          <Button variant="contained" disabled={!menu.length} onClick={() => openRecord({ timetableEntryId: null, menuItemId: '', dishName: '', mealPeriod: 'LUNCH' })}>
            Log production
          </Button>
          {canPlan && <Button variant="outlined" onClick={() => setPlanning(true)} disabled={!outletId}>Plan the week</Button>}
        </Stack>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {outletId && !menu.length && <Alert severity="info" sx={{ mb: 1.5 }}>{outletName} has no active menu items yet. Add them in Menu Configuration.</Alert>}

      <Typography fontWeight={700} sx={{ mt: 1, mb: 0.5 }}>Planned vs made — {new Date(`${date}T12:00:00`).toLocaleDateString()}</Typography>
      {!production?.rows.length ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Nothing planned for {outletName || 'this outlet'} today.</Typography>
      ) : (
        <Box sx={{ overflowX: 'auto', mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Meal</TableCell>
                <TableCell>Food</TableCell>
                <TableCell align="right">Planned</TableCell>
                <TableCell align="right">Made</TableCell>
                <TableCell align="right">Wasted</TableCell>
                <TableCell align="right">Variance</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {production.rows.map((row) => (
                <TableRow key={row.timetableEntryId}>
                  <TableCell>{title(row.mealPeriod)}</TableCell>
                  <TableCell>{row.dishName}</TableCell>
                  <TableCell align="right">{row.planned ?? '—'}</TableCell>
                  <TableCell align="right">{row.produced}</TableCell>
                  <TableCell align="right">{row.wasted || '—'}</TableCell>
                  <TableCell align="right">
                    {row.variance == null ? '—' : <Chip size="small" color={row.variance < 0 ? 'warning' : row.variance > 0 ? 'info' : 'success'} label={row.variance > 0 ? `+${row.variance}` : row.variance} />}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      disabled={!(row as { menuItemId?: string | null }).menuItemId}
                      onClick={() => openRecord({ timetableEntryId: row.timetableEntryId, menuItemId: (row as { menuItemId?: string }).menuItemId ?? '', dishName: row.dishName, mealPeriod: row.mealPeriod })}
                    >
                      Record
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      <Typography fontWeight={700} sx={{ mb: 0.5 }}>Today’s production log — {outletName}</Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Food</TableCell>
              <TableCell align="right">Portions</TableCell>
              <TableCell align="right">Wasted</TableCell>
              <TableCell>Shift</TableCell>
              <TableCell>Recorded by</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {log.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.dishName}{row.notes ? <Typography variant="caption" color="text.secondary" display="block">{row.notes}</Typography> : null}</TableCell>
                <TableCell align="right"><strong>{row.portions}</strong></TableCell>
                <TableCell align="right">{row.wasted || '—'}</TableCell>
                <TableCell>
                  {row.shift
                    ? `${new Date(row.shift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${row.shift.closedAt ? new Date(row.shift.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'open'}`
                    : '—'}
                </TableCell>
                <TableCell>{row.recordedBy}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    aria-label={`Correct ${row.dishName}`}
                    onClick={() => {
                      setEditing(row);
                      setPortions(String(row.portions));
                      setWasted(row.wasted ? String(row.wasted) : '');
                      setNotes(row.notes ?? '');
                    }}
                  >
                    <EditRounded fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!log.length && (
              <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.secondary">Nothing logged yet today.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Box>

      <Dialog open={Boolean(recording)} onClose={() => setRecording(null)} fullWidth maxWidth="xs">
        <DialogTitle>Log production · {outletName}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {recording?.timetableEntryId ? (
              <Typography fontWeight={700}>{recording.dishName}</Typography>
            ) : (
              dishSelect(recording?.menuItemId ?? '', (id) => recording && setRecording({ ...recording, menuItemId: id }))
            )}
            <TextField label="Portions made" type="number" value={portions} onChange={(e) => setPortions(e.target.value)} autoFocus />
            <TextField label="Portions wasted (optional)" type="number" value={wasted} onChange={(e) => setWasted(e.target.value)} />
            <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecording(null)}>Cancel</Button>
          <Button variant="contained" disabled={!recording?.menuItemId || portions === '' || Number(portions) < 0} onClick={() => void save()}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle>Correct · {editing?.dishName}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Portions made" type="number" value={portions} onChange={(e) => setPortions(e.target.value)} autoFocus />
            <TextField label="Portions wasted" type="number" value={wasted} onChange={(e) => setWasted(e.target.value)} />
            <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" disabled={portions === '' || Number(portions) < 0} onClick={() => void saveEdit()}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={planning} onClose={() => setPlanning(false)} fullWidth maxWidth="md">
        <DialogTitle>{outletName}: weekly food timetable</DialogTitle>
        <DialogContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1, mb: 2 }}>
            <TextField select size="small" label="Day" value={entry.dayOfWeek} onChange={(e) => setEntry({ ...entry, dayOfWeek: Number(e.target.value) })} sx={{ minWidth: 140 }}>
              {DAYS.map((day, index) => <MenuItem key={day} value={index}>{day}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Meal" value={entry.mealPeriod} onChange={(e) => setEntry({ ...entry, mealPeriod: e.target.value as TimetableEntry['mealPeriod'] })} sx={{ minWidth: 130 }}>
              {MEALS.map((meal) => <MenuItem key={meal} value={meal}>{title(meal)}</MenuItem>)}
            </TextField>
            {dishSelect(entry.menuItemId, (id) => setEntry({ ...entry, menuItemId: id }), 'Food')}
            <TextField size="small" label="Portions" type="number" value={entry.plannedQuantity} onChange={(e) => setEntry({ ...entry, plannedQuantity: e.target.value })} sx={{ width: 110 }} />
            <Button variant="contained" onClick={() => void addPlan()} disabled={!entry.menuItemId}>Add</Button>
          </Stack>
          <Grid container spacing={1.5}>
            {DAYS.map((day, index) => (
              <Grid item xs={12} sm={6} md={4} key={day}>
                <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                  <Typography fontWeight={800}>{day}</Typography>
                  {week.filter((item) => item.dayOfWeek === index).map((item) => (
                    <Stack key={item.id} direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="body2">
                        {title(item.mealPeriod)}: {item.dishName}{item.plannedQuantity != null ? ` × ${item.plannedQuantity}` : ''}
                        {!item.outletId && <Typography component="span" variant="caption" color="text.secondary"> (all outlets)</Typography>}
                      </Typography>
                      <IconButton size="small" onClick={() => void removePlan(item.id)} aria-label={`Remove ${item.dishName}`}><DeleteOutlineRounded fontSize="small" /></IconButton>
                    </Stack>
                  ))}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setPlanning(false)}>Done</Button></DialogActions>
      </Dialog>
    </Paper>
  );
};

export default OutletKitchenPanel;
