import { FormEvent, ReactNode, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField
} from '@mui/material';
import { getApiErrorMessage } from '../../utils/apiError';

/**
 * Confirmation for destructive actions that the server protects with the
 * actor's password (staff deletion, removing a user).
 *
 * `onConfirm` receives the password and should throw on failure; the dialog
 * stays open and shows the server's message, so a mistyped password is simply
 * retried rather than surfacing as a toast after the dialog has gone.
 */
export function PasswordConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Delete',
  confirmColor = 'error',
  onConfirm,
  onClose
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  confirmColor?: 'error' | 'warning' | 'primary';
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Never carry a typed password from one confirmation into the next.
  useEffect(() => {
    if (!open) {
      setPassword('');
      setError('');
      setBusy(false);
    }
  }, [open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm(password);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not complete this action.'));
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={submit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          {children && <Box sx={{ mb: 2 }}>{children}</Box>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            fullWidth
            autoFocus
            type="password"
            label="Your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            helperText="Required to confirm."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" color={confirmColor} variant="contained" disabled={busy || !password}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
