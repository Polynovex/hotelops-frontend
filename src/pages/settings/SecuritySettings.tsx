import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';
import PinIcon from '@mui/icons-material/Pin';
import ShieldIcon from '@mui/icons-material/VerifiedUser';
import { useSnackbar } from 'notistack';
import Layout from '../../components/Layout';
import { useAuthStore } from '../../store/authStore';
import { pinService, describePinProblem } from '../../services/pin.service';

/**
 * One place for the three credentials a person can hold.
 *
 * These were previously scattered — password on its own route, MFA on another,
 * and the sign-in PIN with no interface at all, which meant usercode sign-in
 * could not be set up from inside the product.
 */
const SecuritySettings = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const hasPin = Boolean(user?.hasPin);
  const mfaEnabled = Boolean(user?.mfaEnabled);

  /**
   * Roles that must supply a PIN alongside their sign-in code. Mirrors
   * requiresPin in the usercode login handler.
   *
   * Everyone else signs in with the code alone — a PIN is optional hardening
   * for them, not a prerequisite. Saying otherwise would be simply untrue for
   * most staff.
   */
  const pinRequiredForRole = ['SUPER_ADMIN', 'BUSINESS_ADMIN', 'MANAGER', 'ACCOUNTANT']
    .includes(user?.role ?? '');

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pinProblem = pin ? describePinProblem(pin) : null;
  const mismatch = confirmPin.length > 0 && pin !== confirmPin;

  const submitPin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const problem = describePinProblem(pin);
    if (problem) {
      setError(problem);
      return;
    }
    if (pin !== confirmPin) {
      setError('The two PINs do not match.');
      return;
    }
    if (!password) {
      setError('Enter your account password to confirm this change.');
      return;
    }

    setSaving(true);
    try {
      await pinService.setPin(pin, password);
      // Reflected locally so the card switches to "change" without a reload.
      setUser({ hasPin: true });
      enqueueSnackbar(
        hasPin ? 'Your sign-in PIN has been changed' : 'Your sign-in PIN is set',
        { variant: 'success' }
      );
      setPin('');
      setConfirmPin('');
      setPassword('');
    } catch (err) {
      const response = (err as {
        response?: { status?: number; data?: { error?: string; message?: string } };
      }).response;

      // The server distinguishes a wrong password from a weak PIN; saying which
      // is far more useful than "could not save".
      setError(
        response?.data?.message
        ?? response?.data?.error
        ?? 'Could not set your PIN. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Security
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          How you sign in to {user?.hotelName || 'HotelOpX'}, and how that access is protected.
        </Typography>

        <Grid container spacing={3}>
          {/* ── Sign-in PIN ─────────────────────────────────────────────── */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  spacing={1}
                  sx={{ mb: 2 }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <PinIcon color="primary" />
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Sign-in PIN
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {pinRequiredForRole
                          ? 'Required alongside your sign-in code, because your role can change money and settings.'
                          : 'Optional extra step when signing in with your code at a shared terminal.'}
                      </Typography>
                    </Box>
                  </Stack>
                  <Chip
                    size="small"
                    label={hasPin ? 'Set' : 'Not set'}
                    color={hasPin ? 'success' : 'default'}
                    variant={hasPin ? 'filled' : 'outlined'}
                  />
                </Stack>

                {!hasPin && pinRequiredForRole && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Your role requires a PIN with your sign-in code. Until you set one,
                    use your email address and password to sign in.
                  </Alert>
                )}

                {!hasPin && !pinRequiredForRole && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Your sign-in code
                    {user?.userCode ? ` (${user.userCode})` : ''} works on its own today.
                    Adding a PIN means both are needed — worth doing if the terminal is
                    shared or unattended.
                  </Alert>
                )}

                {hasPin && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Signing in with your code also requires this PIN.
                  </Alert>
                )}

                <Divider sx={{ mb: 2 }} />

                {error && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                  </Alert>
                )}

                <Box component="form" onSubmit={submitPin}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label={hasPin ? 'New PIN' : 'Choose a PIN'}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        fullWidth
                        required
                        type="password"
                        inputProps={{ inputMode: 'numeric', autoComplete: 'new-password' }}
                        error={Boolean(pinProblem)}
                        helperText={pinProblem || '4 to 6 digits'}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Confirm PIN"
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        fullWidth
                        required
                        type="password"
                        inputProps={{ inputMode: 'numeric', autoComplete: 'new-password' }}
                        error={mismatch}
                        helperText={mismatch ? 'These do not match' : ' '}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Your account password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        fullWidth
                        required
                        type="password"
                        autoComplete="current-password"
                        helperText="Confirms it is really you — a signed-in session alone is not enough to set a PIN."
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={saving || Boolean(pinProblem) || mismatch || !pin || !password}
                      >
                        {saving ? 'Saving…' : hasPin ? 'Change PIN' : 'Set PIN'}
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* ── Password ────────────────────────────────────────────────── */}
          <Grid item xs={12} sm={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                  <LockResetIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Password
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Changing it signs out every other device. This one stays signed in.
                </Typography>
                <Button variant="outlined" onClick={() => navigate('/change-password')}>
                  Change password
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* ── Two-factor ──────────────────────────────────────────────── */}
          <Grid item xs={12} sm={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 1 }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <ShieldIcon color="primary" />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Two-factor
                    </Typography>
                  </Stack>
                  <Chip
                    size="small"
                    label={mfaEnabled ? 'On' : 'Off'}
                    color={mfaEnabled ? 'success' : 'default'}
                    variant={mfaEnabled ? 'filled' : 'outlined'}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  A code from your authenticator app, in addition to your password.
                  Required for owner and administrator accounts.
                </Typography>
                <Button variant="outlined" onClick={() => navigate('/mfa/setup')}>
                  {mfaEnabled ? 'Manage two-factor' : 'Turn on two-factor'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Layout>
  );
};

export default SecuritySettings;
