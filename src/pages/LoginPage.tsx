import React, { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  BackspaceRounded,
  BadgeRounded,
  DarkModeRounded,
  LightModeRounded,
  LockRounded,
  LoginRounded,
  MailOutlineRounded,
  ShieldRounded,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { authService, UserRole } from '../services/api';
import { useColorMode } from '../theme/colorMode';
import { LoginSchema, loginSchema } from '../validation/auth.schema';
import BrandWordmark from '../components/branding/BrandWordmark';
import { getApiErrorMessage } from '../utils/apiError';

type LoginMode = 'USERCODE' | 'EMAIL';

const routeForRole = (role: UserRole, mustResetPassword?: boolean) => {
  if (mustResetPassword) return '/change-password';
  if (role === 'SUPER_ADMIN') return '/super-admin/dashboard';
  if (role === 'BUSINESS_ADMIN' || role === 'MANAGER') return '/business/dashboard';
  if (role === 'HOUSEKEEPING') return '/business/rooms/status-board';
  return '/shift';
};

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { mode: colorMode, toggleColorMode } = useColorMode();
  const isDark = colorMode === 'dark';

  const [mode, setMode] = useState<LoginMode>('USERCODE');
  /** Shown once the server says this account needs a second factor. */
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [usercode, setUsercode] = useState('');
  const [pin, setPin] = useState('');
  const [pinRequired, setPinRequired] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

  useEffect(() => {
    setError('');
    setPinRequired(false);
    setPin('');
  }, [mode]);

  const completeLogin = (role: UserRole, mustResetPassword?: boolean) => {
    navigate(routeForRole(role, mustResetPassword));
    reset();
  };

  const handleEmailLogin = async (data: LoginSchema) => {
    setLoading(true);
    setError('');
    try {
      const auth = await authService.login(data.email, data.password, mfaCode || undefined);
      useAuthStore.getState().setAuth(auth.user, auth.token, auth.refreshToken);
      completeLogin(auth.user.role, auth.user.mustResetPassword);
    } catch (err: any) {
      const response = err?.response?.data;

      /**
       * A login needing a second factor is a prompt, not a failure.
       *
       * The server replies with `mfaRequired` and no token; treating that as an
       * error left an enrolled user with no way to complete sign-in, because
       * nothing ever asked for the code.
       */
      if (response?.mfaRequired) {
        setMfaRequired(true);
        setError(
          mfaCode
            ? 'That code was not accepted. Check your authenticator and try the current one.'
            : ''
        );
        return;
      }

      setError(getApiErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  /** Form submit wrapper so the Enter key logs in, as on the email tab. */
  const handleUsercodeSubmit = (event: FormEvent) => {
    event.preventDefault();
    void handleUsercodeLogin();
  };

  const handleUsercodeLogin = async () => {
    if (!usercode || usercode.length < 5) {
      setError('Usercode must be 5 or 6 digits.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await authService.userCodeLogin(usercode, pin || undefined);
      if ('requiresPin' in result) {
        setPinRequired(true);
        return;
      }
      useAuthStore.getState().setAuth(result.user, result.token, result.refreshToken);
      completeLogin(result.user.role);
    } catch (err: any) {
      const code = err?.response?.data?.error;
      const map: Record<string, string> = {
        INVALID_CREDENTIALS: 'Invalid usercode or PIN.',
        LOCKED: 'Account locked. Try again later.',
        // An account with no PIN cannot sign in this way. Point at the email
        // tab, which is the only route in until a PIN exists.
        PIN_NOT_SET:
          'No PIN has been set for this code yet. Use the Email tab above to sign '
          + 'in, then set a PIN under Security.'
      };
      setError(map[code] || getApiErrorMessage(err, 'Login failed'));

      // Switch to the method that will actually work.
      if (code === 'PIN_NOT_SET') {
        setMode('EMAIL');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (digit: string) => {
    if (pinRequired) {
      if (pin.length < 6) setPin((p) => p + digit);
    } else if (usercode.length < 6) {
      setUsercode((c) => c + digit);
    }
  };

  const handleBackspace = () => {
    if (pinRequired) setPin((p) => p.slice(0, -1));
    else setUsercode((c) => c.slice(0, -1));
  };

  const target = pinRequired ? pin : usercode;
  const targetLen = pinRequired ? 4 : 5;

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
          {/* LEFT — Brand panel */}

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
                  background: `
          linear-gradient(
            160deg,
            #13283D 0%,
            #1B3C61 45%,
            #244F80 100%
          )
        `,
                  boxShadow: '0 40px 100px rgba(7,18,31,.35)'
                }}
              >
                {/* Decorative Background */}
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

                <Box
                  sx={{
                    position: 'absolute',
                    bottom: -120,
                    left: -80,
                    width: 280,
                    height: 280,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(59,130,246,.20), transparent 70%)'
                  }}
                />

                <Box sx={{ position: 'relative', zIndex: 2 }}>
                  {/* ================= Logo ================= */}

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2.5,
                      mb: 6
                    }}
                  >
                    <Box
                      sx={{
                        width: 100,
                        height: 100,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}
                    >
                      <img
                        src="/icon.png"
                        alt="HotelOpX"
                        style={{
                          width: '68%',
                          height: '68%',
                          objectFit: 'contain'
                        }}
                      />
                    </Box>

                    <Box>
                      <BrandWordmark fontSize={{ xs: '2.6rem', md: '4rem' }} />

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
                  </Box>

                  {/* ================= Heading ================= */}

                  <Typography
                    sx={{
                      fontFamily: '"Cormorant Garamond", serif',
                      fontSize: {
                        xs: '2.5rem',
                        md: '4rem'
                      },
                      lineHeight: 1.08,
                      fontWeight: 600,
                      letterSpacing: '-0.03em',
                      maxWidth: 520,
                      mb: 3
                    }}
                  >
                    A modern command layer for African hospitality.
                  </Typography>

                  <Typography
                    sx={{
                      color: 'rgba(255,255,255,.78)',
                      maxWidth: 500,
                      fontSize: 18,
                      lineHeight: 1.8,
                      mb: 5
                    }}
                  >
                    Front desk, restaurant POS, housekeeping and night-audit — unified into one
                    premium workspace that keeps working offline.
                  </Typography>

                  {/* ================= Features ================= */}

                  <Stack spacing={2.2}>
                    {[
                      {
                        icon: ShieldRounded,
                        label: 'Bank-grade audit trail & NDPR controls'
                      },
                      {
                        icon: BadgeRounded,
                        label: 'One-tap usercode login for POS & reception'
                      },
                      {
                        icon: LockRounded,
                        label: 'Offline-first sync — never lose a guest order'
                      }
                    ].map((feature) => (
                      <Box
                        key={feature.label}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          px: 2,
                          py: 1.6,
                          borderRadius: '16px',
                          background: 'rgba(255,255,255,.05)',
                          border: '1px solid rgba(255,255,255,.08)',
                          backdropFilter: 'blur(16px)',
                          transition: '.3s',

                          '&:hover': {
                            background: 'rgba(255,255,255,.08)',
                            transform: 'translateX(6px)'
                          }
                        }}
                      >
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            bgcolor: '#2D5C93',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            color: '#F6C26B',
                            flexShrink: 0
                          }}
                        >
                          <feature.icon fontSize="small" />
                        </Box>

                        <Typography
                          sx={{
                            color: 'rgba(255,255,255,.92)',
                            fontWeight: 500,
                            fontSize: 16
                          }}
                        >
                          {feature.label}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Box>
            </motion.div>
          </Grid>

          {/* RIGHT — Login card */}
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
                {/* Mobile logo — hidden on md+ */}
                <Box
                  sx={{
                    display: { xs: 'flex', md: 'none' },
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2.5,
                    mb: 4,
                    p: 3,
                    borderRadius: '20px',
                    background: 'linear-gradient(160deg, #13283D 0%, #1B3C61 45%, #244F80 100%)',
                    boxShadow: '0 40px 100px rgba(7,18,31,.35)'
                  }}
                >
                  <Box
                    sx={{
                      width: 100,
                      height: 100,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}
                  >
                    <img
                      src="/icon.png"
                      alt="HotelOpX"
                      style={{ width: '68%', height: '68%', objectFit: 'contain' }}
                    />
                  </Box>
                  <Box>
                    <BrandWordmark fontSize="2.6rem" />
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
                </Box>

                <Typography variant="caption">Welcome back</Typography>
                <Typography
                  variant="h2"
                  sx={{
                    fontFamily: '"Cormorant Garamond", serif',
                    fontWeight: 600,
                    lineHeight: 1,
                    mb: 1
                  }}
                >
                  Sign in
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  Choose how you'd like to log in.
                </Typography>

                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  value={mode}
                  onChange={(_e, v) => v && setMode(v)}
                  sx={{ mb: 3 }}
                >
                  <ToggleButton value="USERCODE">
                    <BadgeRounded fontSize="small" sx={{ mr: 1 }} /> Usercode
                  </ToggleButton>
                  <ToggleButton value="EMAIL">
                    <MailOutlineRounded fontSize="small" sx={{ mr: 1 }} /> Email & password
                  </ToggleButton>
                </ToggleButtonGroup>

                {error && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                  </Alert>
                )}

                {mode === 'USERCODE' ? (
                  <Stack component="form" onSubmit={handleUsercodeSubmit} spacing={2.5}>
                    <Box>
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        mb={1}
                      >
                        <Typography variant="subtitle2">
                          {pinRequired ? 'Enter PIN' : 'Enter usercode'}
                        </Typography>
                        {pinRequired && (
                          <Button
                            size="small"
                            onClick={() => {
                              setPinRequired(false);
                              setPin('');
                            }}
                          >
                            Back
                          </Button>
                        )}
                      </Stack>
                      <TextField
                        fullWidth
                        autoFocus
                        type="password"
                        inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
                        value={target}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                          if (pinRequired) setPin(v);
                          else setUsercode(v);
                        }}
                        placeholder={pinRequired ? '••••' : '••••••'}
                        InputProps={{
                          sx: {
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: 28,
                            fontWeight: 700,
                            letterSpacing: '0.3em',
                            textAlign: 'center'
                          }
                        }}
                      />
                      <Stack direction="row" spacing={1} mt={1} justifyContent="center">
                        {Array.from({ length: Math.max(targetLen, target.length) }).map((_, i) => (
                          <Box
                            key={i}
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              bgcolor:
                                i < target.length
                                  ? theme.palette.secondary.main
                                  : alpha(theme.palette.text.primary, 0.18)
                            }}
                          />
                        ))}
                      </Stack>
                    </Box>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 1.2
                      }}
                    >
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                        <Button
                          key={d}
                          variant="outlined"
                          onClick={() => handleKey(d)}
                          sx={{
                            py: 1.5,
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: 22,
                            fontWeight: 700
                          }}
                        >
                          {d}
                        </Button>
                      ))}
                      <Box />
                      <Button
                        variant="outlined"
                        onClick={() => handleKey('0')}
                        sx={{
                          py: 1.5,
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: 22,
                          fontWeight: 700
                        }}
                      >
                        0
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={handleBackspace}
                        sx={{ py: 1.5 }}
                        color="inherit"
                      >
                        <BackspaceRounded />
                      </Button>
                    </Box>

                    <Button
                      size="large"
                      variant="contained"
                      startIcon={
                        loading ? <CircularProgress size={18} color="inherit" /> : <LoginRounded />
                      }
                      type="submit"
                      disabled={loading || !target || target.length < (pinRequired ? 4 : 5)}
                    >
                      {pinRequired ? 'Verify PIN' : 'Continue'}
                    </Button>
                  </Stack>
                ) : (
                  <Box component="form" onSubmit={handleSubmit(handleEmailLogin)}>
                    <Stack spacing={2}>
                      <TextField
                        fullWidth
                        autoFocus
                        label="Email"
                        type="email"
                        error={!!errors.email}
                        helperText={errors.email?.message}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <MailOutlineRounded fontSize="small" />
                            </InputAdornment>
                          )
                        }}
                        {...register('email')}
                      />
                      <TextField
                        fullWidth
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        error={!!errors.password}
                        helperText={errors.password?.message}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <LockRounded fontSize="small" />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton onClick={() => setShowPassword((s) => !s)} size="small">
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          )
                        }}
                        {...register('password')}
                      />

                      {/* Appears only once the server has asked for a second
                          factor, so an ordinary sign-in is unchanged. */}
                      {mfaRequired && (
                        <TextField
                          label="Authentication code"
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value.trim())}
                          fullWidth
                          autoFocus
                          inputProps={{ inputMode: 'text', autoComplete: 'one-time-code' }}
                          helperText="Six digits from your authenticator app, or one of your recovery codes."
                        />
                      )}

                      <Button
                        size="large"
                        type="submit"
                        variant="contained"
                        startIcon={
                          loading ? (
                            <CircularProgress size={18} color="inherit" />
                          ) : (
                            <LoginRounded />
                          )
                        }
                        disabled={loading || (mfaRequired && !mfaCode)}
                      >
                        {mfaRequired ? 'Verify and sign in' : 'Sign in'}
                      </Button>
                      <Button
                        type="button"
                        variant="text"
                        size="small"
                        onClick={() => navigate('/forgot-password')}
                      >
                        Forgot your password?
                      </Button>
                    </Stack>
                  </Box>
                )}

                {/* <Divider sx={{ my: 3 }}>or</Divider> */}
                {/* <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
                  Quick demo
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {demoCredentials.map((cred) => (
                    <Chip
                      key={cred.role}
                      label={cred.label}
                      size="small"
                      variant="outlined"
                      disabled={loading}
                      onClick={() => void handleDemoLogin(cred)}
                    />
                  ))}
                </Stack> */}
              </Box>
            </motion.div>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default LoginPage;
