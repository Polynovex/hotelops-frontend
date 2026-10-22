import React, { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { hrService } from '../../services/hr.service';
import { getApiErrorMessage } from '../../utils/apiError';

const DEPARTMENTS = [
  'FRONT_DESK', 'HOUSEKEEPING', 'FOOD_BEVERAGE', 'KITCHEN', 'POS', 'SECURITY', 'MAINTENANCE', 'LAUNDRY', 'GROUNDS',
  'CONCIERGE', 'SPA_WELLNESS', 'TRANSPORT', 'EVENTS', 'FINANCE', 'HR', 'INVENTORY', 'SALES_MARKETING', 'IT', 'MANAGEMENT'
];
const humanise = (v: string) => v.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
type Row = { department: string; jobTitle: string; hourlyRate: string };

/**
 * Overtime rates per hour, so a gateman and a front-desk officer are not paid
 * the same overtime. Most specific wins: the staff member's own rate, then
 * job title, then department, then the hotel default.
 */
const OvertimeMatrixDialog: React.FC<{ open: boolean; onClose: () => void; onSaved: () => void }> = ({ open, onClose, onSaved }) => {
  const [defaultRate, setDefaultRate] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    hrService
      .overtimeMatrix()
      .then((m) => {
        setDefaultRate(m.defaultRate != null ? String(m.defaultRate) : '');
        setRows(m.rates.map((r) => ({ department: r.department ?? '', jobTitle: r.jobTitle ?? '', hourlyRate: String(r.hourlyRate) })));
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Could not load the overtime rates')));
  }, [open]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await hrService.saveOvertimeMatrix({
        defaultRate: defaultRate.trim() === '' ? null : Number(defaultRate),
        rates: rows
          .filter((r) => r.hourlyRate.trim() !== '' && (r.department || r.jobTitle.trim()))
          .map((r) => ({ department: r.department || null, jobTitle: r.jobTitle.trim() || null, hourlyRate: Number(r.hourlyRate) }))
      });
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the overtime rates'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Overtime rates</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField size="small" type="number" label="Default rate per hour (₦)" value={defaultRate} onChange={(e) => setDefaultRate(e.target.value)} helperText="Used when nothing more specific applies" />
          {rows.map((row, i) => (
            <Grid container spacing={1} key={i} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField select fullWidth size="small" label="Department" value={row.department} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, department: e.target.value } : r)))}>
                  <MenuItem value="">Any</MenuItem>
                  {DEPARTMENTS.map((d) => <MenuItem key={d} value={d}>{humanise(d)}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Job title (optional)" value={row.jobTitle} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, jobTitle: e.target.value } : r)))} /></Grid>
              <Grid item xs={10} sm={3}><TextField fullWidth size="small" type="number" label="₦ / hour" value={row.hourlyRate} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, hourlyRate: e.target.value } : r)))} /></Grid>
              <Grid item xs={2} sm={1}><IconButton size="small" aria-label="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Grid>
            </Grid>
          ))}
          <Button size="small" startIcon={<AddRoundedIcon />} sx={{ alignSelf: 'flex-start' }} onClick={() => setRows([...rows, { department: '', jobTitle: '', hourlyRate: '' }])}>Add rate</Button>
          <Typography variant="caption" color="text.secondary">
            A staff member&apos;s own overtime rate (on their record) always wins. Only HR-approved overtime is paid.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

export default OvertimeMatrixDialog;
