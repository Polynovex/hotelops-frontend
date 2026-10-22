import React, { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, TextField, Typography } from '@mui/material';
import { DAMAGE_CATEGORIES, DAMAGE_LOCATIONS, checkoutApi } from '../../services/checkout';
import { getApiErrorMessage } from '../../utils/apiError';

/**
 * Report damage anywhere in the hotel. Reporting is not charging: a manager
 * assesses the cost and approves any recovery charge before the guest sees it.
 */
const DamageReportDialog: React.FC<{
  open: boolean;
  bookingId?: string | null;
  roomId?: string | null;
  roomNumber?: string | null;
  onClose: () => void;
  onReported: (reference: string) => void;
}> = ({ open, bookingId, roomId, roomNumber, onClose, onReported }) => {
  const blank = () => ({
    locationCategory: roomId ? 'GUEST_ROOM' : 'OTHER',
    specificLocation: roomNumber ? `Room ${roomNumber}` : '',
    itemDamaged: '',
    category: 'FURNITURE',
    description: '',
    occurredAt: '',
    remarks: ''
  });
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(blank());
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const incident = await checkoutApi.reportDamage({
        bookingId: bookingId ?? null,
        roomId: roomId ?? null,
        locationCategory: form.locationCategory,
        specificLocation: form.specificLocation.trim() || undefined,
        itemDamaged: form.itemDamaged.trim(),
        category: form.category,
        description: form.description.trim(),
        occurredAt: form.occurredAt ? new Date(form.occurredAt).toISOString() : undefined,
        remarks: form.remarks.trim() || undefined
      });
      onReported(incident.reference);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not report the damage'));
    } finally {
      setSaving(false);
    }
  };

  const ready = form.itemDamaged.trim().length >= 2 && form.description.trim().length >= 5;

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Record property damage</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          {error && <Grid item xs={12}><Alert severity="error">{error}</Alert></Grid>}
          <Grid item xs={12} md={6}>
            <TextField select fullWidth size="small" label="Where" value={form.locationCategory} onChange={(e) => setForm({ ...form, locationCategory: e.target.value })}>
              {DAMAGE_LOCATIONS.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth size="small" label="Exact place" placeholder="Room 204, Bar counter, Table 12…" value={form.specificLocation} onChange={(e) => setForm({ ...form, specificLocation: e.target.value })} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth size="small" label="Item damaged" placeholder="Television, wardrobe door…" value={form.itemDamaged} onChange={(e) => setForm({ ...form, itemDamaged: e.target.value })} required />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField select fullWidth size="small" label="Kind of item" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {DAMAGE_CATEGORIES.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="What happened" multiline minRows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              helperText="What is damaged and, if known, how. Say whether it is confirmed or suspected." required />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth size="small" type="datetime-local" label="When (if known)" InputLabelProps={{ shrink: true }} value={form.occurredAt} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth size="small" label="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              Nothing is charged yet. A manager assesses the repair or replacement cost and approves any charge to the guest.
            </Typography>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving || !ready}>Report damage</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DamageReportDialog;
