import { useCallback, useEffect, useMemo, useState } from 'react';
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
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import { AddRounded, WarningAmberRounded } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import DataTable from '../../../components/common/DataTable';
import RowActionsMenu from '../../../components/common/RowActionsMenu';
import { api } from '../../../services/api';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * Inventory, split into the hotel's stock sections the way the menu is split
 * by outlet: Office Stationeries, Housekeeping Materials, Kitchen, Fresh
 * Bakery, Bar, Restaurant, Poolside and Kitchen Stationeries, plus any the
 * hotel adds. Each section has its items (full CRUD), stock in/out, a
 * movement report (opening, in, out, closing) and valuation.
 */

interface Category {
  id: string;
  name: string;
  code: string | null;
  itemCount: number;
  isStandard: boolean;
}

interface Item {
  id: string;
  sku: string;
  name: string;
  unit: string;
  costPrice: number;
  currentStock: number;
  reorderLevel: number;
  isConsumable: boolean;
  isActive: boolean;
  categoryId: string | null;
  category?: { name: string } | null;
}

interface MovementRow {
  id: string;
  sku: string;
  name: string;
  unit: string;
  category: string | null;
  openingQty: number;
  inQty: number;
  outQty: number;
  closingQty: number;
  openingValue: number;
  inValue: number;
  outValue: number;
  closingValue: number;
}

interface MovementReport {
  rows: MovementRow[];
  byCategory: Array<{ category: string; inValue: number; outValue: number; closingValue: number }>;
  totals: { inValue: number; outValue: number; openingValue: number; closingValue: number };
}

