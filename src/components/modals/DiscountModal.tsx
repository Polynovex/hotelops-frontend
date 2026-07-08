import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import {
  ApplyDiscountPayload,
  Promotion,
  discountService,
  promotionService
} from '../../services/discount.service';

export interface DiscountModalItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  discountAmount?: number;
}

interface DiscountModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  items: DiscountModalItem[];
  onApplied: (response: any) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(n || 0);

const DiscountModal: React.FC<DiscountModalProps> = ({ open, onClose, orderId, items, onApplied }) => {
  const [scope, setScope] = useState<'RECEIVER' | 'ITEM'>('RECEIVER');
  const [mode, setMode] = useState<'PROMO' | 'ADHOC'>('PROMO');
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionId, setPromotionId] = useState<string>('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [value, setValue] = useState<string>('10');
  const [reason, setReason] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [approvalPin, setApprovalPin] = useState('');
  const [needsApproval, setNeedsApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    promotionService
      .list(true)
      .then(setPromotions)
      .catch(() => setPromotions([]));
  }, [open]);

  const selectedPromo = useMemo(() => promotions.find((p) => p.id === promotionId), [promotions, promotionId]);

  useEffect(() => {
    if (mode === 'ADHOC') {
      setNeedsApproval(true);
    } else if (selectedPromo) {
      setNeedsApproval(selectedPromo.requiresApproval);
      setScope(selectedPromo.scope);
    } else {
      setNeedsApproval(false);
    }
  }, [mode, selectedPromo]);

  const previewSaved = useMemo(() => {
    const type = mode === 'PROMO' ? selectedPromo?.discountType : discountType;
    const v = mode === 'PROMO' ? selectedPromo?.value || 0 : Number(value) || 0;
    if (!type) return 0;
    const target =
      scope === 'ITEM' ? items.filter((i) => selectedItemIds.includes(i.id)) : items;
    const subtotal = target.reduce(
      (s, i) => s + i.price * i.quantity - (i.discountAmount || 0),
      0
    );
    return type === 'PERCENTAGE'
      ? Math.round(((subtotal * v) / 100) * 100) / 100
      : Math.min(v, subtotal);
  }, [items, mode, selectedPromo, scope, selectedItemIds, discountType, value]);

  const toggleItem = (id: string) =>
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const payload: ApplyDiscountPayload = {
        appliedToType: 'POS_ORDER',
        appliedToId: orderId,
        scope,
        ...(scope === 'ITEM' && { targetItemIds: selectedItemIds }),
        ...(mode === 'PROMO' && { promotionId }),
        ...(mode === 'ADHOC' && { discountType, value: Number(value) }),
        ...(reason && { reason }),
        ...(needsApproval && { approvalPin })
      };
      const r = await discountService.apply(payload);
      onApplied(r);
      onClose();
    } catch (e: any) {
      const code = e?.response?.data?.error;
      const map: Record<string, string> = {
        MANAGER_PIN_REQUIRED: 'A manager PIN is required for this discount.',
        INVALID_MANAGER_PIN: 'Manager PIN is incorrect.',
        PROMO_EXPIRED: 'This promotion has expired.',
        PROMO_EXHAUSTED: 'This promotion has reached its redemption limit.',
        TARGET_ITEMS_REQUIRED: 'Select at least one item to discount.',
        ORDER_NOT_MODIFIABLE: 'Order is completed or voided.'
      };
      setError(map[code] || 'Failed to apply discount.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Apply discount</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={1}>
          <ToggleButtonGroup
            fullWidth
            exclusive
            value={scope}
            onChange={(_e, v) => v && setScope(v)}
            disabled={mode === 'PROMO' && !!selectedPromo}
          >
            <ToggleButton value="RECEIVER">Whole bill</ToggleButton>
            <ToggleButton value="ITEM">Selected items</ToggleButton>
          </ToggleButtonGroup>

          <ToggleButtonGroup
            fullWidth
            exclusive
            size="small"
            value={mode}
            onChange={(_e, v) => v && setMode(v)}
          >
            <ToggleButton value="PROMO">Use promotion</ToggleButton>
            <ToggleButton value="ADHOC">Ad-hoc (manager only)</ToggleButton>
          </ToggleButtonGroup>

          {mode === 'PROMO' && (
            <TextField
              select
              fullWidth
              label="Promotion"
              value={promotionId}
              onChange={(e) => setPromotionId(e.target.value)}
            >
              {promotions.length === 0 && (
                <MenuItem value="" disabled>
                  No active promotions
                </MenuItem>
              )}
              {promotions.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.code} — {p.name} (
                  {p.discountType === 'PERCENTAGE' ? `${p.value}%` : fmt(p.value)},{' '}
                  {p.scope === 'RECEIVER' ? 'bill' : 'item'})
                </MenuItem>
              ))}
            </TextField>
          )}

          {mode === 'ADHOC' && (
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Type"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as any)}
                sx={{ flex: 1 }}
              >
                <MenuItem value="PERCENTAGE">Percentage (%)</MenuItem>
                <MenuItem value="FIXED">Fixed amount (₦)</MenuItem>
              </TextField>
              <TextField
                label="Value"
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                sx={{ flex: 1 }}
              />
            </Stack>
          )}

          {scope === 'ITEM' && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Select items to discount
              </Typography>
              <Stack divider={<Divider />}>
                {items.map((it) => (
                  <FormControlLabel
                    key={it.id}
                    control={
                      <Checkbox
                        checked={selectedItemIds.includes(it.id)}
                        onChange={() => toggleItem(it.id)}
                      />
                    }
                    label={
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ width: '100%', minWidth: 280 }}
                      >
                        <Typography>
                          {it.name} × {it.quantity}
                        </Typography>
                        <Chip size="small" label={fmt(it.price * it.quantity)} />
                      </Stack>
                    }
                  />
                ))}
                {items.length === 0 && (
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No items on this order.
                  </Typography>
                )}
              </Stack>
            </Box>
          )}

          <TextField
            label="Reason (optional)"
            multiline
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
          />

          {needsApproval && (
            <TextField
              label="Manager PIN"
              type="password"
              value={approvalPin}
              onChange={(e) => setApprovalPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputProps={{ inputMode: 'numeric' }}
              helperText="Manager / Business Admin usercode is required to approve."
              fullWidth
            />
          )}

          <Alert severity="info">
            Estimated savings: <b>{fmt(previewSaved)}</b>
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={
            submitting ||
            (mode === 'PROMO' && !promotionId) ||
            (mode === 'ADHOC' && (!value || !discountType)) ||
            (scope === 'ITEM' && selectedItemIds.length === 0) ||
            (needsApproval && !approvalPin)
          }
        >
          Apply discount
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DiscountModal;
