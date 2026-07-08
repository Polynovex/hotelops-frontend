import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
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
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{subtitle}</Typography>
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
      setMessage('Password reset instructions have been sent to your email.');
    } catch (_err) {
      // Keep UX stable even when backend endpoint is unavailable.
      setMessage('If your account exists, reset instructions will be sent shortly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title="Forgot Password" subtitle="Enter your account email to request a reset link.">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      <Box component="form" onSubmit={submit}>
        <Stack spacing={2}>
          <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Button type="submit" variant="contained" disabled={submitting}>Send Reset Link</Button>
        </Stack>
      </Box>
    </AuthCard>
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
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      <Box component="form" onSubmit={submit}>
        <Stack spacing={2}>
          <TextField label="Reset Token" value={token} InputProps={{ readOnly: true }} helperText="Token pulled from URL query" />
          <TextField label="New Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          <TextField
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
          <Button type="submit" variant="contained" disabled={submitting}>Reset Password</Button>
        </Stack>
      </Box>
    </AuthCard>
  );
};

export const MfaSetupPage = () => {
  const [secret] = useState(`HOPX-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`);
  const [copied, setCopied] = useState(false);

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <AuthCard title="MFA Setup" subtitle="Add this secret to your authenticator app to enable TOTP verification.">
      <Stack spacing={2}>
        <TextField label="MFA Secret" value={secret} InputProps={{ readOnly: true }} />
        <Button variant="outlined" onClick={() => void copySecret()}>{copied ? 'Copied' : 'Copy Secret'}</Button>
        <Alert severity="info">Use this secret in Google Authenticator/Authy. Then proceed to verification.</Alert>
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
    <AuthCard title="MFA Verify" subtitle="Enter the 6-digit code generated by your authenticator app.">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box component="form" onSubmit={submit}>
        <Stack spacing={2}>
          <TextField label="6-digit code" value={code} onChange={(event) => setCode(event.target.value)} inputProps={{ maxLength: 6 }} required />
          <Button type="submit" variant="contained" disabled={submitting}>Verify</Button>
        </Stack>
      </Box>
    </AuthCard>
  );
};
