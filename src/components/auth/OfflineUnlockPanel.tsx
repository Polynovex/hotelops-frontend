import React, { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import CloudOffRounded from '@mui/icons-material/CloudOffRounded';
import { useAuthStore } from '../../store/authStore';
import { rememberForOfflineUnlock, unlockFailureMessage, unlockOffline } from '../../services/offlineUnlock';
import type { AuthUser } from '../../services/api';

/** True while the device has no connection; follows the browser's online/offline events. */
export const useOnline = () => {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
};

/**
 * After a successful online sign-in: save an encrypted copy of the profile so
 * this person can unlock this device offline for the next 24 hours. Only when
 * a secret was typed (usercode + PIN, or email + password) — a usercode alone
 * never unlocks anything offline.
 */
export const rememberSignIn = (identifier: string, secret: string | undefined, user: AuthUser) => {
  if (!secret) return;
  void rememberForOfflineUnlock(identifier, secret, user);
};

const OfflineUnlockPanel: React.FC<{ onUnlocked: (user: AuthUser) => void }> = ({ onUnlocked }) => {
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await unlockOffline<AuthUser>(identifier, secret);
    setBusy(false);
    if (!result.ok) {
      setError(unlockFailureMessage(result));
      return;
    }
    useAuthStore.getState().unlockOffline(result.profile);
    onUnlocked(result.profile);
  };

  return (
    <Stack component="form" spacing={1.75} onSubmit={submit}>
      <Alert severity="warning" icon={<CloudOffRounded />}>
        You are offline. Signing in needs a connection, but if you signed in on this device in the last 24 hours you can unlock it with
        your usercode and PIN (or email and password). Your work is saved here and syncs after you sign in online again.
      </Alert>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Usercode or email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus fullWidth />
      <TextField label="PIN or password" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} fullWidth />
      <Button type="submit" variant="contained" size="large" disabled={busy || !identifier.trim() || !secret}>
        {busy ? 'Unlocking…' : 'Unlock offline'}
      </Button>
      <Typography variant="caption" color="text.secondary">
        Five wrong attempts turn offline unlock off for you on this device.
      </Typography>
    </Stack>
  );
};

export default OfflineUnlockPanel;
