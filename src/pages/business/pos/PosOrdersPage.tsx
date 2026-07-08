import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  TextField,
  Typography
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { LocalOfferRounded } from '@mui/icons-material';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import DataTable from '../../../components/common/DataTable';
import { Outlet, PosOrder, posService } from '../../../services/api';
import DiscountModal, { DiscountModalItem } from '../../../components/modals/DiscountModal';
import { CreatePosOrderSchema, createPosOrderSchema } from '../../../validation/pos.schema';
import { useAuthStore } from '../../../store/authStore';

const statusColor = (status: PosOrder['orderStatus']) => {
  if (status === 'COMPLETED') return 'success';
  if (status === 'SENT_TO_KITCHEN') return 'info';
  if (status === 'VOIDED') return 'error';
  return 'warning';
};

const PosOrdersPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const token = useAuthStore((s) => s.token);
  const baseUrl = (import.meta as any).env?.VITE_API_URL ?? '';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openCreate, setOpenCreate] = useState(false);

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [tables, setTables] = useState<Array<{ id: string; tableNumber: string; outletId: string }>>([]);
  const [serviceCharge, setServiceCharge] = useState<{ rate: number; label: string; isEnabled: boolean } | null>(null);
  const [discountOrder, setDiscountOrder] = useState<PosOrder | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [pendingClientIds, setPendingClientIds] = useState<string[]>([]);

  const [filters, setFilters] = useState({ outletId: '', orderStatus: '' });
  const {
    setValue,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm<CreatePosOrderSchema>({
    resolver: zodResolver(createPosOrderSchema),
    defaultValues: {
      outletId: '',
      orderType: 'DINE_IN',
      tableNumber: '',
      bookingId: '',
      subtotal: 0,
      tax: 0,
      total: 0
    }
  });
  const form = watch();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [outletData, orderData, pending] = await Promise.all([
        posService.getOutlets(),
        posService.getOrders({
          ...(filters.outletId ? { outletId: filters.outletId } : {}),
          ...(filters.orderStatus ? { orderStatus: filters.orderStatus } : {})
        }),
        posService.getPendingSync()
      ]);

      setOutlets(outletData);
      setOrders(orderData);
      setPendingSyncCount(Number(pending.pendingCount || 0));

      const ids = (pending.items || [])
        .map((item) => String((item as Record<string, unknown>).clientId || ''))
        .filter(Boolean);
      setPendingClientIds(ids);

      if (!form.outletId && outletData[0]) {
        setValue('outletId', outletData[0].id);
      }

      // Fetch tables and service charge config
      try {
        const [tablesRes, scRes] = await Promise.all([
          fetch(`${baseUrl}/api/pos/tables`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${baseUrl}/api/pos/service-charge`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        if (tablesRes.ok) setTables(await tablesRes.json());
        if (scRes.ok) setServiceCharge(await scRes.json());
      } catch {
        // non-critical
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load POS orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.outletId, filters.orderStatus]);

  const stats = useMemo(() => {
    const open = orders.filter((order) => order.orderStatus === 'OPEN').length;
    const sent = orders.filter((order) => order.orderStatus === 'SENT_TO_KITCHEN').length;
    const completed = orders.filter((order) => order.orderStatus === 'COMPLETED');
    const revenue = completed.reduce((sum, order) => sum + Number(order.total || 0), 0);
    return { open, sent, completed: completed.length, revenue };
  }, [orders]);

  const createOrder = async (data: CreatePosOrderSchema) => {
    setSaving(true);
    try {
      await posService.createOrder({
        outletId: data.outletId,
        orderType: data.orderType,
        tableNumber: data.tableNumber || undefined,
        ...(data.orderType === 'ROOM_SERVICE' && data.bookingId
          ? { bookingId: data.bookingId }
          : {}),
        subtotal: data.subtotal,
        tax: data.tax,
        total: data.total,
        clientId: `web-${Date.now()}`,
        items: [
          {
            name: 'Manual POS Item',
            quantity: 1,
            price: data.total
          }
        ]
      });

      setOpenCreate(false);
      reset({
        ...data,
        tableNumber: '',
        bookingId: '',
        subtotal: 0,
        tax: 0,
        total: 0
      });
      enqueueSnackbar('Order created', { variant: 'success' });
      await load();
    } catch (err: unknown) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Failed to create order', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const sendToKds = async (orderId: string) => {
    setSaving(true);
    try {
      await posService.sendToKds(orderId);
      enqueueSnackbar('Order sent to kitchen', { variant: 'success' });
      await load();
    } catch (err: unknown) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Failed to send order', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const completeOrder = async (orderId: string) => {
    setSaving(true);
    try {
      await posService.completeOrder(orderId);
      enqueueSnackbar('Order marked complete', { variant: 'success' });
      await load();
    } catch (err: unknown) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Failed to complete order', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const voidOrder = async (orderId: string) => {
    setSaving(true);
    try {
      await posService.voidOrder(orderId, 'Voided from POS orders page');
      enqueueSnackbar('Order voided', { variant: 'warning' });
      await load();
    } catch (err: unknown) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Failed to void order', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const runSync = async () => {
    setSaving(true);
    try {
      await posService.bulkSyncOrders([]);
      if (pendingClientIds.length > 0) {
        await posService.acknowledgeSync(pendingClientIds);
      }
      enqueueSnackbar('Sync completed', { variant: 'success' });
      await load();
    } catch (err: unknown) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Sync failed', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4, overflowX: 'hidden' }}>
        <Box
          sx={{
            mb: 3,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', md: 'center' },
            gap: 2
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              POS Orders
            </Typography>
            <Typography variant="body2" color="text.secondary">
              v3 order lifecycle: create, send to KDS, complete, void, and sync acknowledgement.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="outlined" onClick={() => void load()} disabled={loading || saving}>
              Refresh
            </Button>
            <Button variant="outlined" onClick={() => void runSync()} disabled={loading || saving}>
              Run Sync
            </Button>
            <Button variant="contained" onClick={() => setOpenCreate(true)} disabled={saving}>
              New Order
            </Button>
          </Stack>
        </Box>

        {loading && <LogoLoader inline minHeight={160} label="Loading orders" />}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={3}>
            <Card><CardContent><Typography color="textSecondary">Open</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{stats.open}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card><CardContent><Typography color="textSecondary">Sent to Kitchen</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{stats.sent}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card><CardContent><Typography color="textSecondary">Completed</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{stats.completed}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card><CardContent><Typography color="textSecondary">Revenue</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>₦{stats.revenue.toLocaleString()}</Typography></CardContent></Card>
          </Grid>
        </Grid>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
            <TextField
              select
              label="Outlet"
              value={filters.outletId}
              onChange={(event) => setFilters((prev) => ({ ...prev, outletId: event.target.value }))}
              sx={{ minWidth: { sm: 220 } }}
              fullWidth
            >
              <MenuItem value="">All Outlets</MenuItem>
              {outlets.map((outlet) => (
                <MenuItem key={outlet.id} value={outlet.id}>{outlet.name}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Status"
              value={filters.orderStatus}
              onChange={(event) => setFilters((prev) => ({ ...prev, orderStatus: event.target.value }))}
              sx={{ minWidth: { sm: 200 } }}
              fullWidth
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="OPEN">OPEN</MenuItem>
              <MenuItem value="SENT_TO_KITCHEN">SENT_TO_KITCHEN</MenuItem>
              <MenuItem value="COMPLETED">COMPLETED</MenuItem>
              <MenuItem value="VOIDED">VOIDED</MenuItem>
            </TextField>

            <Chip color={pendingSyncCount > 0 ? 'warning' : 'success'} label={`Pending Sync: ${pendingSyncCount}`} />
          </Stack>
        </Paper>

        <DataTable
          rows={orders}
          rowKey={(order) => order.id}
          defaultRowsPerPage={10}
          emptyText={loading ? 'Loading orders...' : 'No orders found for the current filter.'}
          columns={[
            { key: 'orderNumber', label: 'Order', minWidth: 140 },
            {
              key: 'outlet',
              label: 'Outlet',
              minWidth: 160,
              render: (order) => order.outlet?.name || order.outletId
            },
            { key: 'orderType', label: 'Type', minWidth: 130 },
            {
              key: 'tableNumber',
              label: 'Table',
              minWidth: 100,
              render: (order) => order.tableNumber || '—'
            },
            {
              key: 'total',
              label: 'Total',
              minWidth: 140,
              render: (order) => `₦${Number(order.total || 0).toLocaleString()}`
            },
            {
              key: 'orderStatus',
              label: 'Status',
              minWidth: 170,
              render: (order) => (
                <Chip size="small" label={order.orderStatus} color={statusColor(order.orderStatus)} />
              )
            },
            {
              key: 'createdAt',
              label: 'Created',
              minWidth: 180,
              render: (order) => new Date(order.createdAt).toLocaleString()
            },
            {
              key: 'actions',
              label: 'Actions',
              minWidth: 250,
              render: (order) => (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {order.orderStatus !== 'VOIDED' && order.orderStatus !== 'COMPLETED' && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      startIcon={<LocalOfferRounded fontSize="small" />}
                      onClick={() => setDiscountOrder(order)}
                    >
                      Discount
                    </Button>
                  )}
                  {order.orderStatus === 'OPEN' && (
                    <Button size="small" onClick={() => void sendToKds(order.id)}>Send KDS</Button>
                  )}
                  {order.orderStatus === 'SENT_TO_KITCHEN' && (
                    <Button size="small" onClick={() => void completeOrder(order.id)}>Complete</Button>
                  )}
                  {order.orderStatus !== 'VOIDED' && order.orderStatus !== 'COMPLETED' && (
                    <Button size="small" color="error" onClick={() => void voidOrder(order.id)}>Void</Button>
                  )}
                </Stack>
              )
            }
          ]}
        />

        <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Create POS Order</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Box component="form" id="create-pos-order-form" onSubmit={handleSubmit(createOrder)}>
            <Stack spacing={2}>
              <TextField
                select
                label="Outlet"
                value={form.outletId || ''}
                error={Boolean(errors.outletId)}
                helperText={errors.outletId?.message}
                onChange={(event) => setValue('outletId', event.target.value)}
              >
                {outlets.map((outlet) => (
                  <MenuItem key={outlet.id} value={outlet.id}>{outlet.name}</MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Order Type"
                value={form.orderType}
                onChange={(event) => setValue('orderType', event.target.value as CreatePosOrderSchema['orderType'])}
              >
                <MenuItem value="DINE_IN">DINE_IN</MenuItem>
                <MenuItem value="TAKEAWAY">TAKEAWAY</MenuItem>
                <MenuItem value="DELIVERY">DELIVERY</MenuItem>
                <MenuItem value="ROOM_SERVICE">ROOM_SERVICE</MenuItem>
                <MenuItem value="NO_CHARGE">NO_CHARGE</MenuItem>
              </TextField>

              {tables.filter((t) => !form.outletId || t.outletId === form.outletId).length > 0 ? (
                <TextField
                  select
                  label="Table Number"
                  value={form.tableNumber || ''}
                  onChange={(e) => setValue('tableNumber', e.target.value)}
                  fullWidth
                >
                  <MenuItem value="">— No table —</MenuItem>
                  {tables
                    .filter((t) => !form.outletId || t.outletId === form.outletId)
                    .map((t) => (
                      <MenuItem key={t.id} value={t.tableNumber}>Table {t.tableNumber}</MenuItem>
                    ))}
                </TextField>
              ) : (
                <TextField
                  label="Table Number"
                  value={form.tableNumber || ''}
                  onChange={(e) => setValue('tableNumber', e.target.value)}
                  fullWidth
                />
              )}
              {form.orderType === 'ROOM_SERVICE' && (
                <TextField
                  label="Reservation ID"
                  value={form.bookingId || ''}
                  error={Boolean(errors.bookingId)}
                  helperText={errors.bookingId?.message || 'Required for guest folio posting'}
                  onChange={(event) => setValue('bookingId', event.target.value)}
                />
              )}

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField type="number" label="Subtotal" value={form.subtotal} error={Boolean(errors.subtotal)} helperText={errors.subtotal?.message} onChange={(event) => setValue('subtotal', Number(event.target.value || 0))} fullWidth />
                <TextField type="number" label="Tax" value={form.tax} error={Boolean(errors.tax)} helperText={errors.tax?.message} onChange={(event) => setValue('tax', Number(event.target.value || 0))} fullWidth />
                <TextField type="number" label="Total" value={form.total} error={Boolean(errors.total)} helperText={errors.total?.message} onChange={(event) => setValue('total', Number(event.target.value || 0))} fullWidth />
              </Stack>
              {serviceCharge?.isEnabled && (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  {serviceCharge.label}: {(serviceCharge.rate * 100).toFixed(0)}% will be auto-applied on subtotal.
                  Estimated: ₦{(form.subtotal * serviceCharge.rate).toLocaleString()}
                </Alert>
              )}
            </Stack>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button variant="contained" type="submit" form="create-pos-order-form" disabled={saving}>Create</Button>
          </DialogActions>
        </Dialog>

        {discountOrder && (
          <DiscountModal
            open={!!discountOrder}
            onClose={() => setDiscountOrder(null)}
            orderId={discountOrder.id}
            items={
              (Array.isArray((discountOrder as any).items)
                ? ((discountOrder as any).items as any[])
                : []
              ).map<DiscountModalItem>((it, idx) => ({
                id: it.id || it.menuItemId || it.sku || `item-${idx}`,
                name: it.name || it.title || 'Item',
                price: Number(it.price || 0),
                quantity: Number(it.quantity || 1),
                discountAmount: Number(it.discountAmount || 0)
              }))
            }
            onApplied={() => {
              enqueueSnackbar('Discount applied', { variant: 'success' });
              setDiscountOrder(null);
              void load();
            }}
          />
        )}
      </Container>
    </Layout>
  );
};

export default PosOrdersPage;
