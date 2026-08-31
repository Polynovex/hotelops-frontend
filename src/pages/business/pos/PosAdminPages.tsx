import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/common/DataTable';
import RowActionsMenu from '../../../components/common/RowActionsMenu';
import { Outlet, PosMenuItem, PosOrder, posService } from '../../../services/api';
import { posAdminOpsService, PosTableRecord } from '../../../services/posAdminOps';

const OUTLET_TYPES = [
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'BAR', label: 'Bar' },
  { value: 'ROOM_SERVICE', label: 'Room Service' },
  { value: 'BANQUET', label: 'Banquet' },
  { value: 'CAFE', label: 'Café' },
  { value: 'POOLSIDE', label: 'Poolside' },
  { value: 'SPA', label: 'Spa' }
];

const outletTypeLabel = (value: string) =>
  OUTLET_TYPES.find((entry) => entry.value === value)?.label
  ?? value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Pulls the server's message out of an axios error, with a sensible fallback. */
const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string; message?: string } } })
    .response?.data?.error
  ?? (err as { response?: { data?: { message?: string } } }).response?.data?.message
  ?? fallback;

const tableStatusColor = (status: PosTableRecord['status']) => {
  if (status === 'AVAILABLE') return 'success';
  if (status === 'OCCUPIED') return 'warning';
  if (status === 'RESERVED') return 'error';
  if (status === 'CLEANING') return 'info';
  return 'default';
};

