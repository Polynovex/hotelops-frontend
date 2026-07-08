import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';

interface BlacklistModalProps {
  open: boolean;
  onClose: () => void;
  profileName?: string;
  onConfirm?: (payload: { reason: string; expiresAt?: string }) => Promise<void> | void;
}

const BlacklistModal = ({ open, onClose, profileName, onConfirm }: BlacklistModalProps) => {
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const handleConfirm = async () => {
    if (!reason.trim()) {
      return;
    }
    if (onConfirm) {
      await onConfirm({ reason: reason.trim(), expiresAt: expiresAt || undefined });
    }
    setReason('');
    setExpiresAt('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Blacklist Profile</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Profile" value={profileName || ''} disabled fullWidth />
          <TextField
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            multiline
            minRows={3}
            required
            fullWidth
          />
          <TextField
            type="date"
            label="Restriction End Date (Optional)"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="error" variant="contained" onClick={() => void handleConfirm()} disabled={!reason.trim()}>
          Blacklist
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BlacklistModal;
