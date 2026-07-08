import { useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Stack,
  Typography
} from '@mui/material';

interface NightAuditModalProps {
  open: boolean;
  onClose: () => void;
  onRun?: (payload: {
    includeReservations: boolean;
    includePos: boolean;
    includeAccounting: boolean;
  }) => Promise<void> | void;
}

const NightAuditModal = ({ open, onClose, onRun }: NightAuditModalProps) => {
  const [includeReservations, setIncludeReservations] = useState(true);
  const [includePos, setIncludePos] = useState(true);
  const [includeAccounting, setIncludeAccounting] = useState(true);
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    try {
      if (onRun) {
        await onRun({
          includeReservations,
          includePos,
          includeAccounting
        });
      }
      onClose();
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Night Audit</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Select the modules to include in this night audit run.
          </Typography>
          <FormControlLabel
            control={
              <Checkbox checked={includeReservations} onChange={(event) => setIncludeReservations(event.target.checked)} />
            }
            label="Post reservations and folio balances"
          />
          <FormControlLabel
            control={<Checkbox checked={includePos} onChange={(event) => setIncludePos(event.target.checked)} />}
            label="Post POS sales and taxes"
          />
          <FormControlLabel
            control={
              <Checkbox checked={includeAccounting} onChange={(event) => setIncludeAccounting(event.target.checked)} />
            }
            label="Finalize accounting journals"
          />
          {running && <LinearProgress />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={running}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleRun()}
          disabled={running || (!includeReservations && !includePos && !includeAccounting)}
        >
          Run Audit
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NightAuditModal;
