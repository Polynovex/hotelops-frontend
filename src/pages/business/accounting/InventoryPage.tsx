import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import { AddRounded, WarningAmberRounded } from '@mui/icons-material';
import { useAuthStore } from '../../../store/authStore';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import DataTable from '../../../components/common/DataTable';
import { apiFetch } from '../../../utils/apiFetch';
import { getApiErrorMessage } from '../../../utils/apiError';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  costPrice: number;
  currentStock: number;
  reorderLevel: number;
  isConsumable: boolean;
  category?: { name: string } | null;
}

interface StockValuation {
  rows: Array<{ id: string; sku: string; name: string; category: string | null; unit: string; currentStock: number; costPrice: number; totalValue: number; reorderLevel: number; belowReorder: boolean }>;
  totalValue: number;
  lowStockCount: number;
}

const InventoryPage = () => {
  const token = useAuthStore((s) => s.token);
  const baseUrl = (import.meta as any).env?.VITE_API_URL ?? '';

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [valuation, setValuation] = useState<StockValuation | null>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ sku: '', name: '', unit: 'pcs', costPrice: 0, reorderLevel: 0, isConsumable: false });
  const [txnForm, setTxnForm] = useState({ itemId: '', type: 'RECEIVE', quantity: 1, notes: '' });
  const [openTxn, setOpenTxn] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [itemsRes, valRes] = await Promise.all([
        fetch(`${baseUrl}/inventory/items`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${baseUrl}/inventory/valuation`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (itemsRes.ok) setItems(await itemsRes.json());
      if (valRes.ok) setValuation(await valRes.json());
    } catch (err: any) {
      setError(err.message ?? 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const createItem = async () => {
    setSaving(true);
    try {
      await apiFetch(`${baseUrl}/inventory/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
        fallbackMessage: 'Could not add the inventory item'
      });
      setOpenAdd(false);
      setForm({ sku: '', name: '', unit: 'pcs', costPrice: 0, reorderLevel: 0, isConsumable: false });
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not add the inventory item'));
    } finally {
      setSaving(false);
    }
  };

  const createTransaction = async () => {
    setSaving(true);
    try {
      await apiFetch(`${baseUrl}/inventory/transactions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...txnForm, quantity: Number(txnForm.quantity) }),
        fallbackMessage: 'Could not record the stock movement'
      });
      setOpenTxn(false);
      setTxnForm({ itemId: '', type: 'RECEIVE', quantity: 1, notes: '' });
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not record the stock movement'));
    } finally {
      setSaving(false);
    }
  };

  const fmt = (v: number) => `₦${v.toLocaleString()}`;

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2} mb={3}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Inventory Management</Typography>
            <Typography variant="body2" color="text.secondary">Sage-style stock control — double-entry costing and valuation</Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" startIcon={<AddRounded />} onClick={() => setOpenTxn(true)}>Stock Movement</Button>
            <Button variant="contained" startIcon={<AddRounded />} onClick={() => setOpenAdd(true)}>Add Item</Button>
          </Stack>
        </Stack>

        {loading && <LogoLoader inline minHeight={160} label="Loading inventory…" />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {valuation && (
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">Total Stock Value</Typography>
                  <Typography variant="h4" fontWeight={700}>{fmt(valuation.totalValue)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">Total Items</Typography>
                  <Typography variant="h4" fontWeight={700}>{valuation.rows.length}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ borderLeft: valuation.lowStockCount > 0 ? '4px solid' : undefined, borderColor: 'warning.main' }}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {valuation.lowStockCount > 0 && <WarningAmberRounded color="warning" />}
                    <Typography color="text.secondary" variant="body2">Low Stock Items</Typography>
                  </Stack>
                  <Typography variant="h4" fontWeight={700} color={valuation.lowStockCount > 0 ? 'warning.main' : 'text.primary'}>
                    {valuation.lowStockCount}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Stock Items" />
          <Tab label="Valuation Report" />
        </Tabs>

        {tab === 0 && (
          <Paper sx={{ p: 2 }}>
            <DataTable
              rows={items}
              rowKey={(r) => r.id}
              defaultRowsPerPage={20}
              emptyText="No inventory items found."
              columns={[
                { key: 'sku', label: 'SKU', minWidth: 110 },
                { key: 'name', label: 'Name', minWidth: 180 },
                { key: 'category', label: 'Category', minWidth: 130, render: (r) => r.category?.name ?? '—' },
                { key: 'unit', label: 'Unit', minWidth: 80 },
                { key: 'currentStock', label: 'Stock', minWidth: 100 },
                { key: 'reorderLevel', label: 'Reorder At', minWidth: 110 },
                { key: 'costPrice', label: 'Unit Cost', minWidth: 120, render: (r) => fmt(r.costPrice) },
                {
                  key: 'status',
                  label: 'Status',
                  minWidth: 130,
                  render: (r) => r.currentStock <= r.reorderLevel
                    ? <Chip size="small" label="Low Stock" color="warning" />
                    : <Chip size="small" label="OK" color="success" />
                },
                { key: 'isConsumable', label: 'Type', minWidth: 120, render: (r) => r.isConsumable ? <Chip size="small" label="Consumable" color="info" /> : <Chip size="small" label="Asset" /> }
              ]}
            />
          </Paper>
        )}

        {tab === 1 && valuation && (
          <Paper sx={{ p: 2 }}>
            <DataTable
              rows={valuation.rows}
              rowKey={(r) => r.id}
              defaultRowsPerPage={20}
              emptyText="No items."
              columns={[
                { key: 'sku', label: 'SKU', minWidth: 110 },
                { key: 'name', label: 'Name', minWidth: 180 },
                { key: 'category', label: 'Category', minWidth: 130, render: (r) => r.category ?? '—' },
                { key: 'currentStock', label: 'Qty', minWidth: 90 },
                { key: 'unit', label: 'Unit', minWidth: 80 },
                { key: 'costPrice', label: 'Unit Cost', minWidth: 120, render: (r) => fmt(r.costPrice) },
                { key: 'totalValue', label: 'Total Value', minWidth: 140, render: (r) => fmt(r.totalValue) },
                {
                  key: 'belowReorder',
                  label: 'Stock Alert',
                  minWidth: 120,
                  render: (r) => r.belowReorder ? <Chip size="small" label="⚠ Low" color="warning" /> : '—'
                }
              ]}
            />
            <Stack direction="row" justifyContent="flex-end" mt={2} pt={1} sx={{ borderTop: '2px solid', borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={700}>Total: {fmt(valuation.totalValue)}</Typography>
            </Stack>
          </Paper>
        )}

        {/* Add Item Dialog */}
        <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add Inventory Item</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <Stack direction="row" spacing={2}>
                <TextField label="SKU *" value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} fullWidth />
                <TextField label="Name *" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} fullWidth />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField label="Unit" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} fullWidth />
                <TextField label="Unit Cost (₦)" type="number" value={form.costPrice} onChange={(e) => setForm((p) => ({ ...p, costPrice: Number(e.target.value) }))} fullWidth />
                <TextField label="Reorder Level" type="number" value={form.reorderLevel} onChange={(e) => setForm((p) => ({ ...p, reorderLevel: Number(e.target.value) }))} fullWidth />
              </Stack>
              <TextField select label="Item Type" value={form.isConsumable ? 'consumable' : 'asset'} onChange={(e) => setForm((p) => ({ ...p, isConsumable: e.target.value === 'consumable' }))}>
                <MenuItem value="asset">Asset / Resale</MenuItem>
                <MenuItem value="consumable">Consumable (Housekeeping)</MenuItem>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
            <Button variant="contained" onClick={createItem} disabled={saving || !form.sku || !form.name}>
              {saving ? 'Saving…' : 'Add Item'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Stock Movement Dialog */}
        <Dialog open={openTxn} onClose={() => setOpenTxn(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Record Stock Movement</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <TextField select label="Item *" value={txnForm.itemId} onChange={(e) => setTxnForm((p) => ({ ...p, itemId: e.target.value }))} fullWidth>
                {items.map((i) => <MenuItem key={i.id} value={i.id}>{i.name} ({i.sku})</MenuItem>)}
              </TextField>
              <TextField select label="Transaction Type" value={txnForm.type} onChange={(e) => setTxnForm((p) => ({ ...p, type: e.target.value }))}>
                <MenuItem value="RECEIVE">Receive (Stock In)</MenuItem>
                <MenuItem value="ISSUE">Issue (Stock Out)</MenuItem>
                <MenuItem value="ADJUSTMENT">Adjustment</MenuItem>
              </TextField>
              <TextField label="Quantity *" type="number" value={txnForm.quantity} onChange={(e) => setTxnForm((p) => ({ ...p, quantity: Number(e.target.value) }))} />
              <TextField label="Notes" value={txnForm.notes} onChange={(e) => setTxnForm((p) => ({ ...p, notes: e.target.value }))} multiline rows={2} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenTxn(false)}>Cancel</Button>
            <Button variant="contained" onClick={createTransaction} disabled={saving || !txnForm.itemId || !txnForm.quantity}>
              {saving ? 'Saving…' : 'Record'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default InventoryPage;
