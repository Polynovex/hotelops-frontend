import { useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Radio,
  RadioGroup, Stack, TextField, Typography
} from '@mui/material';
import { api } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';

type Business = { id: string; name: string; businessName?: string | null; email: string; status?: string };

/**
 * Write to businesses at the email they registered with: all of them, or the
 * ones picked from the search. Each email opens with the business's name.
 */
const EmailBusinessesDialog = ({
  open,
  onClose,
  businesses,
  preselect
}: {
  open: boolean;
  onClose: () => void;
  businesses: Business[];
  preselect?: Business | null;
}) => {
  const [scope, setScope] = useState<'ALL' | 'SELECTED'>('ALL');
  const [picked, setPicked] = useState<Business[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ recipients: number; sent: number; failed: Array<{ name: string; error: string }> } | null>(null);

  useEffect(() => {
    if (!open) return;
    setScope(preselect ? 'SELECTED' : 'ALL');
    setPicked(preselect ? [preselect] : []);
    setSubject('');
    setMessage('');
    setError('');
    setResult(null);
  }, [open, preselect]);

  const live = businesses.filter((b) => b.status !== 'DELETED');
  const label = (b: Business) => `${b.businessName || b.name} · ${b.email}`;

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/admin/businesses/email', {
        subject: subject.trim(),
        message: message.trim(),
        scope,
        ...(scope === 'SELECTED' ? { businessIds: picked.map((b) => b.id) } : {})
      });
      setResult(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send the email'));
    } finally {
      setBusy(false);
    }
  };

  const ready = subject.trim().length >= 3 && message.trim().length >= 5 && (scope === 'ALL' || picked.length > 0);

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Email businesses</DialogTitle>
      <DialogContent>
        {result ? (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Alert severity={result.failed.length ? 'warning' : 'success'}>
              Sent to {result.sent} of {result.recipients} business{result.recipients === 1 ? '' : 'es'}.
            </Alert>
            {result.failed.map((f) => (
              <Typography key={f.name} variant="body2" color="error">{f.name}: {f.error}</Typography>
            ))}
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <RadioGroup row value={scope} onChange={(e) => setScope(e.target.value as 'ALL' | 'SELECTED')}>
              <FormControlLabel value="ALL" control={<Radio />} label={`All businesses (${live.length})`} />
              <FormControlLabel value="SELECTED" control={<Radio />} label="Chosen businesses" />
            </RadioGroup>
            {scope === 'SELECTED' && (
              <Autocomplete
                multiple
                options={live}
                value={picked}
                onChange={(_e, value) => setPicked(value)}
                getOptionLabel={label}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderInput={(params) => <TextField {...params} label="Search businesses" placeholder="Name or email" />}
              />
            )}
            <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth />
            <TextField label="Message" value={message} onChange={(e) => setMessage(e.target.value)} fullWidth multiline minRows={6} helperText="Starts with “Dear <business name>,” and ends with “The HotelOpX team”." />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>{result ? 'Close' : 'Cancel'}</Button>
        {!result && (
          <Button variant="contained" onClick={() => void send()} disabled={busy || !ready}>
            {busy ? 'Sending…' : scope === 'ALL' ? `Send to all ${live.length}` : `Send to ${picked.length}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EmailBusinessesDialog;
