import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { DarkModeRounded, LightModeRounded, MailOutlineRounded } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useColorMode } from '../../theme/colorMode';
import LogoLoader from '../../components/LogoLoader';

const AuthCard = ({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) => (
  <Container maxWidth="sm" sx={{ py: 6 }}>
    <Paper sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {subtitle}
      </Typography>
      {children}
    </Paper>
  </Container>
);

export const LogoutPage = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    logout();
    const timer = window.setTimeout(() => navigate('/login', { replace: true }), 800);
    return () => window.clearTimeout(timer);
  }, [logout, navigate]);

  return (
    <AuthCard title="Signing out" subtitle="Your session is being closed securely.">
      <LogoLoader inline minHeight={140} label="Signing out" />
    </AuthCard>
  );
};

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { mode: colorMode, toggleColorMode } = useColorMode();
  const isDark = colorMode === 'dark';

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await api.post('/auth/forgot-password', { email });
      setMessage('If your account exists, a reset link has been sent to your email.');
    } catch (_err) {
      setMessage('If your account exists, a reset link has been sent to your email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: { xs: 4, md: 6 },
        background: isDark ? '#0E1418' : '#FFFFFF'
      }}
    >
      <Container maxWidth="lg">
        <Stack direction="row" justifyContent="flex-end" mb={2}>
          <Tooltip title={isDark ? 'Switch to light' : 'Switch to dark'}>
            <IconButton onClick={toggleColorMode}>
              {isDark ? <LightModeRounded /> : <DarkModeRounded />}
            </IconButton>
          </Tooltip>
        </Stack>

        <Grid container spacing={{ xs: 3, md: 5 }} alignItems="stretch">
          {/* Left brand panel */}
          <Grid item xs={12} md={6} sx={{ display: { xs: 'none', md: 'block' } }}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              style={{ height: '100%' }}
            >
              <Box
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  height: '100%',
                  borderRadius: '28px',
                  p: { xs: 4, md: 6 },
                  color: '#fff',
                  background: 'linear-gradient(160deg, #13283D 0%, #1B3C61 45%, #244F80 100%)',
                  boxShadow: '0 40px 100px rgba(7,18,31,.35)'
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: -180,
                    right: -120,
                    width: 420,
                    height: 420,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255,255,255,.12), transparent 70%)'
                  }}
                />
                <Box sx={{ position: 'relative', zIndex: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={2} mb={6}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}
                    >
                      <img
                        src="/icon.png"
                        alt="HotelOpX"
                        style={{ width: '68%', height: '68%', objectFit: 'contain' }}
                      />
                    </Box>
                    <Box>
                      <Typography
                        sx={{
                          fontSize: '2.4rem',
                          fontWeight: 800,
                          letterSpacing: '-0.05em',
                          lineHeight: 1
                        }}
                      >
                        <Box component="span" sx={{ color: '#0F1D3D' }}>
                          Hotel
                        </Box>
                        <Box component="span" sx={{ color: '#132349' }}>
                          Op
                        </Box>
                        <Box component="span" sx={{ color: '#3B82F6' }}>
                          X
                        </Box>
                      </Typography>
                      <Typography
                        sx={{
                          mt: 0.5,
                          color: 'rgba(255,255,255,.68)',
                          fontWeight: 600,
                          fontSize: 11,
                          letterSpacing: '.22em'
                        }}
                      >
                        HOSPITALITY OPERATING SYSTEM
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography
                    sx={{
                      fontFamily: '"Cormorant Garamond", serif',
                      fontSize: { xs: '2.5rem', md: '3.5rem' },
                      lineHeight: 1.08,
                      fontWeight: 600,
                      letterSpacing: '-0.03em',
                      maxWidth: 480,
                      mb: 3
                    }}
                  >
                    Recover access to your workspace.
                  </Typography>
                  <Typography
                    sx={{
                      color: 'rgba(255,255,255,.78)',
                      maxWidth: 460,
                      fontSize: 17,
                      lineHeight: 1.8
                    }}
                  >
                    Enter your account email and we'll send you a secure link to reset your
                    password.
                  </Typography>
                </Box>
              </Box>
            </motion.div>
          </Grid>

          {/* Right form */}
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
            >
              <Box
                sx={{
                  borderRadius: '20px',
                  p: { xs: 3.5, md: 4.5 },
                  bgcolor: alpha(theme.palette.background.paper, isDark ? 0.85 : 0.95),
                  border: `1px solid ${theme.palette.divider}`,
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 24px 64px rgba(15, 27, 35, 0.12)'
                }}
              >
                <Typography variant="caption">Account recovery</Typography>
                <Typography
                  variant="h2"
                  sx={{
                    fontFamily: '"Cormorant Garamond", serif',
                    fontWeight: 600,
                    lineHeight: 1,
                    mb: 1
                  }}
                >
                  Forgot password
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  Enter your email address to receive a reset link.
                </Typography>

                {error && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                  </Alert>
                )}
                {message && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    {message}
                  </Alert>
                )}

                {!message && (
                  <Box component="form" onSubmit={submit}>
                    <Stack spacing={2.5}>
                      <TextField
                        fullWidth
                        autoFocus
                        label="Email address"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <MailOutlineRounded fontSize="small" />
                            </InputAdornment>
                          )
                        }}
                      />
                      <Button
                        size="large"
                        type="submit"
                        variant="contained"
                        disabled={submitting}
                        startIcon={
                          submitting ? <CircularProgress size={18} color="inherit" /> : undefined
                        }
                      >
                        Send reset link
                      </Button>
                    </Stack>
                  </Box>
                )}

                <Button
                  variant="text"
                  size="small"
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/login')}
                >
                  ← Back to sign in
                </Button>
              </Box>
            </motion.div>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

