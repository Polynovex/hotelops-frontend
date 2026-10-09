import { FormEvent, useEffect, useState } from 'react';
import { Alert, Box, Button, Container, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import { api } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { getApiErrorMessage } from '../../../utils/apiError';
import { SettingsTabs } from './SettingsTabs';

/** Common choices; anything in range can still be typed. */
const PRESETS = [5, 10, 15, 30, 60, 120];

/**
 * Session policy: how long a signed-in screen may sit idle before it signs
 * itself out. Applies to every account in the business.
 */
export default function SessionPolicyPage() {
  const { enqueueSnackbar } = useSnackbar();
  const setUser = useAuthStore((state) => state.setUser);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [minutes, setMinutes] = useState(15);
  const [bounds, setBounds] = useState({ min: 5, max: 240 });

  useEffect(() => {
    api
      .get('/settings/security')
      .then(({ data }) => {
        setMinutes(Number(data.idleTimeoutMinutes) || 15);
        setBounds({ min: Number(data.minIdleTimeoutMinutes) || 5, max: Number(data.maxIdleTimeoutMinutes) || 240 });
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Could not load security settings.')))
      .finally(() => setLoading(false));
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put('/settings/security', { idleTimeoutMinutes: minutes });
      // Takes effect here immediately; other staff pick it up on their next sync.
      setUser({ idleTimeoutMinutes: data.idleTimeoutMinutes });
      enqueueSnackbar('Security settings saved', { variant: 'success' });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save security settings.'));
    } finally {
      setSaving(false);
    }
  };

  const outOfRange = !Number.isInteger(minutes) || minutes < bounds.min || minutes > bounds.max;

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <SettingsTabs />
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Security
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Signs staff out automatically when a screen is left unattended.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <LogoLoader inline minHeight={160} />
        ) : (
          <Paper sx={{ p: 3 }}>
            <Box component="form" onSubmit={save}>
              <Stack spacing={2}>
                <TextField
                  select
                  label="Quick choice"
                  value={PRESETS.includes(minutes) ? minutes : ''}
                  onChange={(event) => setMinutes(Number(event.target.value))}
                >
                  {PRESETS.map((value) => (
                    <MenuItem key={value} value={value}>
                      {value < 60 ? `${value} minutes` : `${value / 60} hour${value === 60 ? '' : 's'}`}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Sign out after (minutes of inactivity)"
                  type="number"
                  value={minutes}
                  onChange={(event) => setMinutes(Number(event.target.value))}
                  inputProps={{ min: bounds.min, max: bounds.max, step: 1 }}
                  error={outOfRange}
                  helperText={`Between ${bounds.min} and ${bounds.max} minutes. Staff see a one-minute warning first.`}
                />
                <Box>
                  <Button type="submit" variant="contained" disabled={saving || outOfRange}>
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </Box>
              </Stack>
            </Box>
          </Paper>
        )}
      </Container>
    </Layout>
  );
}
