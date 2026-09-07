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
import { getApiErrorMessage } from '../utils/apiError';
import { postLoginPath } from '../utils/roleLanding';

type LoginMode = 'USERCODE' | 'EMAIL';

/** Monospaced, wide-tracked digits, with the keypad's target field highlighted. */
const codeFieldSx = (active: boolean) => ({
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: '0.28em',
  ...(active && {
    '& .MuiOutlinedInput-notchedOutline': { borderWidth: 2 }
  })
});

const keypadSx = {
  py: 0.9,
  minWidth: 0,
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 17,
  fontWeight: 700
} as const;



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
  /**
   * Which field the on-screen keypad types into.
   *
   * The code and the PIN are now asked for together rather than in two
   * submissions, so the keypad needs to know where the digits are going.
   */
  const [activeField, setActiveField] = useState<'code' | 'pin'>('code');
  /**
   * Whether the PIN field is on screen. Shown by default so the roles that
   * always need one can sign in with a single submission; staff whose code
   * works alone can collapse it and leave it blank either way.
   */
  const [pinNeeded, setPinNeeded] = useState(true);
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

  /**
   * Reset the keypad when the sign-in method changes.
   *
   * This used to clear the error as well, which silently swallowed the one
   * message that matters here: an account with a code but no PIN is told to
   * use email instead, and that redirect switches the mode — clearing its own
   * explanation on the way out. The person was simply dropped on the email tab
   * with no idea why. The error is now cleared where the user actually chooses
   * a different tab, and on the next submission.
   */
  useEffect(() => {
    setPin('');
    setActiveField('code');
  }, [mode]);

  const completeLogin = (role: UserRole, mustResetPassword?: boolean) => {
    navigate(postLoginPath(role, mustResetPassword));
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
      /**
       * The server asks for a PIN when the account needs one and none was
       * sent. Both fields are on screen already, so this is a prompt to fill
       * the second one in — not a separate step to navigate to.
       */
      if ('requiresPin' in result) {
        setActiveField('pin');
        setError('This account also needs its PIN. Enter it below and sign in.');
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
    if (activeField === 'pin') {
      if (pin.length < 6) setPin((p) => p + digit);
    } else if (usercode.length < 6) {
      setUsercode((c) => c + digit);
    }
  };

  const handleBackspace = () => {
    if (activeField === 'pin') setPin((p) => p.slice(0, -1));
    else setUsercode((c) => c.slice(0, -1));
  };

  return (
    <Box
      sx={{
        /**
         * The page is sized to the viewport rather than to its content.
         *
         * The brand panel used to run well past a laptop fold, so signing in
         * meant scrolling to reach the button. On md and up everything is now
         * held on one screen; narrow screens keep normal scrolling, because a
         * phone keyboard needs the room.
         */
        minHeight: '100vh',
        height: { md: '100vh' },
        overflow: { md: 'hidden' },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: { xs: 4, md: 3 },
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
                  {/*
                    The brand mark carries the wordmark and the tagline in one
                    asset, and is the same white-text logo the app sidebar uses
                    — so the product a person signs into looks like the screen
                    they signed in from.
                  */}
                  <Box
                    component="img"
                    src="/logo1.png"
                    alt="HotelOpX — PMS, POS, Finance, Operations"
                    sx={{ width: { md: 260, lg: 300 }, maxWidth: '80%', display: 'block', mb: 5 }}
                  />

                  <Typography
                    sx={{
                      fontFamily: '"Cormorant Garamond", serif',
                      fontSize: { md: '2.6rem', lg: '3rem' },
                      lineHeight: 1.12,
                      fontWeight: 600,
                      letterSpacing: '-0.02em',
                      maxWidth: 460,
                      mb: 2
                    }}
                  >
                    A modern command layer for African hospitality.
                  </Typography>

                  <Typography
                    sx={{
                      color: 'rgba(255,255,255,.72)',
                      maxWidth: 430,
                      fontSize: 15,
                      lineHeight: 1.7,
                      mb: 4
                    }}
                  >
                    Front desk, restaurant POS, housekeeping and night audit — one workspace
                    that keeps working when the connection does not.
                  </Typography>

                  {/*
                    Three short marks rather than three stacked cards. The cards
                    were the reason this panel ran past the fold on a laptop;
                    the same three claims fit on one line.
                  */}
                  <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                    {[
                      { icon: ShieldRounded, label: 'Audited & NDPR-ready' },
                      { icon: BadgeRounded, label: 'One-tap code sign-in' },
                      { icon: LockRounded, label: 'Offline-first sync' }
                    ].map((feature) => (
                      <Stack
                        key={feature.label}
                        direction="row"
                        spacing={0.9}
                        alignItems="center"
                        sx={{
                          px: 1.5,
                          py: 0.85,
                          borderRadius: '999px',
                          background: 'rgba(255,255,255,.06)',
                          border: '1px solid rgba(255,255,255,.10)'
                        }}
                      >
                        <feature.icon sx={{ fontSize: 16, color: '#F6C26B' }} />
                        <Typography
                          sx={{ color: 'rgba(255,255,255,.90)', fontWeight: 500, fontSize: 13 }}
                        >
                          {feature.label}
                        </Typography>
                      </Stack>
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
                {/* Mobile brand mark — hidden on md+, where the panel shows it */}
                <Box
                  sx={{
                    display: { xs: 'flex', md: 'none' },
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 3,
                    py: 2.5,
                    px: 3,
                    borderRadius: '18px',
                    background: 'linear-gradient(160deg, #13283D 0%, #1B3C61 45%, #244F80 100%)'
                  }}
                >
                  <Box
                    component="img"
                    src="/logo1.png"
                    alt="HotelOpX"
                    sx={{ width: 200, maxWidth: '70%', display: 'block' }}
                  />
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
                  onChange={(_e, v) => {
                    if (!v) return;
                    setError('');
                    setMode(v);
                  }}
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
                  <Stack component="form" onSubmit={handleUsercodeSubmit} spacing={1.75}>
                    {/*
                      Code and PIN are asked for together.

                      They used to be two submissions: the code went to the
                      server, which replied that a PIN was needed, and the same
                      keypad switched over to collect it. For the roles that
                      always need both — every admin and manager — that made a
                      one-step sign-in into a round trip and a second screen.
                    */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: pinNeeded ? '1.35fr 1fr' : '1fr',
                        gap: 1.5
                      }}
                    >
                      <TextField
                        fullWidth
                        autoFocus
                        label="Sign-in code"
                        type="password"
                        value={usercode}
                        onFocus={() => setActiveField('code')}
                        onChange={(e) =>
                          setUsercode(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="•••••"
                        inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
                        InputProps={{ sx: codeFieldSx(activeField === 'code') }}
                      />

                      {pinNeeded && (
                        <TextField
                          fullWidth
                          label="PIN"
                          type="password"
                          value={pin}
                          onFocus={() => setActiveField('pin')}
                          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="••••"
                          inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
                          InputProps={{ sx: codeFieldSx(activeField === 'pin') }}
                        />
                      )}
                    </Box>

                    <Button
                      type="button"
                      size="small"
                      variant="text"
                      onClick={() => {
                        setPinNeeded((v) => !v);
                        setActiveField('code');
                        setPin('');
                      }}
                      sx={{ alignSelf: 'flex-start', px: 0.5, minHeight: 0, py: 0 }}
                    >
                      {pinNeeded ? 'My code works on its own' : 'My account also uses a PIN'}
                    </Button>

                    {/* Compact keypad for touch terminals; types into the
                        field currently in focus. */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 0.75
                      }}
                    >
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                        <Button
                          key={d}
                          variant="outlined"
                          onClick={() => handleKey(d)}
                          sx={keypadSx}
                        >
                          {d}
                        </Button>
                      ))}
                      <Box />
                      <Button variant="outlined" onClick={() => handleKey('0')} sx={keypadSx}>
                        0
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={handleBackspace}
                        sx={keypadSx}
                        color="inherit"
                      >
                        <BackspaceRounded fontSize="small" />
                      </Button>
                    </Box>

                    <Button
                      size="large"
                      variant="contained"
                      startIcon={
                        loading ? <CircularProgress size={18} color="inherit" /> : <LoginRounded />
                      }
                      type="submit"
                      disabled={loading || usercode.length < 5}
                    >
                      Sign in
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
