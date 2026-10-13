import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import { authService, type AuthUser, type SignInChallenge } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';

/**
 * Second step of every sign-in: the 6-digit code emailed to the account.
 * Shows how long the code is valid and counts down to when a new one can be
 * requested.
 */

const secondsUntil = (iso: string, now: number) => Math.max(Math.ceil((new Date(iso).getTime() - now) / 1000), 0);
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type Props = {
  challenge: SignInChallenge;
  onSignedIn: (auth: { token: string; refreshToken?: string; user: AuthUser }) => void;
  onCancel: () => void;
};

const SignInCodeStep: React.FC<Props> = ({ challenge: initial, onSignedIn, onCancel }) => {
  const [challenge, setChallenge] = useState(initial);
  const [code, setCode] = useState(initial.devCode ?? '');
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const expiresIn = secondsUntil(challenge.expiresAt, now);
  const resendIn = secondsUntil(challenge.resendAvailableAt, now);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      onSignedIn(await authService.verifySignInCode(challenge.challengeId, code));
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.error === 'CHALLENGE_INVALID' || data?.error === 'TOO_MANY_ATTEMPTS') {
        setError(data.message);
      } else if (data?.error === 'CODE_INVALID' && typeof data.attemptsLeft === 'number') {
        setError(`That code is not right. ${data.attemptsLeft} attempt${data.attemptsLeft === 1 ? '' : 's'} left.`);
      } else {
        setError(getApiErrorMessage(err, 'Could not verify the code'));
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await authService.resendSignInCode(challenge.challengeId);
      setChallenge(next);
      setCode(next.devCode ?? '');
      setNotice(`A new code was sent to ${next.email}. Earlier codes no longer work.`);
    } catch (err: any) {
      setError(err?.response?.data?.message || getApiErrorMessage(err, 'Could not send a new code'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box component="form" onSubmit={submit} noValidate>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <MarkEmailReadOutlinedIcon color="primary" />
          <Box>
            <Typography fontWeight={700}>Check your email</Typography>
            <Typography variant="body2" color="text.secondary">
              We sent a 6-digit sign-in code to <strong>{challenge.email}</strong>.
            </Typography>
          </Box>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {notice && <Alert severity="success">{notice}</Alert>}
        <TextField
          label="Sign-in code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          autoFocus
          autoComplete="one-time-code"
          inputProps={{ inputMode: 'numeric', style: { letterSpacing: 8, fontSize: 22, textAlign: 'center' } }}
          helperText={expiresIn > 0 ? `Code expires in ${clock(expiresIn)}` : 'This code has expired — request a new one.'}
          error={expiresIn === 0}
          fullWidth
        />
        <Button type="submit" variant="contained" size="large" disabled={busy || code.length !== 6 || expiresIn === 0}>
          {busy ? <CircularProgress size={22} color="inherit" /> : 'Verify and sign in'}
        </Button>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Button size="small" onClick={onCancel} disabled={busy}>
            Back
          </Button>
          <Button size="small" onClick={resend} disabled={busy || resendIn > 0 || challenge.resendsLeft === 0}>
            {challenge.resendsLeft === 0 ? 'No more resends' : resendIn > 0 ? `Resend code in ${clock(resendIn)}` : 'Resend code'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default SignInCodeStep;
