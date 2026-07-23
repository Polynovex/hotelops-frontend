import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
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
  HotelRounded,
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

type LoginMode = 'USERCODE' | 'EMAIL';

interface DemoCredential {
  label: string;
  email: string;
  password: string;
  role: UserRole;
  description: string;
}

const demoCredentials: DemoCredential[] = [
  { label: 'Super admin', email: 'superadmin@hotelopx.com', password: 'demo123', role: 'SUPER_ADMIN', description: 'Platform-wide control' },
  { label: 'Business admin', email: 'admin@demo.com', password: 'demo123', role: 'BUSINESS_ADMIN', description: 'Hotel operator view' },
  { label: 'Manager', email: 'manager@demo.com', password: 'demo123', role: 'MANAGER', description: 'Daily operations' },
  { label: 'Accountant', email: 'accounting@demo.com', password: 'demo123', role: 'ACCOUNTANT', description: 'Finance & audits' },
  { label: 'Reception', email: 'reception@demo.com', password: 'demo123', role: 'RECEPTIONIST', description: 'Front desk shift' },
  { label: 'POS staff', email: 'pos@demo.com', password: 'demo123', role: 'POS_STAFF', description: 'Restaurant POS' },
  { label: 'Housekeeping', email: 'housekeeping@demo.com', password: 'demo123', role: 'HOUSEKEEPING', description: 'Room status' }
];

