import React, { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import { posService } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';

/** A menu item's add-ons (extra cheese, a side…), each with a price. */
export type AddOn = { id?: string; name: string; price: number };

export const addOnsOf = (modifiers: unknown): Required<AddOn>[] =>
  Array.isArray(modifiers)
    ? (modifiers as Array<Partial<AddOn>>).filter(
        (m): m is Required<AddOn> => !!m && typeof m.id === 'string' && typeof m.name === 'string' && Number.isFinite(Number(m.price))
      )
    : [];

const AddOnsDialog: React.FC<{
  item: { id: string; name: string; price?: number; modifiers?: unknown } | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ item, onClose, onSaved }) => {
  const [rows, setRows] = useState<Array<{ id?: string; name: string; price: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!item) return;
    setRows(addOnsOf(item.modifiers).map((a) => ({ id: a.id, name: a.name, price: String(a.price) })));
    setError('');
  }, [item]);

  const save = async () => {
    if (!item) return;
    const clean = rows
      .map((row) => ({ ...(row.id ? { id: row.id } : {}), name: row.name.trim(), price: Number(row.price) }))
      .filter((row) => row.name);
    if (clean.some((row) => !Number.isFinite(row.price) || row.price < 0)) {
      setError('Each add-on needs a price of 0 or more.');
      return;
    }
    setSaving(true);
    try {
      await posService.updateMenuItem(item.id, { modifiers: clean } as never);
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the add-ons'));
    } finally {
      setSaving(false);
    }
  };

  const base = Number(item?.price ?? 0);
  const naira = (value: number) => `₦${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const priceOf = (row: { price: string }) => (Number.isFinite(Number(row.price)) && row.price !== '' ? Number(row.price) : 0);
  const withAll = base + rows.filter((row) => row.name.trim()).reduce((sum, row) => sum + priceOf(row), 0);

  return (
    <Dialog open={Boolean(item)} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Add-ons for {item?.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2" color="text.secondary">
            Extras the till and QR menu can add to this item. Each is charged on top of the item price of{' '}
            <strong>{naira(base)}</strong>.
          </Typography>
          {rows.map((row, index) => (
            <Stack key={row.id ?? `new-${index}`} direction="row" spacing={1} alignItems="flex-start">
              <TextField size="small" label="Add-on" value={row.name} onChange={(e) => setRows(rows.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))} fullWidth />
              <TextField
                size="small"
                label="Price (₦)"
                type="number"
                value={row.price}
                onChange={(e) => setRows(rows.map((r, i) => (i === index ? { ...r, price: e.target.value } : r)))}
                inputProps={{ min: 0, step: '0.01', inputMode: 'decimal' }}
                helperText={`Item with it: ${naira(base + priceOf(row))}`}
                sx={{ width: 170 }}
              />
              <IconButton aria-label={`Remove ${row.name || 'add-on'}`} onClick={() => setRows(rows.filter((_, i) => i !== index))}>
                <DeleteOutlineRounded />
              </IconButton>
            </Stack>
          ))}
          <Button startIcon={<AddRounded />} onClick={() => setRows([...rows, { name: '', price: '' }])} disabled={rows.length >= 20} sx={{ alignSelf: 'flex-start' }}>
            Add an add-on
          </Button>
          {rows.some((row) => row.name.trim()) && (
            <Stack direction="row" justifyContent="space-between" sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="body2" color="text.secondary">Item price</Typography>
              <Typography variant="body2" fontWeight={700}>{naira(base)}</Typography>
            </Stack>
          )}
          {rows.some((row) => row.name.trim()) && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">With every add-on</Typography>
              <Typography variant="body2" fontWeight={800}>{naira(withAll)}</Typography>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save add-ons'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddOnsDialog;
