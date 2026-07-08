import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,

  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { format } from 'date-fns';
import { useSnackbar } from 'notistack';
import Layout from '../components/Layout';
import LogoLoader from '../components/LogoLoader';
import { Outlet, posService, PosOrder } from '../services/api';

type CreateOrderForm = {
  outletId: string;
  orderType: PosOrder['orderType'];
  tableNumber: string;
  bookingId: string;
  subtotal: string;
  tax: string;
  total: string;
};

const orderStatusColor = (status: PosOrder['orderStatus']) => {
  if (status === 'COMPLETED') return 'success';
  if (status === 'SENT_TO_KITCHEN') return 'info';
  if (status === 'VOIDED') return 'error';
  return 'warning';
};

const PosPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [kdsOrders, setKdsOrders] = useState<PosOrder[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [createForm, setCreateForm] = useState<CreateOrderForm>({
    outletId: '',
    orderType: 'DINE_IN',
    tableNumber: '',
    bookingId: '',
    subtotal: '',
    tax: '',
    total: ''
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [outletData, orderData, kdsData, pendingSyncData] = await Promise.all([
        posService.getOutlets(),
        posService.getOrders(),
        posService.getKdsOrders(),
        posService.getPendingSync()
      ]);

      setOutlets(outletData);
      setOrders(orderData);
      setKdsOrders(kdsData);
      setPendingSyncCount(Number(pendingSyncData.pendingCount || 0));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load POS data';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const totals = useMemo(() => {
    const open = orders.filter((order) => order.orderStatus === 'OPEN').length;
    const sent = orders.filter((order) => order.orderStatus === 'SENT_TO_KITCHEN').length;
    const completed = orders.filter((order) => order.orderStatus === 'COMPLETED');
    const sales = completed.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const avg = completed.length > 0 ? sales / completed.length : 0;

    return {
      open,
      sent,
      completed: completed.length,
      sales,
      averageTicket: avg
    };
  }, [orders]);

  const updateOrderLocally = (updatedOrder: PosOrder | undefined) => {
    if (!updatedOrder) {
      return;
    }
    setOrders((prev) =>
      prev.map((order) => (order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order))
    );
  };

  const createOrder = async () => {
    if (!createForm.outletId || !createForm.subtotal || !createForm.total) {
      enqueueSnackbar('Outlet, subtotal and total are required', { variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const created = await posService.createOrder({
        outletId: createForm.outletId,
        orderType: createForm.orderType,
        tableNumber: createForm.tableNumber || undefined,
        ...(createForm.orderType === 'ROOM_SERVICE' && createForm.bookingId
          ? { bookingId: createForm.bookingId }
          : {}),
        subtotal: Number(createForm.subtotal),
        tax: Number(createForm.tax || 0),
        total: Number(createForm.total),
        items: [
          {
            name: 'Manual Order Item',
            quantity: 1,
            price: Number(createForm.total)
          }
        ]
      });

      setOrders((prev) => [created, ...prev]);
      setOpenCreateDialog(false);
      setCreateForm({
        outletId: '',
        orderType: 'DINE_IN',
        tableNumber: '',
        bookingId: '',
        subtotal: '',
        tax: '',
        total: ''
      });
      enqueueSnackbar('Order created', { variant: 'success' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create order';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendToKds = async (orderId: string) => {
    setSaving(true);
    try {
      const updated = await posService.sendToKds(orderId);
      updateOrderLocally(updated);
      enqueueSnackbar('Order sent to KDS', { variant: 'success' });
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send to KDS';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    setSaving(true);
    try {
      const updated = await posService.completeOrder(orderId);
      updateOrderLocally(updated);
      enqueueSnackbar('Order completed', { variant: 'success' });
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to complete order';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleVoidOrder = async (orderId: string) => {
    setSaving(true);
    try {
      const updated = await posService.voidOrder(orderId, 'Manual void from dashboard');
      updateOrderLocally(updated);
      enqueueSnackbar('Order voided', { variant: 'warning' });
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to void order';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSaving(true);
    try {
      await posService.bulkSyncOrders([]);
      await loadData();
      enqueueSnackbar('Sync request completed', { variant: 'success' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4, overflowX: 'hidden' }}>
        <Box
          sx={{
            mb: 4,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', md: 'center' },
            gap: 2
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              POS Command
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Wired to v3 POS endpoints with KDS and offline sync status.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="outlined" onClick={() => void loadData()} disabled={loading || saving}>
              Refresh
            </Button>
            <Button variant="outlined" onClick={() => void handleSync()} disabled={loading || saving}>
              Sync Queue
            </Button>
            <Button variant="contained" onClick={() => setOpenCreateDialog(true)} disabled={saving}>
              New Order
            </Button>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {(loading || saving) && (
          <LogoLoader inline minHeight={160} label={saving ? 'Saving order' : 'Loading POS'} />
        )}

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent><Typography color="textSecondary">Outlets</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{outlets.length}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent><Typography color="textSecondary">Open Orders</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{totals.open}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent><Typography color="textSecondary">Sent To Kitchen</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{totals.sent}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent><Typography color="textSecondary">Completed Sales</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>₦{totals.sales.toLocaleString()}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary">Pending Sync</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{pendingSyncCount}</Typography>
                <Typography variant="caption" color="text.secondary">
                  KDS waiting: {kdsOrders.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Paper>
          <Box sx={{ p: 2, borderBottom: '1px solid #e5e8ee' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Orders
            </Typography>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f7fa' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Order</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Outlet</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Table</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} hover>
                    <TableCell>{order.orderNumber}</TableCell>
                    <TableCell>{order.outlet?.name || order.outletId}</TableCell>
                    <TableCell>{order.orderType}</TableCell>
                    <TableCell>{order.tableNumber || '-'}</TableCell>
                    <TableCell>₦{Number(order.total || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip label={order.orderStatus} size="small" color={orderStatusColor(order.orderStatus)} />
                    </TableCell>
                    <TableCell>{format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm')}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {order.orderStatus === 'OPEN' && (
                          <Button size="small" onClick={() => void handleSendToKds(order.id)}>
                            Send KDS
                          </Button>
                        )}
                        {order.orderStatus === 'SENT_TO_KITCHEN' && (
                          <Button size="small" onClick={() => void handleCompleteOrder(order.id)}>
                            Complete
                          </Button>
                        )}
                        {order.orderStatus !== 'VOIDED' && order.orderStatus !== 'COMPLETED' && (
                          <Button size="small" color="error" onClick={() => void handleVoidOrder(order.id)}>
                            Void
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography variant="body2" color="text.secondary">
                        No POS orders found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      </Container>

      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create POS Order</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              select
              label="Outlet"
              value={createForm.outletId}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, outletId: event.target.value }))}
              fullWidth
            >
              {outlets.map((outlet) => (
                <MenuItem key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Order Type"
              value={createForm.orderType}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, orderType: event.target.value as PosOrder['orderType'] }))
              }
              fullWidth
            >
              <MenuItem value="DINE_IN">Dine-In</MenuItem>
              <MenuItem value="TAKEAWAY">Takeaway</MenuItem>
              <MenuItem value="DELIVERY">Delivery</MenuItem>
              <MenuItem value="ROOM_SERVICE">Room Service</MenuItem>
              <MenuItem value="NO_CHARGE">No Charge</MenuItem>
            </TextField>
            <TextField
              label="Table Number"
              value={createForm.tableNumber}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, tableNumber: event.target.value }))}
              fullWidth
            />
            {createForm.orderType === 'ROOM_SERVICE' && (
              <TextField
                label="Reservation ID"
                value={createForm.bookingId}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, bookingId: event.target.value }))}
                helperText="Required for posting room-service charges to the guest folio."
                fullWidth
              />
            )}
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <TextField
                  label="Subtotal"
                  value={createForm.subtotal}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, subtotal: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="Tax"
                  value={createForm.tax}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, tax: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="Total"
                  value={createForm.total}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, total: event.target.value }))}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void createOrder()} disabled={saving}>
            {saving ? <CircularProgress size={20} color="inherit" /> : 'Create Order'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default PosPage;