const routeForRole = (role: UserRole) => {
  if (role === 'SUPER_ADMIN') return '/super-admin/dashboard';
  if (role === 'BUSINESS_ADMIN' || role === 'MANAGER') return '/business/dashboard';
  return '/shift';
};

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { mode: colorMode, toggleColorMode } = useColorMode();
  const isDark = colorMode === 'dark';

  const [mode, setMode] = useState<LoginMode>('USERCODE');
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

  const completeLogin = (role: UserRole) => {
    navigate(routeForRole(role));
    reset();
  };

  const handleEmailLogin = async (data: LoginSchema) => {
    setLoading(true);
    setError('');
    try {
      const auth = await authService.login(data.email, data.password);
      useAuthStore.getState().setAuth(auth.user, auth.token, auth.refreshToken);
      completeLogin(auth.user.role);
    } catch (err: any) {
      setError(err?.message || err?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
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
        LOCKED: 'Account locked. Try again later.'
      };
      setError(map[code] || err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (cred: DemoCredential) => {
    setLoading(true);
    setError('');
    try {
      const auth = await authService.login(cred.email, cred.password);
      useAuthStore.getState().setAuth(auth.user, auth.token, auth.refreshToken);
      completeLogin(auth.user.role);
    } catch (err: any) {
      setError(err?.message || 'Demo login failed');
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
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{ height: '100%' }}
            >
              <Box
                sx={{
                  height: '100%',
                  borderRadius: '20px',
                  p: { xs: 4, md: 5 },
                  color: '#F8F4EC',
                  position: 'relative',
                  overflow: 'hidden',
                  background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.light} 60%, ${theme.palette.primary.main} 100%)`,
                  boxShadow: '0 30px 80px rgba(15, 27, 35, 0.32)'
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(circle at top right, ${alpha(theme.palette.secondary.main, 0.32)} 0%, transparent 40%)`,
                    pointerEvents: 'none'
                  }}
                />
                <Box sx={{ position: 'relative' }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" mb={3}>
                    <Box
                    >
                      <img src="./logo.png" style={{ width: '100%', height:'100%' }} />
                    </Box>
                  </Stack>

                  <Typography
                    variant="h2"
                    sx={{
                      fontFamily: '"Cormorant Garamond", serif',
                      fontWeight: 600,
                      lineHeight: 1.05,
                      mb: 2
                    }}
                  >
                    A modern command layer for African hospitality.
                  </Typography>
                  <Typography sx={{ color: alpha('#F8F4EC', 0.78), maxWidth: 460, mb: 4 }}>
                    Front desk, restaurant POS, housekeeping, and night-audit — unified into one premium
                    workspace that keeps working offline.
                  </Typography>

                  <Stack spacing={1.5}>
                    {[
                      { icon: ShieldRounded, label: 'Bank-grade audit trail & NDPR controls' },
                      { icon: BadgeRounded, label: 'One-tap usercode login for POS & reception' },
                      { icon: LockRounded, label: 'Offline-first sync — never lose a guest order' }
                    ].map((f) => (
                      <Stack key={f.label} direction="row" alignItems="center" spacing={1.5}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '8px',
                            display: 'grid',
                            placeItems: 'center',
                            background: alpha('#F8F4EC', 0.08),
                            color: theme.palette.secondary.light
                          }}
                        >
                          <f.icon fontSize="small" />
                        </Box>
                        <Typography sx={{ color: alpha('#F8F4EC', 0.86) }}>{f.label}</Typography>
                      </Stack>
                    ))}
                  </Stack>

                  {/* <Divider sx={{ my: 4, borderColor: alpha('#F8F4EC', 0.12) }} />
                  <Typography variant="overline" sx={{ color: alpha('#F8F4EC', 0.62), display: 'block', mb: 1.5 }}>
                    Try a demo role
                  </Typography> */}
                  {/* <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {demoCredentials.slice(0, 5).map((cred) => (
                      <Chip
                        key={cred.role}
                        label={cred.label}
                        onClick={() => void handleDemoLogin(cred)}
                        disabled={loading}
                        sx={{
                          color: '#F8F4EC',
                          bgcolor: alpha('#F8F4EC', 0.08),
                          border: `1px solid ${alpha('#F8F4EC', 0.16)}`,
                          fontWeight: 600,
                          '&:hover': {
                            bgcolor: alpha(theme.palette.secondary.main, 0.22),
                            borderColor: theme.palette.secondary.main
                          }
                        }}
                      />
                    ))}
                  </Stack> */}
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
                <Typography variant="caption">Welcome back</Typography>
                <Typography
                  variant="h2"
                  sx={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 600, lineHeight: 1, mb: 1 }}
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
                  <Stack spacing={2.5}>
                    <Box>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                        <Typography variant="subtitle2">
                          {pinRequired ? 'Enter PIN' : 'Enter usercode'}
                        </Typography>
                        {pinRequired && (
                          <Button size="small" onClick={() => { setPinRequired(false); setPin(''); }}>
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
                              bgcolor: i < target.length ? theme.palette.secondary.main : alpha(theme.palette.text.primary, 0.18)
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
                          sx={{ py: 1.5, fontFamily: '"JetBrains Mono", monospace', fontSize: 22, fontWeight: 700 }}
                        >
                          {d}
                        </Button>
                      ))}
                      <Box />
                      <Button
                        variant="outlined"
                        onClick={() => handleKey('0')}
                        sx={{ py: 1.5, fontFamily: '"JetBrains Mono", monospace', fontSize: 22, fontWeight: 700 }}
                      >
                        0
                      </Button>
                      <Button variant="outlined" onClick={handleBackspace} sx={{ py: 1.5 }} color="inherit">
                        <BackspaceRounded />
                      </Button>
                    </Box>

                    <Button
                      size="large"
                      variant="contained"
                      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LoginRounded />}
                      disabled={loading || !target || target.length < (pinRequired ? 4 : 5)}
                      onClick={() => void handleUsercodeLogin()}
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
                      <Button
                        size="large"
                        type="submit"
                        variant="contained"
                        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LoginRounded />}
                        disabled={loading}
                      >
                        Sign in
                      </Button>
                      <Button type="button" variant="text" size="small" onClick={() => navigate('/forgot-password')}>
                        Forgot your password?
                      </Button>
                    </Stack>
                  </Box>
                )}

                <Divider sx={{ my: 3 }}>or</Divider>
                <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
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
                </Stack>
              </Box>
            </motion.div>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default LoginPage;
