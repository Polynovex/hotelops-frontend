import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/common/DataTable';
import { Outlet, PosMenuItem, PosOrder, posService } from '../../../services/api';
import { posAdminOpsService, PosTableRecord } from '../../../services/posAdminOps';

const tableStatusColor = (status: PosTableRecord['status']) => {
  if (status === 'AVAILABLE') return 'success';
  if (status === 'OCCUPIED') return 'warning';
  if (status === 'RESERVED') return 'error';
  if (status === 'CLEANING') return 'info';
  return 'default';
};

export const PosOutletsPage = () => {
  const [rows, setRows] = useState<Outlet[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('RESTAURANT');

  const load = async () => setRows(await posService.getOutlets());

  useEffect(() => {
    void load();
  }, []);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    await posService.createOutlet({ name: name.trim(), type });
    setName('');
    setType('RESTAURANT');
    await load();
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4, overflowX: 'hidden' }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>POS Outlets</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Outlet configuration for restaurant, bar, room-service and banquet streams.
        </Typography>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Box component="form" onSubmit={create}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label="Outlet Name" value={name} onChange={(event) => setName(event.target.value)} fullWidth required />
              <TextField select label="Outlet Type" value={type} onChange={(event) => setType(event.target.value)} sx={{ minWidth: 180 }}>
                <MenuItem value="RESTAURANT">RESTAURANT</MenuItem>
                <MenuItem value="BAR">BAR</MenuItem>
                <MenuItem value="ROOM_SERVICE">ROOM_SERVICE</MenuItem>
                <MenuItem value="BANQUET">BANQUET</MenuItem>
              </TextField>
              <Button type="submit" variant="contained">Create Outlet</Button>
            </Stack>
          </Box>
        </Paper>

        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          defaultRowsPerPage={10}
          emptyText="No outlets available."
          columns={[
            { key: 'name', label: 'Name', minWidth: 220 },
            { key: 'type', label: 'Type', minWidth: 160 },
            {
              key: 'isActive',
              label: 'Active',
              minWidth: 110,
              render: (row) => (row.isActive ? 'Yes' : 'No')
            }
          ]}
        />
      </Container>
    </Layout>
  );
};

export const PosMenuManagementPage = () => {
  const defaultStations = ['Grill', 'Fry', 'Cold', 'Bar'];
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [items, setItems] = useState<PosMenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stations, setStations] = useState<string[]>(defaultStations);

  const [outletId, setOutletId] = useState('');
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [kitchenStation, setKitchenStation] = useState('');
  const [price, setPrice] = useState(0);
  const [cost, setCost] = useState(0);

  const [newCategory, setNewCategory] = useState('');
  const [newStation, setNewStation] = useState('');

  const load = async () => {
    const [outletRows, itemRows, categoryRows] = await Promise.all([
      posService.getOutlets(),
      posService.getMenuItems(),
      posService.getMenuCategories()
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
        [...defaultStations, ...itemRows.map((item) => item.kitchenStation || '')]
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

    setSku('');
    setName('');
    setPrice(0);
    setCost(0);
    await load();
  };

  const addCategory = async () => {
    if (!newCategory.trim()) {
      return;
    }
    await posService.createMenuCategory(newCategory.trim());
    setNewCategory('');
    await load();
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
    await posService.toggleMenuItemAvailability(itemId, !current);
    await load();
  };

  const toggleActive = async (itemId: string, current: boolean) => {
    await posService.updateMenuItem(itemId, { isActive: !current });
    await load();
  };

  const removeItem = async (itemId: string) => {
    await posService.deleteMenuItem(itemId);
    await load();
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4, overflowX: 'hidden' }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Menu Management</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure menu items, categories, and kitchen stations for POS operations.
        </Typography>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Create Menu Item</Typography>
              <Box component="form" onSubmit={createItem}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField select label="Outlet" value={outletId} onChange={(event) => setOutletId(event.target.value)} sx={{ minWidth: { md: 180 } }} fullWidth>
                    {outlets.map((outlet) => (
                      <MenuItem key={outlet.id} value={outlet.id}>{outlet.name}</MenuItem>
                    ))}
                  </TextField>
                  <TextField label="SKU" value={sku} onChange={(event) => setSku(event.target.value)} required fullWidth />
                  <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} required fullWidth />
                </Stack>

                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ mt: 2 }}>
                  <TextField select label="Category" value={category} onChange={(event) => setCategory(event.target.value)} sx={{ minWidth: { lg: 180 } }} fullWidth>
                    {categories.map((entry) => (
                      <MenuItem key={entry} value={entry}>{entry}</MenuItem>
                    ))}
                  </TextField>
                  <TextField select label="Kitchen Station" value={kitchenStation} onChange={(event) => setKitchenStation(event.target.value)} sx={{ minWidth: { lg: 180 } }} fullWidth>
                    {stations.map((entry) => (
                      <MenuItem key={entry} value={entry}>{entry}</MenuItem>
                    ))}
                  </TextField>
                  <TextField label="Price" type="number" value={price} onChange={(event) => setPrice(Number(event.target.value))} fullWidth />
                  <TextField label="Cost" type="number" value={cost} onChange={(event) => setCost(Number(event.target.value))} fullWidth />
                  <Button type="submit" variant="contained" sx={{ alignSelf: { xs: 'stretch', lg: 'center' } }}>Add Item</Button>
                </Stack>
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
              label: 'Action',
              minWidth: 250,
                  render: (item) => (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Button size="small" onClick={() => void toggleAvailability(item.id, item.isAvailable)}>{item.isAvailable ? 'Hide' : 'Show'}</Button>
                      <Button size="small" onClick={() => void toggleActive(item.id, item.isActive)}>{item.isActive ? 'Disable' : 'Enable'}</Button>
                      <Button size="small" color="error" onClick={() => void removeItem(item.id)}>Delete</Button>
                    </Stack>
                  )
                }
          ]}
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
