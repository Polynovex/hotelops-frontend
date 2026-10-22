import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
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
  TextField,
  Typography
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { hrService } from '../../services/hr.service';
import { getApiErrorMessage } from '../../utils/apiError';

type ShiftDef = { name: string; start: string; end: string; minStaff: number };
type DeptDef = { department: string; shifts: ShiftDef[] };

const DEPARTMENTS = [
  'FRONT_DESK', 'HOUSEKEEPING', 'FOOD_BEVERAGE', 'KITCHEN', 'POS', 'SECURITY', 'MAINTENANCE', 'LAUNDRY', 'GROUNDS',
  'CONCIERGE', 'SPA_WELLNESS', 'TRANSPORT', 'EVENTS', 'FINANCE', 'HR', 'INVENTORY', 'SALES_MARKETING', 'IT', 'MANAGEMENT'
];
const humanise = (v: string) => v.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
const DEFAULT_SHIFTS: ShiftDef[] = [
  { name: 'Morning', start: '07:00', end: '15:00', minStaff: 1 },
  { name: 'Evening', start: '15:00', end: '23:00', minStaff: 1 },
  { name: 'Night', start: '23:00', end: '07:00', minStaff: 1 }
];
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Generate the rota department by department: each department's shifts and
 * how many people each needs at least. Everyone in the department gets one
 * shift a day, rotating so nobody is always on nights. Shifts can be edited
 * on the rota afterwards.
 */
const GenerateRotaDialog: React.FC<{ open: boolean; onClose: () => void; onDone: (message: string) => void }> = ({ open, onClose, onDone }) => {
  const [from, setFrom] = useState(iso(new Date()));
  const [to, setTo] = useState(iso(new Date(Date.now() + 6 * 86_400_000)));
  const [departments, setDepartments] = useState<DeptDef[]>([]);
  const [replace, setReplace] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setWarnings([]);
    hrService
      .rotaTemplate()
      .then((template) => setDepartments(template.length ? template : [{ department: 'FRONT_DESK', shifts: DEFAULT_SHIFTS.map((s) => ({ ...s })) }]))
      .catch(() => setDepartments([{ department: 'FRONT_DESK', shifts: DEFAULT_SHIFTS.map((s) => ({ ...s })) }]));
  }, [open]);

  const updateShift = (d: number, i: number, patch: Partial<ShiftDef>) =>
    setDepartments((list) => list.map((dept, di) => (di !== d ? dept : { ...dept, shifts: dept.shifts.map((s, si) => (si === i ? { ...s, ...patch } : s)) })));

  const generate = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await hrService.generateRota({ from, to, departments, replace, saveTemplate: true });
      if (result.warnings.length) setWarnings(result.warnings);
      onDone(`${result.created} shift${result.created === 1 ? '' : 's'} created.${result.warnings.length ? ` ${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}.` : ''}`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not generate the rota'));
    } finally {
      setSaving(false);
    }
  };

  const used = new Set(departments.map((d) => d.department));

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle sx={{ fontWeight: 800 }}>Generate shifts</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {warnings.length > 0 && <Alert severity="warning">{warnings.slice(0, 6).join(' · ')}{warnings.length > 6 ? ' …' : ''}</Alert>}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} inputProps={{ min: from }} value={to} onChange={(e) => setTo(e.target.value)} />
          </Stack>
          {departments.map((dept, d) => (
            <Paper key={`${dept.department}-${d}`} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <TextField select size="small" label="Department" value={dept.department} sx={{ minWidth: 220 }}
                  onChange={(e) => setDepartments((list) => list.map((x, i) => (i === d ? { ...x, department: e.target.value } : x)))}>
                  {DEPARTMENTS.filter((name) => name === dept.department || !used.has(name)).map((name) => <MenuItem key={name} value={name}>{humanise(name)}</MenuItem>)}
                </TextField>
                <Box sx={{ flex: 1 }} />
                <IconButton size="small" aria-label="Remove department" onClick={() => setDepartments((list) => list.filter((_, i) => i !== d))}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
              </Stack>
              <Stack spacing={1}>
                {dept.shifts.map((shift, i) => (
                  <Grid container spacing={1} key={i} alignItems="center">
                    <Grid item xs={12} sm={3}><TextField fullWidth size="small" label="Shift" value={shift.name} onChange={(e) => updateShift(d, i, { name: e.target.value })} /></Grid>
                    <Grid item xs={4} sm={2.5}><TextField fullWidth size="small" type="time" label="Starts" InputLabelProps={{ shrink: true }} value={shift.start} onChange={(e) => updateShift(d, i, { start: e.target.value })} /></Grid>
                    <Grid item xs={4} sm={2.5}><TextField fullWidth size="small" type="time" label="Ends" InputLabelProps={{ shrink: true }} value={shift.end} onChange={(e) => updateShift(d, i, { end: e.target.value })} /></Grid>
                    <Grid item xs={3} sm={3}><TextField fullWidth size="small" type="number" label="At least" inputProps={{ min: 1 }} value={shift.minStaff} onChange={(e) => updateShift(d, i, { minStaff: Math.max(Number(e.target.value) || 1, 1) })} /></Grid>
                    <Grid item xs={1} sm={1}>
                      <IconButton size="small" aria-label="Remove shift" disabled={dept.shifts.length === 1}
                        onClick={() => setDepartments((list) => list.map((x, di) => (di === d ? { ...x, shifts: x.shifts.filter((_, si) => si !== i) } : x)))}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                    </Grid>
                  </Grid>
                ))}
                <Button size="small" startIcon={<AddRoundedIcon />} sx={{ alignSelf: 'flex-start' }}
                  onClick={() => setDepartments((list) => list.map((x, di) => (di === d ? { ...x, shifts: [...x.shifts, { name: 'Shift', start: '09:00', end: '17:00', minStaff: 1 }] } : x)))}>Add shift</Button>
              </Stack>
            </Paper>
          ))}
          <Button startIcon={<AddRoundedIcon />} sx={{ alignSelf: 'flex-start' }} disabled={used.size >= DEPARTMENTS.length}
            onClick={() => setDepartments((list) => [...list, { department: DEPARTMENTS.find((name) => !used.has(name))!, shifts: DEFAULT_SHIFTS.slice(0, 2).map((s) => ({ ...s })) }])}>
            Add department
          </Button>
          <FormControlLabel control={<Checkbox checked={replace} onChange={(e) => setReplace(e.target.checked)} />} label="Replace shifts already planned in these dates (worked shifts are kept)" />
          <Typography variant="caption" color="text.secondary">
            Everyone active in a department gets one shift a day; staff on approved leave are left off. A shift that ends before it starts runs overnight.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Close</Button>
        <Button variant="contained" onClick={() => void generate()} disabled={saving || !departments.length}>Generate</Button>
      </DialogActions>
    </Dialog>
  );
};

export default GenerateRotaDialog;
