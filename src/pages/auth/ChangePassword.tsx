import { FormEvent, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { LockRounded, Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';

const routeAfterChange = (role: string, mustReset: boolean) => {
  if (mustReset) {
    // After forced reset, go to appropriate dashboard
    if (role === 'SUPER_ADMIN') return '/super-admin/dashboard';
    if (role === 'BUSINESS_ADMIN' || role === 'MANAGER') return '/business/dashboard';
    if (role === 'HOUSEKEEPING') return '/business/rooms/status-board';
    return '/shift';
  }
  return -1 as unknown as string; // go back
};

const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const isForcedReset = user?.mustResetPassword === true;

  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPass.length < 8) { setError('New password must be at least 8 characters'); return; }
    if (newPass !== confirm) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword: isForcedReset ? current : current, newPassword: newPass });
      setUser({ mustResetPassword: false });
      setSuccess(true);
      setTimeout(() => {
        const dest = routeAfterChange(user?.role || '', isForcedReset);
        if (typeof dest === 'string') navigate(dest, { replace: true });
        else navigate(-1);
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa' }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: { xs: 3, md: 5 }, borderRadius: 3 }}>
          {isForcedReset && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              You must set a new password before continuing.
            </Alert>
          )}
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            {isForcedReset ? 'Set New Password' : 'Change Password'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {isForcedReset
              ? 'Your account requires a password change on first login.'
              : 'Update your account password below.'}
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>Password changed successfully. Redirecting…</Alert>}

          <Box component="form" onSubmit={submit}>
            <Stack spacing={2.5}>
              <TextField
                label="Current Password"
                type={showCurrent ? 'text' : 'password'}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                InputProps={{
                  startAdornment: <InputAdornment position="start"><LockRounded fontSize="small" /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowCurrent((s) => !s)}>
                        {showCurrent ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <TextField
                label="New Password"
                type={showNew ? 'text' : 'password'}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                required
                helperText="Minimum 8 characters"
                InputProps={{
                  startAdornment: <InputAdornment position="start"><LockRounded fontSize="small" /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowNew((s) => !s)}>
                        {showNew ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <TextField
                label="Confirm New Password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                InputProps={{ startAdornment: <InputAdornment position="start"><LockRounded fontSize="small" /></InputAdornment> }}
              />
              <Stack direction="row" spacing={2}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading || success}
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
                  fullWidth
                >
                  {loading ? 'Saving…' : 'Change Password'}
                </Button>
                {!isForcedReset && (
                  <Button variant="outlined" size="large" onClick={() => navigate(-1)} fullWidth>
                    Cancel
                  </Button>
                )}
              </Stack>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default ChangePasswordPage;
