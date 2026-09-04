import React, { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import { BadgeOutlined, LockOutlined, MailOutline } from '@mui/icons-material';
import { useAuthStore } from '../../store/authStore';
import { authService, UserRole } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';

type LoginMode = 'USERCODE' | 'PASSWORD';

const routeForRole = (role: UserRole) => {
  if (role === 'SUPER_ADMIN') return '/super-admin/dashboard';
  if (role === 'BUSINESS_ADMIN' || role === 'MANAGER') return '/business/dashboard';
  return '/shift';
};

const UserCodeLogin: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState<LoginMode>('USERCODE');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [pinRequired, setPinRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Offers the way forward when this sign-in method is unavailable. */
  const [needsEmailLogin, setNeedsEmailLogin] = useState(false);

  /**
   * Accepts an optional form event so the same handler serves both the button
   * click and a native form submit (Enter key). Without a <form>, Enter did
   * nothing at all on this page.
   */
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'USERCODE') {
        const result = await authService.userCodeLogin(identifier, pin || undefined);
        if ('requiresPin' in result) {
          // Backend says PIN required — show field and focus it
          setPinRequired(true);
          setLoading(false);
          return;
        }
        setAuth(result.user, result.token, result.refreshToken);
        navigate(routeForRole(result.user.role));
      } else {
        const result = await authService.login(identifier, password);
        setAuth(result.user, result.token, result.refreshToken);
        navigate(routeForRole(result.user.role));
      }
    } catch (e: any) {
      const code = e?.response?.data?.error;
      const msg: Record<string, string> = {
        LOCKED: 'Account temporarily locked. Try again later.',
        MODULE_DISABLED: 'This module is disabled for your hotel.',
        // The server no longer adopts whatever PIN is first submitted, so an
        // account without one cannot be signed into this way. Say what to do
        // rather than leaving "login failed" as the only clue.
        PIN_NOT_SET:
          'No PIN has been set for this code yet. Sign in with your email and '
          + 'password, then set a PIN under Security.'
      };
      setError(msg[code] || getApiErrorMessage(e, 'Login failed'));
      setNeedsEmailLogin(code === 'PIN_NOT_SET');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      minHeight="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      sx={{
        // Was hard-coded #FFFFFF, which left light-grey secondary text on a
        // white ground in dark mode. Reads from the theme in both modes now.
        bgcolor: 'background.default',
        py: 4
      }}
    >
      <Container maxWidth="xs">
        <Stack alignItems="center" mb={3}>
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: 0.5 }}>
            HotelOpX
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Sign in to your workspace
          </Typography>
        </Stack>

        <Card elevation={3} sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <ToggleButtonGroup
              fullWidth
              exclusive
              size="small"
              value={mode}
              onChange={(_e, v) => {
                if (!v) return;
                setMode(v);
                setError(null);
                setPinRequired(false);
              }}
              sx={{ mb: 2 }}
            >
              <ToggleButton value="USERCODE">
                <BadgeOutlined fontSize="small" sx={{ mr: 1 }} /> Usercode
              </ToggleButton>
              <ToggleButton value="PASSWORD">
                <MailOutline fontSize="small" sx={{ mr: 1 }} /> Email
              </ToggleButton>
            </ToggleButtonGroup>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
          {needsEmailLogin && (
            <Button
              fullWidth
              variant="outlined"
              sx={{ mt: 1 }}
              onClick={() => navigate('/login')}
            >
              Sign in with email instead
            </Button>
          )}

            <Stack component="form" onSubmit={submit} spacing={2}>
              {mode === 'USERCODE' ? (
                <TextField
                  autoFocus
                  fullWidth
                  label="Usercode"
                  placeholder="•••••"
                  type="password"
                  value={identifier}
                  onChange={(e) => {
                    setPinRequired(false);
                    setIdentifier(e.target.value.replace(/\D/g, '').slice(0, 6));
                  }}
                  inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <BadgeOutlined fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                />
              ) : (
                <TextField
                  autoFocus
                  fullWidth
                  label="Email"
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              )}

              {mode === 'PASSWORD' && (
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                />
              )}

              {mode === 'USERCODE' && pinRequired && (
                <TextField
                  fullWidth
                  autoFocus={pinRequired}
                  label="PIN (4–6 digits)"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                  helperText="First-time PIN entry will become your PIN."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                />
              )}

              <Button
                size="large"
                type="submit"
                variant="contained"
                disabled={
                  loading ||
                  !identifier ||
                  (mode === 'PASSWORD' && !password)
                }
              >
                {loading ? <CircularProgress size={22} /> : 'Sign in'}
              </Button>

              <Divider />
              <Typography variant="caption" color="text.secondary" align="center">
                Demo codes: 10001 SuperAdmin · 20001 Admin · 30001 Manager · 40001 Reception ·
                50001 POS · 60001 Housekeeping · 70001 Accountant
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default UserCodeLogin;
