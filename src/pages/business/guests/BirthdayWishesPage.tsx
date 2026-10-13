import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import Layout from '../../../components/Layout';
import { api } from '../../../services/api';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * Automatic birthday wishes. Staff get an email and an in-app message (and
 * their managers a heads-up); guests get the hotel's usual channel —
 * WhatsApp, SMS or email. Each person is greeted once a year.
 */

type Settings = { staff: boolean; guests: boolean; sendHour: number };
type Greeting = { id: string; kind: 'STAFF' | 'GUEST'; personId: string; channels: string[]; sentAt: string };

const BirthdayWishesPage: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({ staff: true, guests: true, sendHour: 8 });
  const [recent, setRecent] = useState<Greeting[]>([]);
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({});

  const load = () =>
    api
      .get<Settings & { recent: Greeting[] }>('/settings/birthdays')
      .then(({ data }) => {
        setSettings({ staff: data.staff, guests: data.guests, sendHour: data.sendHour });
        setRecent(data.recent);
      })
      .catch((err) => setStatus({ error: getApiErrorMessage(err, 'Could not load birthday settings') }));

  useEffect(() => {
    void load();
  }, []);

  const save = async (next: Settings) => {
    setSettings(next);
    try {
      await api.put('/settings/birthdays', next);
      setStatus({ ok: 'Saved' });
    } catch (err) {
      setStatus({ error: getApiErrorMessage(err, 'Could not save') });
    }
  };

  const runNow = async () => {
    try {
      const { data } = await api.post<{ staff: number; guests: number }>('/settings/birthdays/run');
      setStatus({ ok: `Sent ${data.staff} staff and ${data.guests} guest wish${data.staff + data.guests === 1 ? '' : 'es'} for today.` });
      void load();
    } catch (err) {
      setStatus({ error: getApiErrorMessage(err, 'Could not send') });
    }
  };

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography variant="h4" fontWeight={800}>Birthday wishes</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Staff and guests are wished a happy birthday automatically, once a year, from their date of birth on file.
        </Typography>
        {status.ok && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setStatus({})}>{status.ok}</Alert>}
        {status.error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setStatus({})}>{status.error}</Alert>}

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 2 }}>
          <Stack spacing={1.5}>
            <FormControlLabel
              control={<Switch checked={settings.staff} onChange={(e) => void save({ ...settings, staff: e.target.checked })} />}
              label="Wish staff (email and in-app; managers are told too)"
            />
            <FormControlLabel
              control={<Switch checked={settings.guests} onChange={(e) => void save({ ...settings, guests: e.target.checked })} />}
              label="Wish guests (WhatsApp, SMS or email, as configured for messages)"
            />
            <TextField
              select
              size="small"
              label="Send at (hotel time)"
              value={settings.sendHour}
              onChange={(e) => void save({ ...settings, sendHour: Number(e.target.value) })}
              sx={{ maxWidth: 220 }}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <MenuItem key={hour} value={hour}>{`${String(hour).padStart(2, '0')}:00`}</MenuItem>
              ))}
            </TextField>
            <Box>
              <Button variant="outlined" onClick={() => void runNow()}>Send today's wishes now</Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Safe to press again — nobody is wished twice in a year.
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography fontWeight={800} sx={{ mb: 1 }}>Sent in the last day</Typography>
          {recent.length === 0 ? (
            <Typography variant="body2" color="text.secondary">None yet today.</Typography>
          ) : (
            <Stack spacing={1}>
              {recent.map((row) => (
                <Stack key={row.id} direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={row.kind === 'STAFF' ? 'Staff' : 'Guest'} />
                  <Typography variant="body2">{new Date(row.sentAt).toLocaleTimeString()}</Typography>
                  <Typography variant="caption" color="text.secondary">{row.channels.join(', ') || 'no channel reached'}</Typography>
                </Stack>
              ))}
            </Stack>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Add staff dates of birth on their HR profile, and guests' on their guest profile.
          </Typography>
        </Paper>
      </Container>
    </Layout>
  );
};

export default BirthdayWishesPage;
