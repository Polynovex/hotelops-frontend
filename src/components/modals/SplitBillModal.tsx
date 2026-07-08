import { useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';

interface SplitBillModalProps {
  open: boolean;
  onClose: () => void;
  totalAmount?: number;
  onConfirm?: (payload: { method: 'equal' | 'amount'; parts: number[] }) => Promise<void> | void;
}

const SplitBillModal = ({ open, onClose, totalAmount = 0, onConfirm }: SplitBillModalProps) => {
  const [method, setMethod] = useState<'equal' | 'amount'>('equal');
  const [count, setCount] = useState(2);
  const [manualAmounts, setManualAmounts] = useState('');

  const equalSplitAmount = useMemo(() => {
    if (count <= 0) {
      return 0;
    }
    return totalAmount / count;
  }, [count, totalAmount]);

  const handleConfirm = async () => {
    const parts =
      method === 'equal'
        ? Array.from({ length: count }, () => Number(equalSplitAmount.toFixed(2)))
        : manualAmounts
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isFinite(value) && value > 0);
    if (parts.length === 0) {
      return;
    }
    if (onConfirm) {
      await onConfirm({ method, parts });
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Split Bill</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Total Amount: ₦{totalAmount.toLocaleString()}
          </Typography>
          <TextField
            select
            label="Split Method"
            value={method}
            onChange={(event) => setMethod(event.target.value as 'equal' | 'amount')}
            fullWidth
          >
            <MenuItem value="equal">Equal</MenuItem>
            <MenuItem value="amount">By Amount</MenuItem>
          </TextField>
          {method === 'equal' ? (
            <>
              <TextField
                type="number"
                label="Number of Parties"
                value={count}
                onChange={(event) => setCount(Math.max(1, Number(event.target.value || 1)))}
                inputProps={{ min: 1, max: 20 }}
                fullWidth
              />
              <Typography variant="caption" color="text.secondary">
                Each party pays ₦{equalSplitAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Typography>
            </>
          ) : (
            <TextField
              label="Amounts (comma-separated)"
              value={manualAmounts}
              onChange={(event) => setManualAmounts(event.target.value)}
              helperText="Example: 5000, 3500, 2500"
              fullWidth
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void handleConfirm()}>
          Apply Split
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SplitBillModal;
