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
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import EditRounded from '@mui/icons-material/EditRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import { useSnackbar } from 'notistack';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import { useAuthStore } from '../../../store/authStore';
import { posFlow, type Outlet, type PosOrderRow, type PosTable } from '../../../services/posFlow';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * Outlet tables.
 *
 * Owners and managers create and configure tables per outlet; POS staff see the
 * same floor with each table's live state — free, or which order is open on
 * it. This replaced a version that kept tables in browser storage, so nothing
 * configured on one terminal ever reached another.
 */
export default function TablesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const role = useAuthStore((state) => String(state.user?.role || '').toUpperCase());
  const canConfigure = role === 'BUSINESS_ADMIN' || role === 'MANAGER';
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState('');
  const [tables, setTables] = useState<PosTable[]>([]);
  const [openOrders, setOpenOrders] = useState<PosOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ id?: string; tableNumber: string; capacity: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const outletRows = await posFlow.outlets();
      setOutlets(outletRows);
      const current = outletId || outletRows[0]?.id || '';
      if (!outletId && current) setOutletId(current);
      if (current) {
        const [tableRows, orders] = await Promise.all([
          posFlow.tables(current),
          posFlow.orders({ outletId: current }).catch(() => [])
        ]);
        setTables(tableRows);
        setOpenOrders(orders.filter((order) => order.orderStatus !== 'COMPLETED' && order.orderStatus !== 'VOIDED'));
      }
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load tables'));
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    void load();
  }, [load]);

  const orderOn = useMemo(() => {
    const map = new Map<string, PosOrderRow>();
    for (const order of openOrders) if (order.tableNumber) map.set(order.tableNumber, order);
    return map;
  }, [openOrders]);

  const save = async () => {
    if (!editing) return;
    try {
      if (editing.id) {
        await posFlow.updateTable(editing.id, { tableNumber: editing.tableNumber.trim(), capacity: editing.capacity });
      } else {
        await posFlow.createTable({ outletId, tableNumber: editing.tableNumber.trim(), capacity: editing.capacity });
      }
      enqueueSnackbar(`Table ${editing.tableNumber} saved`, { variant: 'success' });
      setEditing(null);
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not save the table'), { variant: 'error' });
    }
  };

  const remove = async (table: PosTable) => {
    if (orderOn.has(table.tableNumber)) {
      enqueueSnackbar(`Table ${table.tableNumber} has an open order`, { variant: 'warning' });
      return;
    }
    try {
      await posFlow.deleteTable(table.id);
      enqueueSnackbar(`Table ${table.tableNumber} removed`, { variant: 'success' });
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not remove the table'), { variant: 'error' });
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Tables</Typography>
            <Typography variant="body2" color="text.secondary">
              {canConfigure ? 'Create and configure tables for each outlet.' : 'Live table status for each outlet.'}
            </Typography>
          </Box>
          {canConfigure && outletId && (
            <Button variant="contained" onClick={() => setEditing({ tableNumber: '', capacity: 4 })}>Add table</Button>
          )}
        </Stack>

        <Tabs value={outletId || false} onChange={(_event, value) => setOutletId(value)} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2 }}>
          {outlets.map((outlet) => <Tab key={outlet.id} value={outlet.id} label={outlet.name} sx={{ textTransform: 'none', fontWeight: 700 }} />)}
        </Tabs>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!loading && outlets.length === 0 && <Alert severity="info">Create an outlet in Menu Configuration first.</Alert>}

        <Grid container spacing={2}>
          {tables.map((table) => {
            const order = orderOn.get(table.tableNumber);
            return (
              <Grid item xs={6} sm={4} md={3} lg={2} key={table.id}>
                <Card variant="outlined" sx={{ borderColor: order ? 'warning.main' : 'success.light', height: '100%' }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Typography variant="h6" fontWeight={800}>{table.tableNumber}</Typography>
                      {canConfigure && (
                        <Stack direction="row">
                          <Tooltip title="Edit"><IconButton size="small" onClick={() => setEditing({ id: table.id, tableNumber: table.tableNumber, capacity: table.capacity })}><EditRounded fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Remove"><IconButton size="small" onClick={() => void remove(table)}><DeleteOutlineRounded fontSize="small" /></IconButton></Tooltip>
                        </Stack>
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">Seats {table.capacity}</Typography>
                    <Box sx={{ mt: 1 }}>
                      {order ? (
                        <Chip size="small" color="warning" label={`${order.orderNumber.slice(-6)} · ${order.orderStatus.replace(/_/g, ' ').toLowerCase()}`} />
                      ) : (
                        <Chip size="small" color="success" variant="outlined" label="Free" />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
          {!loading && outletId && tables.length === 0 && (
            <Grid item xs={12}><Typography color="text.secondary">No tables in this outlet yet.</Typography></Grid>
          )}
        </Grid>

        <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
          <DialogTitle>{editing?.id ? 'Edit table' : 'Add table'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField autoFocus label="Table number / name" value={editing?.tableNumber ?? ''} onChange={(event) => editing && setEditing({ ...editing, tableNumber: event.target.value })} />
              <TextField select label="Seats" value={editing?.capacity ?? 4} onChange={(event) => editing && setEditing({ ...editing, capacity: Number(event.target.value) })}>
                {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20].map((seats) => <MenuItem key={seats} value={seats}>{seats}</MenuItem>)}
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="contained" onClick={() => void save()} disabled={!editing?.tableNumber.trim()}>Save</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
}
