import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import RemoveRounded from '@mui/icons-material/RemoveRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import { formatNaira, posFlow, type MenuItem as PosMenuItem, type PosOrderRow } from '../../services/posFlow';
import { getApiErrorMessage } from '../../utils/apiError';
import { addOnsOf } from './AddOnsDialog';

/**
 * Edit a placed order: change quantities and add-ons, add items, or remove
 * (void) items. Every change needs a reason and is re-priced by the server.
 * Shown only to holders of Manage sales orders; the server checks again.
 */

type Line = { lineId?: string; menuItemId: string; name: string; quantity: number; addOnIds: string[]; notes?: string; basePrice: number };

const EditOrderDialog: React.FC<{
  order: PosOrderRow | null;
  onClose: () => void;
  onSaved: (order: PosOrderRow) => void;
}> = ({ order, onClose, onSaved }) => {
  const [menu, setMenu] = useState<PosMenuItem[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [adding, setAdding] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!order) return;
    setLines(
      (Array.isArray(order.items) ? order.items : []).map((line) => ({
        lineId: line.lineId,
        menuItemId: line.menuItemId,
        name: line.name,
        quantity: line.quantity,
        addOnIds: (line.addOns ?? []).map((a) => a.id),
        notes: line.notes,
        basePrice: line.unitPrice
      }))
    );
    setReason('');
    setError('');
    setAdding('');
    posFlow.menu(order.outletId).then(setMenu).catch(() => setMenu([]));
  }, [order]);

  const menuById = useMemo(() => new Map(menu.map((item) => [item.id, item])), [menu]);
  const priceOf = (line: Line) => {
    const item = menuById.get(line.menuItemId);
    const addOns = addOnsOf(item?.modifiers).filter((a) => line.addOnIds.includes(a.id));
    return ((item?.price ?? line.basePrice) + addOns.reduce((s, a) => s + a.price, 0)) * line.quantity;
  };
  const estimate = lines.reduce((sum, line) => sum + priceOf(line), 0);

  const save = async () => {
    if (!order) return;
    if (!lines.length) {
      setError('An order needs at least one item. Void the order instead.');
      return;
    }
    if (reason.trim().length < 3) {
      setError('Give a reason for the change.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      onSaved(
        await posFlow.editOrder(
          order.id,
          lines.map((line) => ({ ...(line.lineId ? { lineId: line.lineId } : {}), menuItemId: line.menuItemId, quantity: line.quantity, notes: line.notes, addOns: line.addOnIds })),
          reason.trim()
        )
      );
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not change the order'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(order)} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Edit order {order?.orderNumber}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {order?.orderStatus !== 'OPEN' && (
            <Alert severity="info">This order is already with the kitchen; they will see the change on their board.</Alert>
          )}
          {lines.map((line, index) => {
            const item = menuById.get(line.menuItemId);
            const offered = addOnsOf(item?.modifiers);
            return (
              <Box key={line.lineId ?? `new-${index}`}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>{line.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatNaira(priceOf(line))}</Typography>
                  </Box>
                  <IconButton size="small" aria-label={`One fewer ${line.name}`} onClick={() => setLines(lines.map((l, i) => (i === index ? { ...l, quantity: Math.max(l.quantity - 1, 1) } : l)))}>
                    <RemoveRounded fontSize="small" />
                  </IconButton>
                  <Typography sx={{ minWidth: 20, textAlign: 'center' }}>{line.quantity}</Typography>
                  <IconButton size="small" aria-label={`One more ${line.name}`} onClick={() => setLines(lines.map((l, i) => (i === index ? { ...l, quantity: Math.min(l.quantity + 1, 99) } : l)))}>
                    <AddRounded fontSize="small" />
                  </IconButton>
                  <Tooltip title="Remove / void this item">
                    <IconButton size="small" color="error" aria-label={`Remove ${line.name}`} onClick={() => setLines(lines.filter((_, i) => i !== index))}>
                      <DeleteOutlineRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                {offered.length > 0 && (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    {offered.map((addOn) => {
                      const on = line.addOnIds.includes(addOn.id);
                      return (
                        <Chip
                          key={addOn.id}
                          size="small"
                          color={on ? 'primary' : 'default'}
                          variant={on ? 'filled' : 'outlined'}
                          label={`${addOn.name} +${formatNaira(addOn.price)}`}
                          onClick={() =>
                            setLines(lines.map((l, i) => (i === index ? { ...l, addOnIds: on ? l.addOnIds.filter((id) => id !== addOn.id) : [...l.addOnIds, addOn.id] } : l)))
                          }
                        />
                      );
                    })}
                  </Stack>
                )}
              </Box>
            );
          })}
          <TextField
            select
            size="small"
            label="Add an item"
            value={adding}
            onChange={(event) => {
              const item = menuById.get(event.target.value);
              if (item) setLines([...lines, { menuItemId: item.id, name: item.name, quantity: 1, addOnIds: [], basePrice: item.price }]);
              setAdding('');
            }}
          >
            {menu.filter((item) => item.isActive && item.isAvailable).map((item) => (
              <MenuItem key={item.id} value={item.id}>{item.name} — {formatNaira(item.price)}</MenuItem>
            ))}
          </TextField>
          <Divider />
          <Stack direction="row" justifyContent="space-between">
            <Typography fontWeight={700}>New subtotal (before charges)</Typography>
            <Typography fontWeight={800}>{formatNaira(estimate)}</Typography>
          </Stack>
          <TextField label="Reason for the change" value={reason} onChange={(e) => setReason(e.target.value)} required multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditOrderDialog;
