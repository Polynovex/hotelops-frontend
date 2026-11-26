import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography
} from '@mui/material';
import { api } from '../../services/api';

type Outlet = { id: string; name: string; type: string; isActive: boolean };

/**
 * Assigned Outlets for a POS staff member: one, several, or all. POS staff
 * can open a shift and sell only in the outlets they are assigned to. Only
 * staff with the POS Staff or F&B Manager role can be assigned; the server
 * says so for anyone else.
 */
const OutletAssignmentDialog = ({ staffId, staffName, open, onClose, onSaved }: { staffId: string; staffName: string; open: boolean; onClose: () => void; onSaved: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState(true);
  const [reason, setReason] = useState<string | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    api
      .get(`/hr/staff/${staffId}/outlets`)
      .then(({ data }) => {
        setEligible(Boolean(data.eligible));
        setReason(data.reason ?? null);
        setOutlets(data.outlets ?? []);
        setSelected((data.assigned ?? []).map((o: Outlet) => o.id));
      })
      .catch(() => setError('Could not load outlets.'))
      .finally(() => setLoading(false));
  }, [open, staffId]);

  const save = async (body: { outletIds?: string[]; all?: true }) => {
    setSaving(true);
    setError('');
    try {
      await api.put(`/hr/staff/${staffId}/outlets`, body);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not save the outlets.');
    } finally {
      setSaving(false);
    }
  };

  const active = outlets.filter((o) => o.isActive);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Assigned outlets — {staffName}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 3 }}><CircularProgress size={28} /></Stack>
        ) : !eligible ? (
          <Alert severity="warning">{reason}</Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              They can open a shift and take orders only in the outlets ticked here.
            </Typography>
            <Stack>
              {active.map((outlet) => (
                <FormControlLabel
                  key={outlet.id}
                  control={
                    <Checkbox
                      checked={selected.includes(outlet.id)}
                      onChange={(e) => setSelected((s) => (e.target.checked ? [...s, outlet.id] : s.filter((id) => id !== outlet.id)))}
                    />
                  }
                  label={outlet.name}
                />
              ))}
              {active.length === 0 && <Typography color="text.secondary">This business has no active outlets.</Typography>}
            </Stack>
          </>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {eligible && !loading && (
          <>
            <Button disabled={saving || active.length === 0} onClick={() => save({ all: true })}>Assign all outlets</Button>
            <Button variant="contained" disabled={saving} onClick={() => save({ outletIds: selected })}>Save</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default OutletAssignmentDialog;
