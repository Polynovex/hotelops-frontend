import { useEffect, useState } from 'react';
import { Alert, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { api } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';

type Rule = 'FIRST_NIGHT' | 'TWO_NIGHTS' | 'FULL_STAY';

const OPTIONS: Array<[Rule, string]> = [
  ['FIRST_NIGHT', 'The first night'],
  ['TWO_NIGHTS', 'The first two nights'],
  ['FULL_STAY', 'The whole stay']
];

/** How much a guest pays before check-in, for walk-ins and reservations alike. */
const CheckInPaymentCard = () => {
  const [rule, setRule] = useState<Rule>('FIRST_NIGHT');
  const [saved, setSaved] = useState<Rule | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.get('/checkin-policy').then(({ data }) => { setRule(data.paymentRule); setSaved(data.paymentRule); }).catch(() => undefined);
  }, []);

  const save = async () => {
    try {
      const { data } = await api.put('/checkin-policy', { paymentRule: rule });
      setSaved(data.paymentRule);
      setMessage({ kind: 'success', text: 'Saved' });
    } catch (err) {
      setMessage({ kind: 'error', text: getApiErrorMessage(err, 'Could not save') });
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Payment before check-in</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        A guest cannot be checked in until this much is paid, on the web, the desktop and the mobile app. Event rooms need the event to have paid the first night of its rooms. A manager can let a guest in without it, with a reason that is recorded.
      </Typography>
      {message && <Alert severity={message.kind} sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message.text}</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <TextField select size="small" label="Required before check-in" value={rule} onChange={(e) => setRule(e.target.value as Rule)} sx={{ minWidth: 240 }}>
          {OPTIONS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <Button variant="contained" onClick={() => void save()} disabled={rule === saved}>Save</Button>
      </Stack>
    </Paper>
  );
};

export default CheckInPaymentCard;
