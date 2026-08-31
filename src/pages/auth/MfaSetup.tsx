import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import mfaService, { type MfaSetupResponse } from '../../services/mfa.service';
import { useAuthStore } from '../../store/authStore';

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message
  ?? (err as { response?: { data?: { error?: string } } }).response?.data?.error
  ?? fallback;

/**
 * Two-factor enrolment.
 *
 * This replaces a placeholder that generated a random string in the browser and
 * never contacted the server — the "secret" it displayed could never produce a
 * working code. The secret and QR now come from the API, and enrolment is only
 * complete once the server has accepted a generated code.
 */
const MfaSetupPage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [setup, setSetup] = useState<MfaSetupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const begin = useCallback(async () => {
    setLoading(true);
    try {
      setSetup(await mfaService.setup());
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not start two-factor setup'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void begin();
  }, [begin]);

  const copyKey = async () => {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.manualEntryKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Your browser blocked clipboard access — enter the key manually.');
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await mfaService.verify(code.trim());
      if (result.recoveryCodes?.length) {
        setRecoveryCodes(result.recoveryCodes);
      } else {
        navigate('/business/dashboard');
      }
    } catch (err) {
      setError(errorMessage(err, 'That code was not accepted. Try the next one.'));
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Recovery codes: shown once, and only once ────────────────────────────
  if (recoveryCodes) {
    return (
      <Box sx={{ maxWidth: 560, mx: 'auto', p: { xs: 2, sm: 4 } }}>
        <Paper sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <CheckCircleIcon color="success" />
              <Typography variant="h5" fontWeight={700}>
                Two-factor authentication is on
              </Typography>
            </Stack>

            <Alert severity="warning">
              Save these recovery codes now. Each works once, and they are the only
              way back into your account if you lose your phone.{' '}
              <strong>They cannot be shown again.</strong>
            </Alert>

            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Stack spacing={0.5}>
                {recoveryCodes.map((entry) => (
                  <Typography key={entry} fontFamily="monospace" fontSize="1.05rem">
                    {entry}
                  </Typography>
                ))}
              </Stack>
            </Paper>

            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={() => void navigator.clipboard.writeText(recoveryCodes.join('\n'))}
            >
              Copy all codes
            </Button>

            <Divider />

            <Button
              variant="contained"
              size="large"
              disabled={!acknowledged}
              onClick={() => navigate('/business/dashboard')}
            >
              Continue
            </Button>
            <Button size="small" onClick={() => setAcknowledged(true)}>
              {acknowledged ? 'Confirmed' : 'I have saved these codes'}
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', p: { xs: 2, sm: 4 } }}>
      <Paper sx={{ p: { xs: 2.5, sm: 4 } }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Set up two-factor authentication
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Required for {user?.role?.replace(/_/g, ' ').toLowerCase() ?? 'this role'}.
              It protects the account even if the password is stolen.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {loading && (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress />
            </Stack>
          )}

          {!loading && setup && (
            <>
              <Typography variant="body2">
                1. Scan this with Google Authenticator, Authy, or 1Password.
              </Typography>

              <Box sx={{ textAlign: 'center' }}>
                <Box
                  component="img"
                  src={setup.qrDataUrl}
                  alt="Two-factor setup QR code"
                  sx={{ width: 200, height: 200, border: '1px solid', borderColor: 'divider', p: 1, borderRadius: 1 }}
                />
              </Box>

              <Box>
                <Typography variant="body2" gutterBottom>
                  Can&apos;t scan? Enter this key by hand:
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={setup.manualEntryKey}
                    sx={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                  />
                  <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => void copyKey()}>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </Stack>
              </Box>

              <Divider />

              <form onSubmit={submit}>
                <Stack spacing={2}>
                  <Typography variant="body2">
                    2. Enter the 6-digit code your app is showing.
                  </Typography>
                  <TextField
                    label="Authentication code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    fullWidth
                    autoFocus
                    autoComplete="one-time-code"
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={submitting || code.length !== 6}
                  >
                    {submitting ? 'Verifying…' : 'Turn on two-factor'}
                  </Button>
                </Stack>
              </form>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};

export default MfaSetupPage;