const getTokenFromSearch = (search: string): string => {
  const params = new URLSearchParams(search);
  return params.get('token') || '';
};

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useMemo(() => getTokenFromSearch(location.search), [location.search]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      if (password !== confirmPassword) {
        throw new Error('Password confirmation does not match');
      }

      await api.post('/auth/reset-password', {
        token,
        password
      });

      setMessage('Password reset successful. Redirecting to login...');
      window.setTimeout(() => navigate('/login'), 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title="Reset Password" subtitle="Create a new secure password for your account.">
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}
      <Box component="form" onSubmit={submit}>
        <Stack spacing={2}>
          <TextField
            label="Reset Token"
            value={token}
            InputProps={{ readOnly: true }}
            helperText="Token pulled from URL query"
          />
          <TextField
            label="New Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <TextField
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
          <Button type="submit" variant="contained" disabled={submitting}>
            Reset Password
          </Button>
        </Stack>
      </Box>
    </AuthCard>
  );
};

export const MfaSetupPage = () => {
  const [secret] = useState(
    `HOPX-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`
  );
  const [copied, setCopied] = useState(false);

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <AuthCard
      title="MFA Setup"
      subtitle="Add this secret to your authenticator app to enable TOTP verification."
    >
      <Stack spacing={2}>
        <TextField label="MFA Secret" value={secret} InputProps={{ readOnly: true }} />
        <Button variant="outlined" onClick={() => void copySecret()}>
          {copied ? 'Copied' : 'Copy Secret'}
        </Button>
        <Alert severity="info">
          Use this secret in Google Authenticator/Authy. Then proceed to verification.
        </Alert>
      </Stack>
    </AuthCard>
  );
};

export const MfaVerifyPage = () => {
  const navigate = useNavigate();
  const verifyMfa = useAuthStore((state) => state.verifyMfa);

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (!/^\d{6}$/.test(code)) {
        throw new Error('Enter a valid 6-digit MFA code');
      }

      await verifyMfa(code);
      navigate('/business/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'MFA verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="MFA Verify"
      subtitle="Enter the 6-digit code generated by your authenticator app."
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Box component="form" onSubmit={submit}>
        <Stack spacing={2}>
          <TextField
            label="6-digit code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            inputProps={{ maxLength: 6 }}
            required
          />
          <Button type="submit" variant="contained" disabled={submitting}>
            Verify
          </Button>
        </Stack>
      </Box>
    </AuthCard>
  );
};
