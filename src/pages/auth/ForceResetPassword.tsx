import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  DarkModeRounded,
  LightModeRounded,
  LockRounded,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { useColorMode } from '../../theme/colorMode';
import BrandWordmark from '../../components/branding/BrandWordmark';
import { getApiErrorMessage } from '../../utils/apiError';

const ForceResetPasswordPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { mode: colorMode, toggleColorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const { user, setUser, logout } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setLoading(true);
    try {
      // Same as ChangePassword: adopt the session the server hands back, or the
      // client keeps a refresh token that was just revoked.
      const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });

      if (data?.accessToken) {
        useAuthStore.getState().setAuth(
          { ...(user as NonNullable<typeof user>), mustResetPassword: false },
          data.accessToken,
          data.refreshToken ?? null
        );
      } else {
        setUser({ mustResetPassword: false });
      }
      const role = user?.role || '';
      if (role === 'SUPER_ADMIN') navigate('/super-admin/dashboard', { replace: true });
      else if (role === 'BUSINESS_ADMIN' || role === 'MANAGER') navigate('/business/dashboard', { replace: true });
      else navigate('/shift', { replace: true });
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to change password.'));
    } finally {
      setLoading(false);
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
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} style={{ height: '100%' }}>
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
                <Box sx={{ position: 'absolute', top: -180, right: -120, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.12), transparent 70%)' }} />
                <Box sx={{ position: 'relative', zIndex: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={2} mb={6}>
                    <Box sx={{ width: 64, height: 64, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <img src="/icon.png" alt="HotelOpX" style={{ width: '68%', height: '68%', objectFit: 'contain' }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1 }}>
                        <BrandWordmark fontSize="inherit" />
                      </Typography>
                      <Typography sx={{ mt: 0.5, color: 'rgba(255,255,255,.68)', fontWeight: 600, fontSize: 11, letterSpacing: '.22em' }}>
                        HOSPITALITY OPERATING SYSTEM
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: { xs: '2.5rem', md: '3.5rem' }, lineHeight: 1.08, fontWeight: 600, letterSpacing: '-0.03em', maxWidth: 480, mb: 3 }}>
                    Secure your account before you begin.
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,.78)', maxWidth: 460, fontSize: 17, lineHeight: 1.8 }}>
                    Your account was created by an administrator. For your security, please set a new personal password before accessing the platform.
                  </Typography>
                </Box>
              </Box>
            </motion.div>
          </Grid>

          {/* Right form */}
          <Grid item xs={12} md={6}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
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
                <Typography variant="caption">First login</Typography>
                <Typography variant="h2" sx={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 600, lineHeight: 1, mb: 1 }}>
                  Set your password
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  Hello {user?.firstName || 'there'} — please create a new password to continue.
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

                <Box component="form" onSubmit={submit}>
                  <Stack spacing={2.5}>
                    <TextField
                      fullWidth
                      label="Current (temporary) password"
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      autoFocus
                      InputProps={{
                        startAdornment: <InputAdornment position="start"><LockRounded fontSize="small" /></InputAdornment>,
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setShowCurrent(s => !s)}>
                              {showCurrent ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                    <TextField
                      fullWidth
                      label="New password"
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      helperText="Minimum 8 characters"
                      InputProps={{
                        startAdornment: <InputAdornment position="start"><LockRounded fontSize="small" /></InputAdornment>,
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setShowNew(s => !s)}>
                              {showNew ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Confirm new password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      InputProps={{ startAdornment: <InputAdornment position="start"><LockRounded fontSize="small" /></InputAdornment> }}
                    />
                    <Button
                      size="large"
                      type="submit"
                      variant="contained"
                      disabled={loading}
                      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
                    >
                      Set password & continue
                    </Button>
                    <Button variant="text" size="small" onClick={() => { logout(); navigate('/login'); }}>
                      Sign out instead
                    </Button>
                  </Stack>
                </Box>
              </Box>
            </motion.div>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default ForceResetPasswordPage;
