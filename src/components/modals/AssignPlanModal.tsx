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

interface PlanOption {
  id: string;
  code: string;
  name: string;
  monthlyPriceNgn: number;
}

interface AssignPlanModalProps {
  open: boolean;
  onClose: () => void;
  plans?: PlanOption[];
  currentPlanId?: string;
  effectiveDate?: string;
  onAssign?: (payload: { planId: string; effectiveDate?: string; note?: string }) => Promise<void> | void;
}

const AssignPlanModal = ({ open, onClose, plans = [], currentPlanId = '', effectiveDate = '', onAssign }: AssignPlanModalProps) => {
  const [planId, setPlanId] = useState(currentPlanId);
  const [effective, setEffective] = useState(effectiveDate);
  const [note, setNote] = useState('');

  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === planId) || null, [planId, plans]);

  const handleAssign = async () => {
    if (!planId || !onAssign) {
      onClose();
      return;
    }
    await onAssign({ planId, effectiveDate: effective || undefined, note: note || undefined });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Assign Plan</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            label="Plan"
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
            fullWidth
          >
            <MenuItem value="">Select plan</MenuItem>
            {plans.map((plan) => (
              <MenuItem key={plan.id} value={plan.id}>
                {plan.name} ({plan.code})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            label="Effective Date"
            value={effective}
            onChange={(event) => setEffective(event.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Change Note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
          {selectedPlan && (
            <Typography variant="body2" color="text.secondary">
              Estimated monthly price: ₦{selectedPlan.monthlyPriceNgn.toLocaleString()}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void handleAssign()} disabled={!planId}>
          Assign Plan
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignPlanModal;