export const PosOutletsPage = () => {
  const [rows, setRows] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState('RESTAURANT');

  const [editing, setEditing] = useState<Outlet | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('RESTAURANT');
  const [pendingDelete, setPendingDelete] = useState<Outlet | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Admin view: include deactivated outlets so they can be reactivated.
      setRows(await posService.getAllOutlets());
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load outlets'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    setSaving(true);
    try {
      await posService.createOutlet({ name: name.trim(), type });
      setToast(`${name.trim()} created`);
      setName('');
      setType('RESTAURANT');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not create the outlet'));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (outlet: Outlet) => {
    setEditName(outlet.name);
    setEditType(outlet.type);
    setEditing(outlet);
  };

  const saveEdit = async () => {
    if (!editing || !editName.trim()) {
      return;
    }

    setSaving(true);
    try {
      await posService.updateOutlet(editing.id, {
        name: editName.trim(),
        type: editType
      });
      setToast('Outlet updated');
      setEditing(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not update the outlet'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (outlet: Outlet) => {
    try {
      await posService.updateOutlet(outlet.id, { isActive: !outlet.isActive });
      setToast(outlet.isActive ? `${outlet.name} deactivated` : `${outlet.name} reactivated`);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not change the outlet status'));
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    try {
      await posService.deleteOutlet(pendingDelete.id);
      setToast(`${pendingDelete.name} deleted`);
      await load();
    } catch (err) {
      // Outlets with orders against them cannot be removed; the server says so.
      setError(errorMessage(err, 'Could not delete the outlet'));
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4, overflowX: 'hidden' }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>POS Outlets</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Outlet configuration for restaurant, bar, room-service and banquet streams.
          Every outlet you add here becomes selectable on order entry, menu setup, and QR codes.
        </Typography>

        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper sx={{ p: 2, mb: 2 }}>
          <Box component="form" onSubmit={create}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Outlet Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                fullWidth
                required
              />
              <TextField
                select
                label="Outlet Type"
                value={type}
                onChange={(event) => setType(event.target.value)}
                sx={{ minWidth: { md: 200 } }}
                fullWidth
              >
                {OUTLET_TYPES.map((entry) => (
                  <MenuItem key={entry.value} value={entry.value}>{entry.label}</MenuItem>
                ))}
              </TextField>
              <Button
                type="submit"
                variant="contained"
                disabled={saving || !name.trim()}
                sx={{ minWidth: { md: 160 } }}
              >
                {saving ? 'Saving…' : 'Create Outlet'}
              </Button>
            </Stack>
          </Box>
        </Paper>

        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          defaultRowsPerPage={10}
          emptyText={loading ? 'Loading outlets…' : 'No outlets yet. Create your first one above.'}
          columns={[
            { key: 'name', label: 'Name', minWidth: 220 },
            {
              key: 'type',
              label: 'Type',
              minWidth: 160,
              render: (row) => outletTypeLabel(row.type)
            },
            {
              key: 'isActive',
              label: 'Status',
              minWidth: 120,
              render: (row) => (
                <Chip
                  size="small"
                  label={row.isActive ? 'Active' : 'Inactive'}
                  color={row.isActive ? 'success' : 'default'}
                  variant={row.isActive ? 'filled' : 'outlined'}
                />
              )
            },
            {
              key: 'actions',
              label: 'Actions',
              minWidth: 90,
              render: (row) => (
                <RowActionsMenu
                  subject={row.name}
                  actions={[
                    {
                      key: 'edit',
                      label: 'Edit outlet',
                      icon: <EditIcon fontSize="small" />,
                      onClick: () => openEdit(row)
                    },
                    {
                      key: 'reactivate',
                      label: 'Reactivate',
                      icon: <RestartAltIcon fontSize="small" />,
                      hidden: row.isActive,
                      onClick: () => void toggleActive(row)
                    },
                    {
                      key: 'deactivate',
                      label: 'Deactivate',
                      icon: <BlockIcon fontSize="small" />,
                      hidden: !row.isActive,
                      destructive: true,
                      onClick: () => void toggleActive(row)
                    },
                    {
                      key: 'delete',
                      label: 'Delete permanently',
                      icon: <DeleteOutlineIcon fontSize="small" />,
                      destructive: true,
                      onClick: () => setPendingDelete(row)
                    }
                  ]}
                />
              )
            }
          ]}
        />

        <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
          <DialogTitle>Edit outlet</DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <TextField
                label="Outlet Name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                fullWidth
                required
              />
              <TextField
                select
                label="Outlet Type"
                value={editType}
                onChange={(event) => setEditType(event.target.value)}
                fullWidth
              >
                {OUTLET_TYPES.map((entry) => (
                  <MenuItem key={entry.value} value={entry.value}>{entry.label}</MenuItem>
                ))}
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => void saveEdit()}
              disabled={saving || !editName.trim()}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
          <DialogTitle>Delete this outlet?</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              <strong>{pendingDelete?.name}</strong> will be removed along with its menu
              items, tables, and QR codes. This cannot be undone.
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              To stop taking orders while keeping the outlet's history, deactivate it
              instead of deleting.
            </Alert>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={() => void confirmDelete()}>
              Delete outlet
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={Boolean(toast)}
          autoHideDuration={3000}
          onClose={() => setToast('')}
          message={toast}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Container>
    </Layout>
  );
};

export const PosMenuManagementPage = () => {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [items, setItems] = useState<PosMenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stations, setStations] = useState<string[]>([]);

  const [outletId, setOutletId] = useState('');
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [kitchenStation, setKitchenStation] = useState('');
  const [price, setPrice] = useState(0);
  const [cost, setCost] = useState(0);

  const [newCategory, setNewCategory] = useState('');
  const [newStation, setNewStation] = useState('');

  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PosMenuItem | null>(null);

  const load = async () => {
    const [outletRows, itemRows, categoryRows, stationRows] = await Promise.all([
      posService.getOutlets(),
      posService.getMenuItems(),
      posService.getMenuCategories(),
      posService.getKitchenStations()
    ]);

    setOutlets(outletRows);
    setItems(itemRows);

    const dedupedCategories = Array.from(
      new Set(
        [...categoryRows, ...itemRows.map((item) => item.category || '')]
          .map((entry) => entry.trim())
          .filter(Boolean)
      )
    );
    const dedupedStations = Array.from(
      new Set(
        [...stationRows, ...itemRows.map((item) => item.kitchenStation || '')]
          .map((entry) => entry.trim())
          .filter(Boolean)
      )
    );

    setCategories(dedupedCategories);
    setStations(dedupedStations);

    if (!outletId && outletRows[0]) {
      setOutletId(outletRows[0].id);
    }
    if (!category && dedupedCategories[0]) {
      setCategory(dedupedCategories[0]);
    }
    if (!kitchenStation && dedupedStations[0]) {
      setKitchenStation(dedupedStations[0]);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!outletId || !name.trim() || !sku.trim()) {
      return;
    }

    setSaving(true);
    try {
      await posService.createMenuItem({
        outletId,
        sku: sku.trim(),
        name: name.trim(),
        category,
        kitchenStation,
        price,
        cost,
        isActive: true,
        isAvailable: true
      });

      setToast(`${name.trim()} added to the menu`);
      setSku('');
      setName('');
      setPrice(0);
      setCost(0);
      await load();
    } catch (err) {
      // A duplicate SKU is the common case here and the server names it.
      setError(errorMessage(err, 'Could not add the menu item'));
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async () => {
    if (!newCategory.trim()) {
      return;
    }
    try {
      await posService.createMenuCategory(newCategory.trim());
      setToast(`Category "${newCategory.trim()}" added`);
      setNewCategory('');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not add the category'));
    }
  };

  const addStation = () => {
    if (!newStation.trim()) {
      return;
    }
    setStations((prev) => Array.from(new Set([...prev, newStation.trim()])));
    setNewStation('');
  };

  const visibleItems = useMemo(() => {
    if (!outletId) {
      return items;
    }
    return items.filter((item) => item.outletId === outletId);
  }, [items, outletId]);

  const toggleAvailability = async (itemId: string, current: boolean) => {
    try {
      await posService.toggleMenuItemAvailability(itemId, !current);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not change availability'));
    }
  };

  const toggleActive = async (itemId: string, current: boolean) => {
    try {
      await posService.updateMenuItem(itemId, { isActive: !current });
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not change the item status'));
    }
  };

  const removeItem = async () => {
    if (!pendingDelete) {
      return;
    }
    try {
      await posService.deleteMenuItem(pendingDelete.id);
      setToast(`${pendingDelete.name} removed from the menu`);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the menu item'));
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4, overflowX: 'hidden' }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Menu Management</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure menu items, categories, and kitchen stations for POS operations.
        </Typography>

        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Create Menu Item</Typography>
              <Box component="form" onSubmit={createItem}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} lg={4}>
                    <TextField
                      select
                      label="Outlet"
                      value={outletId}
                      onChange={(event) => setOutletId(event.target.value)}
                      fullWidth
                      helperText={outlets.length === 0 ? 'Create an outlet first' : ' '}
                    >
                      {outlets.map((outlet) => (
                        <MenuItem key={outlet.id} value={outlet.id}>{outlet.name}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6} lg={3}>
                    <TextField label="SKU" value={sku} onChange={(event) => setSku(event.target.value)} required fullWidth helperText=" " />
                  </Grid>
                  <Grid item xs={12} lg={5}>
                    <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} required fullWidth helperText=" " />
                  </Grid>

                  <Grid item xs={12} sm={6} lg={3}>
                    <TextField select label="Category" value={category} onChange={(event) => setCategory(event.target.value)} fullWidth>
                      {categories.map((entry) => (
                        <MenuItem key={entry} value={entry}>{entry}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6} lg={3}>
                    <TextField select label="Kitchen Station" value={kitchenStation} onChange={(event) => setKitchenStation(event.target.value)} fullWidth>
                      {stations.map((entry) => (
                        <MenuItem key={entry} value={entry}>{entry}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={6} sm={3} lg={2}>
                    <TextField label="Price" type="number" value={price} onChange={(event) => setPrice(Number(event.target.value))} fullWidth />
                  </Grid>
                  <Grid item xs={6} sm={3} lg={2}>
                    <TextField label="Cost" type="number" value={cost} onChange={(event) => setCost(Number(event.target.value))} fullWidth />
                  </Grid>
                  <Grid item xs={12} lg={2}>
                    <Button
                      type="submit"
                      variant="contained"
                      fullWidth
                      disabled={saving || outlets.length === 0}
                      sx={{ height: '56px' }}
                    >
                      {saving ? 'Adding…' : 'Add Item'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Stack spacing={2}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Categories</Typography>
                <Stack direction="row" spacing={1}>
                  <TextField size="small" label="New Category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} fullWidth />
                  <Button variant="outlined" onClick={() => void addCategory()}>Add</Button>
                </Stack>
              </Paper>

              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Kitchen Stations</Typography>
                <Stack direction="row" spacing={1}>
                  <TextField size="small" label="New Station" value={newStation} onChange={(event) => setNewStation(event.target.value)} fullWidth />
                  <Button variant="outlined" onClick={addStation}>Add</Button>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  A new station becomes permanent once you save a menu item against it.
                  Until then it is only available in this session.
                </Typography>
              </Paper>
            </Stack>
          </Grid>
        </Grid>

        <DataTable
          rows={visibleItems}
          rowKey={(item) => item.id}
          defaultRowsPerPage={10}
          emptyText="No menu items found for selected outlet."
          columns={[
            { key: 'sku', label: 'SKU', minWidth: 120 },
            { key: 'name', label: 'Name', minWidth: 180 },
            { key: 'category', label: 'Category', minWidth: 140 },
            { key: 'kitchenStation', label: 'Station', minWidth: 130 },
            {
              key: 'price',
              label: 'Price',
              minWidth: 130,
              render: (item) => `₦${item.price.toLocaleString()}`
            },
            {
              key: 'status',
              label: 'Status',
              minWidth: 220,
              render: (item) => (
                <Stack direction="row" spacing={1}>
                  <Chip size="small" label={item.isActive ? 'Active' : 'Inactive'} color={item.isActive ? 'success' : 'default'} />
                  <Chip size="small" label={item.isAvailable ? 'Available' : 'Unavailable'} color={item.isAvailable ? 'info' : 'warning'} />
                </Stack>
              )
            },
            {
              key: 'action',
              label: 'Actions',
              minWidth: 90,
              render: (item) => (
                <RowActionsMenu
                  subject={item.name}
                  actions={[
                    {
                      key: 'availability',
                      label: item.isAvailable ? 'Mark unavailable' : 'Mark available',
                      onClick: () => void toggleAvailability(item.id, item.isAvailable)
                    },
                    {
                      key: 'active',
                      label: item.isActive ? 'Disable item' : 'Enable item',
                      onClick: () => void toggleActive(item.id, item.isActive)
                    },
                    {
                      key: 'delete',
                      label: 'Delete item',
                      icon: <DeleteOutlineIcon fontSize="small" />,
                      destructive: true,
                      onClick: () => setPendingDelete(item)
                    }
                  ]}
                />
              )
            }
          ]}
        />

        <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
          <DialogTitle>Delete this menu item?</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              <strong>{pendingDelete?.name}</strong> ({pendingDelete?.sku}) will be removed
              from the menu permanently.
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              To take it off the menu temporarily — out of stock, seasonal — mark it
              unavailable instead. That keeps its sales history intact.
            </Alert>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={() => void removeItem()}>
              Delete item
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={Boolean(toast)}
          autoHideDuration={3000}
          onClose={() => setToast('')}
          message={toast}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Container>
    </Layout>
  );
};

export const PosTableManagementPage = () => {
  const [tables, setTables] = useState<PosTableRecord[]>(posAdminOpsService.listTables());
  const [orders, setOrders] = useState<PosOrder[]>([]);

  const load = async () => {
    setTables(posAdminOpsService.listTables());
    setOrders(await posService.getOrders());
  };

  useEffect(() => {
    void load();
  }, []);

  const setStatus = (tableId: string, status: PosTableRecord['status']) => {
    posAdminOpsService.updateTableStatus(tableId, status);
    void load();
  };

  const ordersByTable = useMemo(() => {
    return orders.reduce<Record<string, number>>((acc, order) => {
      const key = order.tableNumber || '';
      if (!key) {
        return acc;
      }
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [orders]);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4, overflowX: 'hidden' }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Table Management</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Visual table status board for dine-in operations.
        </Typography>

        <Grid container spacing={2}>
          {tables.map((table) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={table.id}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{table.tableNumber}</Typography>
                <Typography variant="body2" color="text.secondary">{table.floor} • {table.seats} seats</Typography>
                <Chip sx={{ mt: 1.2 }} label={table.status} color={tableStatusColor(table.status) as 'default'} />
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Active Orders: {ordersByTable[table.tableNumber] || 0}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1.2 }} flexWrap="wrap" useFlexGap>
                  <Button size="small" onClick={() => setStatus(table.id, 'AVAILABLE')}>Available</Button>
                  <Button size="small" onClick={() => setStatus(table.id, 'OCCUPIED')}>Occupied</Button>
                  <Button size="small" onClick={() => setStatus(table.id, 'RESERVED')}>Reserved</Button>
                  <Button size="small" onClick={() => setStatus(table.id, 'CLEANING')}>Cleaning</Button>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Layout>
  );
};
