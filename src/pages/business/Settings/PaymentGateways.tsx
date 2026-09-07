import Layout from '../../../components/Layout';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Container, Divider,
  FormControlLabel, MenuItem, Paper, Snackbar, Stack, Switch, TextField, Typography
} from '@mui/material';
import LockRounded from '@mui/icons-material/LockRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import { api } from '../../../services/api';
import { getApiErrorMessage } from '../../../utils/apiError';

interface Gateway {
  provider: 'PAYSTACK' | 'FLUTTERWAVE';
  publicKey: string | null;
  /** Whether a secret is stored. The key itself is never sent to the client. */
  hasSecretKey: boolean;
  environment: 'TEST' | 'LIVE';
  isActive: boolean;
  updatedAt: string | null;
}

const LABELS: Record<Gateway['provider'], { name: string; publicHint: string; secretHint: string }> = {
  PAYSTACK: {
    name: 'Paystack',
    publicHint: 'Starts pk_test_ or pk_live_',
    secretHint: 'Starts sk_test_ or sk_live_'
  },
  FLUTTERWAVE: {
    name: 'Flutterwave',
    publicHint: 'Starts FLWPUBK_TEST- or FLWPUBK-',
    secretHint: 'Starts FLWSECK_TEST- or FLWSECK-'
  }
};

/**
 * Paystack and Flutterwave credentials for this property.
 *
 * This screen previously wrote both keys — including the secret — into the
 * browser's localStorage. That put live payment credentials somewhere any
 * cross-site script, browser extension or anyone with access to the machine
 * could read them, and nothing on the server ever saw them, so payments could
 * not actually be taken with them either.
 *
 * They now go to the API, where the secret is encrypted at rest and never
 * returned. This form can therefore say whether a secret is stored and let it
 * be replaced; it cannot show it, and that is deliberate.
 */
const PaymentGatewaysSettingsPage = () => {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { publicKey: string; secretKey: string; environment: string }>>({});
  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/payments/gateways');
      const rows: Gateway[] = Array.isArray(data) ? data : [];
      setGateways(rows);
      setDrafts(
        Object.fromEntries(
          rows.map((g) => [
            g.provider,
            // The secret field always starts empty: there is nothing to
            // prefill it with, and an empty submission leaves the stored key
            // untouched rather than clearing it.
            { publicKey: g.publicKey ?? '', secretKey: '', environment: g.environment }
          ])
        )
      );
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load your payment settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (gateway: Gateway, overrides: Partial<{ isActive: boolean }> = {}) => {
    const draft = drafts[gateway.provider];
    setSavingProvider(gateway.provider);
    try {
      await api.put(`/payments/gateways/${gateway.provider}`, {
        publicKey: draft.publicKey,
        secretKey: draft.secretKey,
        environment: draft.environment,
        ...overrides
      });
      setToast(`${LABELS[gateway.provider].name} saved`);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save those credentials.'));
    } finally {
      setSavingProvider(null);
    }
  };

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Payment gateways
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Connect Paystack or Flutterwave so card and transfer payments can be taken
          at the front desk, on the POS and from the guest ordering page.
        </Typography>

        {error ? (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Alert severity="info" icon={<LockRounded fontSize="inherit" />} sx={{ mb: 3 }}>
          Secret keys are encrypted before they are stored and are never sent back to
          this page. To change one, type the new key — leaving it blank keeps the key
          already saved.
        </Alert>

        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {gateways.map((gateway) => {
              const draft = drafts[gateway.provider];
              const meta = LABELS[gateway.provider];
              if (!draft) return null;

              return (
                <Paper key={gateway.provider} variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mb: 2 }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {meta.name}
                      </Typography>
                      {gateway.hasSecretKey ? (
                        <Chip
                          size="small"
                          icon={<CheckCircleRounded />}
                          color="success"
                          variant="outlined"
                          label="Key stored"
                        />
                      ) : (
                        <Chip size="small" variant="outlined" label="Not configured" />
                      )}
                      {gateway.isActive ? (
                        <Chip
                          size="small"
                          color={gateway.environment === 'LIVE' ? 'success' : 'warning'}
                          label={gateway.environment === 'LIVE' ? 'Live' : 'Test mode'}
                        />
                      ) : null}
                    </Stack>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={gateway.isActive}
                          onChange={(e) => void save(gateway, { isActive: e.target.checked })}
                          disabled={savingProvider === gateway.provider}
                        />
                      }
                      label={gateway.isActive ? 'Enabled' : 'Disabled'}
                    />
                  </Stack>

                  <Divider sx={{ mb: 2.5 }} />

                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Public key"
                      value={draft.publicKey}
                      onChange={(e) =>
                        setDrafts({
                          ...drafts,
                          [gateway.provider]: { ...draft, publicKey: e.target.value }
                        })
                      }
                      helperText={meta.publicHint}
                    />

                    <TextField
                      fullWidth
                      type="password"
                      label={gateway.hasSecretKey ? 'Replace secret key' : 'Secret key'}
                      value={draft.secretKey}
                      onChange={(e) =>
                        setDrafts({
                          ...drafts,
                          [gateway.provider]: { ...draft, secretKey: e.target.value }
                        })
                      }
                      placeholder={gateway.hasSecretKey ? '•••••••••• (unchanged)' : ''}
                      helperText={
                        gateway.hasSecretKey
                          ? 'A key is already stored. Leave blank to keep it.'
                          : meta.secretHint
                      }
                      autoComplete="off"
                    />

                    <TextField
                      select
                      fullWidth
                      label="Environment"
                      value={draft.environment}
                      onChange={(e) =>
                        setDrafts({
                          ...drafts,
                          [gateway.provider]: { ...draft, environment: e.target.value }
                        })
                      }
                      helperText="Test keys never move real money. Switch to Live only when you are ready to take payments."
                    >
                      <MenuItem value="TEST">Test</MenuItem>
                      <MenuItem value="LIVE">Live</MenuItem>
                    </TextField>

                    <Box>
                      <Button
                        variant="contained"
                        onClick={() => void save(gateway)}
                        disabled={savingProvider === gateway.provider}
                      >
                        {savingProvider === gateway.provider ? 'Saving…' : 'Save credentials'}
                      </Button>
                      {gateway.updatedAt ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: 2, display: 'inline-block' }}
                        >
                          Last updated {new Date(gateway.updatedAt).toLocaleString()}
                        </Typography>
                      ) : null}
                    </Box>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}

        <Snackbar
          open={Boolean(toast)}
          autoHideDuration={3000}
          onClose={() => setToast('')}
          message={toast}
        />
      </Container>
    </Layout>
  );
};

export default PaymentGatewaysSettingsPage;