const naira = (value: number) => `₦${(Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const emptyItem = { sku: '', name: '', unit: 'pcs', costPrice: 0, reorderLevel: 0, isConsumable: false, openingStock: 0 };

const InventoryPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [view, setView] = useState<'items' | 'movements' | 'valuation'>('items');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('ALL');
  const [items, setItems] = useState<Item[]>([]);
  const [report, setReport] = useState<MovementReport | null>(null);
  const [range, setRange] = useState({
    from: new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10)
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState<(typeof emptyItem & { id?: string; categoryId: string }) | null>(null);
  const [moving, setMoving] = useState<{ item: Item; type: 'RECEIVE' | 'ISSUE' | 'ADJUSTMENT'; quantity: string; unitCost: string; notes: string } | null>(null);
  const [newCategory, setNewCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cats, itemRows] = await Promise.all([
        api.get('/inventory/categories'),
        api.get('/inventory/items', { params: categoryId !== 'ALL' ? { categoryId } : undefined })
      ]);
      setCategories(cats.data);
      setItems(itemRows.data);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load inventory'));
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  const loadReport = useCallback(async () => {
    try {
      const { data } = await api.get('/inventory/movements', {
        params: { from: range.from, to: range.to, ...(categoryId !== 'ALL' ? { categoryId } : {}) }
      });
      setReport(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load the movement report'));
    }
  }, [range.from, range.to, categoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (view !== 'items') void loadReport();
  }, [view, loadReport]);

  const lowStock = useMemo(() => items.filter((item) => item.currentStock <= item.reorderLevel), [items]);
  const stockValue = useMemo(() => items.reduce((sum, item) => sum + item.currentStock * item.costPrice, 0), [items]);

  const saveItem = async () => {
    if (!editing) return;
    try {
      const payload = {
        sku: editing.sku.trim(),
        name: editing.name.trim(),
        unit: editing.unit.trim() || 'pcs',
        costPrice: Number(editing.costPrice),
        reorderLevel: Number(editing.reorderLevel),
        isConsumable: editing.isConsumable,
        categoryId: editing.categoryId || undefined
      };
      if (editing.id) {
        await api.put(`/inventory/items/${editing.id}`, payload);
      } else {
        await api.post('/inventory/items', { ...payload, openingStock: Number(editing.openingStock) || 0 });
      }
      enqueueSnackbar(`${payload.name} saved`, { variant: 'success' });
      setEditing(null);
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not save the item'), { variant: 'error' });
    }
  };

  const deleteItem = async (item: Item) => {
    try {
      const { data } = await api.delete(`/inventory/items/${item.id}`);
      enqueueSnackbar(data.archived ? `${item.name} archived (it has stock history)` : `${item.name} deleted`, { variant: 'success' });
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not delete the item'), { variant: 'error' });
    }
  };

  const saveMovement = async () => {
    if (!moving) return;
    try {
      await api.post('/inventory/transactions', {
        itemId: moving.item.id,
        type: moving.type,
        quantity: Number(moving.quantity),
        ...(moving.unitCost ? { unitCost: Number(moving.unitCost) } : {}),
        notes: moving.notes || undefined
      });
      enqueueSnackbar(`${moving.type === 'ISSUE' ? 'Stock out' : 'Stock in'} recorded for ${moving.item.name}`, { variant: 'success' });
      setMoving(null);
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not record the movement'), { variant: 'error' });
    }
  };

  const addCategory = async () => {
    if (!newCategory?.trim()) return;
    try {
      await api.post('/inventory/categories', { name: newCategory.trim() });
      setNewCategory(null);
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not add the category'), { variant: 'error' });
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Inventory</Typography>
            <Typography variant="body2" color="text.secondary">Stock by section, movements in and out, and valuation.</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => setNewCategory('')}>Add section</Button>
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => setEditing({ ...emptyItem, categoryId: categoryId !== 'ALL' ? categoryId : '' })}
            >
              Add item
            </Button>
          </Stack>
        </Stack>

        {/* Sections, like outlets in menu configuration. */}
        <Tabs value={categoryId} onChange={(_event, value) => setCategoryId(value)} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab value="ALL" label="All" sx={{ textTransform: 'none', fontWeight: 700 }} />
          {categories.map((category) => (
            <Tab key={category.id} value={category.id} label={`${category.name} (${category.itemCount})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
          ))}
        </Tabs>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          {[
            ['Items', items.length],
            ['Stock value', naira(stockValue)],
            ['Below reorder level', lowStock.length]
          ].map(([label, value]) => (
            <Grid item xs={12} sm={4} key={String(label)}>
              <Card><CardContent>
                <Typography variant="body2" color="text.secondary">{label}</Typography>
                <Typography variant="h5" fontWeight={700}>{value}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>

        {lowStock.length > 0 && view === 'items' && (
          <Alert severity="warning" icon={<WarningAmberRounded />} sx={{ mb: 2 }}>
            Reorder: {lowStock.slice(0, 6).map((item) => item.name).join(', ')}{lowStock.length > 6 ? ` and ${lowStock.length - 6} more` : ''}
          </Alert>
        )}

        <Tabs value={view} onChange={(_event, value) => setView(value)} sx={{ mb: 2 }}>
          <Tab value="items" label="Items" />
          <Tab value="movements" label="Stock in / out" />
          <Tab value="valuation" label="Valuation" />
        </Tabs>

        {loading && <LogoLoader inline minHeight={160} />}

        {view === 'items' && !loading && (
          <DataTable
            rows={items}
            rowKey={(item) => item.id}
            defaultRowsPerPage={20}
            emptyText="No items in this section yet."
            columns={[
              { key: 'sku', label: 'SKU', minWidth: 100 },
              { key: 'name', label: 'Item', minWidth: 180 },
              { key: 'category', label: 'Section', minWidth: 160, render: (item) => item.category?.name ?? '—' },
              {
                key: 'currentStock',
                label: 'On hand',
                minWidth: 120,
                render: (item) => (
                  <Typography variant="body2" fontWeight={700} color={item.currentStock <= item.reorderLevel ? 'error.main' : undefined}>
                    {item.currentStock} {item.unit}
                  </Typography>
                )
              },
              { key: 'reorderLevel', label: 'Reorder at', minWidth: 100 },
              { key: 'costPrice', label: 'Unit cost', minWidth: 110, render: (item) => naira(item.costPrice) },
              { key: 'value', label: 'Value', minWidth: 120, render: (item) => naira(item.currentStock * item.costPrice) },
              {
                key: 'actions',
                label: '',
                minWidth: 260,
                render: (item) => (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button size="small" onClick={() => setMoving({ item, type: 'RECEIVE', quantity: '', unitCost: String(item.costPrice), notes: '' })}>Stock in</Button>
                    <Button size="small" color="warning" onClick={() => setMoving({ item, type: 'ISSUE', quantity: '', unitCost: '', notes: '' })} disabled={item.currentStock <= 0}>Stock out</Button>
                    <RowActionsMenu
                      subject={item.name}
                      actions={[
                        {
                          key: 'edit',
                          label: 'Edit',
                          onClick: () =>
                            setEditing({
                              id: item.id,
                              sku: item.sku,
                              name: item.name,
                              unit: item.unit,
                              costPrice: item.costPrice,
                              reorderLevel: item.reorderLevel,
                              isConsumable: item.isConsumable,
                              openingStock: 0,
                              categoryId: item.categoryId ?? ''
                            })
                        },
                        { key: 'adjust', label: 'Adjust count (add)', onClick: () => setMoving({ item, type: 'ADJUSTMENT', quantity: '', unitCost: '', notes: '' }) },
                        { key: 'delete', label: 'Delete', destructive: true, onClick: () => void deleteItem(item) }
                      ]}
                    />
                  </Stack>
                )
              }
            ]}
          />
        )}

        {view !== 'items' && (
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField size="small" type="date" label="From" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField size="small" type="date" label="To" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} InputLabelProps={{ shrink: true }} />
          </Stack>
        )}

        {view === 'movements' && report && (
          <>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {[
                ['Opening value', report.totals.openingValue],
                ['Stock in', report.totals.inValue],
                ['Stock out', report.totals.outValue],
                ['Closing value', report.totals.closingValue]
              ].map(([label, value]) => (
                <Grid item xs={6} md={3} key={String(label)}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="h6" fontWeight={700}>{naira(Number(value))}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
            <DataTable
              rows={report.rows.filter((row) => row.inQty || row.outQty || row.openingQty || row.closingQty)}
              rowKey={(row) => row.id}
              defaultRowsPerPage={20}
              emptyText="No stock in this period."
              columns={[
                { key: 'name', label: 'Item', minWidth: 180 },
                { key: 'category', label: 'Section', minWidth: 150, render: (row) => row.category ?? '—' },
                { key: 'openingQty', label: 'Opening', minWidth: 90, render: (row) => `${row.openingQty} ${row.unit}` },
                { key: 'inQty', label: 'In', minWidth: 80, render: (row) => <Typography variant="body2" color="success.main">+{row.inQty}</Typography> },
                { key: 'outQty', label: 'Out', minWidth: 80, render: (row) => <Typography variant="body2" color="warning.main">−{row.outQty}</Typography> },
                { key: 'closingQty', label: 'Closing', minWidth: 90, render: (row) => `${row.closingQty} ${row.unit}` },
                { key: 'inValue', label: 'In value', minWidth: 110, render: (row) => naira(row.inValue) },
                { key: 'outValue', label: 'Out value', minWidth: 110, render: (row) => naira(row.outValue) },
                { key: 'closingValue', label: 'Closing value', minWidth: 120, render: (row) => naira(row.closingValue) }
              ]}
            />
          </>
        )}

        {view === 'valuation' && report && (
          <DataTable
            rows={report.byCategory}
            rowKey={(row) => row.category}
            emptyText="No stock to value."
            columns={[
              { key: 'category', label: 'Section', minWidth: 200 },
              { key: 'inValue', label: 'Stock in (period)', minWidth: 140, render: (row) => naira(row.inValue) },
              { key: 'outValue', label: 'Stock out (period)', minWidth: 140, render: (row) => naira(row.outValue) },
              { key: 'closingValue', label: 'Value on hand', minWidth: 140, render: (row) => <strong>{naira(row.closingValue)}</strong> }
            ]}
          />
        )}

        <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
          <DialogTitle>{editing?.id ? 'Edit item' : 'Add item'}</DialogTitle>
          <DialogContent>
            {editing && (
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12} sm={4}><TextField fullWidth label="SKU" value={editing.sku} disabled={Boolean(editing.id)} onChange={(event) => setEditing({ ...editing, sku: event.target.value })} /></Grid>
                <Grid item xs={12} sm={8}><TextField fullWidth label="Name" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></Grid>
                <Grid item xs={12} sm={6}>
                  <TextField select fullWidth label="Section" value={editing.categoryId} onChange={(event) => setEditing({ ...editing, categoryId: event.target.value })}>
                    <MenuItem value="">None</MenuItem>
                    {categories.map((category) => <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={3}><TextField fullWidth label="Unit" value={editing.unit} onChange={(event) => setEditing({ ...editing, unit: event.target.value })} placeholder="kg, pcs, L" /></Grid>
                <Grid item xs={6} sm={3}><TextField fullWidth type="number" label="Unit cost (₦)" value={editing.costPrice} onChange={(event) => setEditing({ ...editing, costPrice: Number(event.target.value) })} /></Grid>
                <Grid item xs={6}><TextField fullWidth type="number" label="Reorder level" value={editing.reorderLevel} onChange={(event) => setEditing({ ...editing, reorderLevel: Number(event.target.value) })} /></Grid>
                {!editing.id && (
                  <Grid item xs={6}><TextField fullWidth type="number" label="Opening stock" value={editing.openingStock} onChange={(event) => setEditing({ ...editing, openingStock: Number(event.target.value) })} /></Grid>
                )}
                <Grid item xs={12}>
                  <FormControlLabel control={<Switch checked={editing.isConsumable} onChange={(event) => setEditing({ ...editing, isConsumable: event.target.checked })} />} label="Consumable (used up, e.g. toiletries)" />
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="contained" onClick={() => void saveItem()} disabled={!editing?.sku.trim() || !editing?.name.trim()}>Save</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(moving)} onClose={() => setMoving(null)} fullWidth maxWidth="xs">
          <DialogTitle>
            {moving?.type === 'RECEIVE' ? 'Stock in' : moving?.type === 'ISSUE' ? 'Stock out' : 'Adjust count'}: {moving?.item.name}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Chip label={`${moving?.item.currentStock ?? 0} ${moving?.item.unit ?? ''} on hand`} sx={{ alignSelf: 'flex-start' }} />
              <TextField autoFocus type="number" label={`Quantity (${moving?.item.unit ?? ''})`} value={moving?.quantity ?? ''} onChange={(event) => moving && setMoving({ ...moving, quantity: event.target.value })} />
              {moving?.type === 'RECEIVE' && (
                <TextField type="number" label="Unit cost (₦)" value={moving.unitCost} onChange={(event) => setMoving({ ...moving, unitCost: event.target.value })} />
              )}
              <TextField label="Note" value={moving?.notes ?? ''} onChange={(event) => moving && setMoving({ ...moving, notes: event.target.value })} placeholder={moving?.type === 'ISSUE' ? 'Issued to…' : 'Supplier / invoice'} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMoving(null)}>Cancel</Button>
            <Button variant="contained" onClick={() => void saveMovement()} disabled={!(Number(moving?.quantity) > 0)}>Record</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={newCategory !== null} onClose={() => setNewCategory(null)} fullWidth maxWidth="xs">
          <DialogTitle>Add inventory section</DialogTitle>
          <DialogContent>
            <TextField autoFocus fullWidth label="Name" value={newCategory ?? ''} onChange={(event) => setNewCategory(event.target.value)} sx={{ mt: 1 }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setNewCategory(null)}>Cancel</Button>
            <Button variant="contained" onClick={() => void addCategory()} disabled={!newCategory?.trim()}>Add</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default InventoryPage;
