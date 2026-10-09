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
import { posService } from '../../../services/api';
import { formatNaira, posFlow, type Outlet, type PosOrderRow } from '../../../services/posFlow';
import DiscountModal, { DiscountModalItem } from '../../../components/modals/DiscountModal';
import { NewOrderDialog } from '../../../components/pos/NewOrderDialog';
import { TakePaymentDialog } from '../../../components/pos/TakePaymentDialog';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * POS orders: the agent's workspace.
 *
 * Consumer -> POS agent -> POS. Orders come in from the agent (rung up from
 * the menu) or from guests by QR. The agent accepts and sends them to the
 * kitchen/bar; the kitchen marks them ready; the agent serves, takes payment
 * and closes them. The kitchen screen has no payment controls at all.
 */

const STATUS_LABEL: Record<PosOrderRow['orderStatus'], string> = {
  OPEN: 'Open',
  SENT_TO_KITCHEN: 'In kitchen',
  READY: 'Ready to serve',
  COMPLETED: 'Completed',
  VOIDED: 'Voided'
};
const STATUS_COLOR: Record<PosOrderRow['orderStatus'], 'warning' | 'info' | 'success' | 'default' | 'error' | 'secondary'> = {
  OPEN: 'warning',
  SENT_TO_KITCHEN: 'info',
  READY: 'secondary',
  COMPLETED: 'success',
  VOIDED: 'error'
};

/** Room service is charged to the folio and no-charge is free. */
const needsPayment = (order: PosOrderRow) => order.orderType !== 'ROOM_SERVICE' && order.orderType !== 'NO_CHARGE';

const where = (order: PosOrderRow) =>
  [order.tableNumber ? `Table ${order.tableNumber}` : '', order.metadata?.roomNumber ? `Room ${order.metadata.roomNumber}` : '']
    .filter(Boolean)
    .join(' · ') || '—';

const PosOrdersPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { on } = useWebSocket();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [orders, setOrders] = useState<PosOrderRow[]>([]);
  const [filters, setFilters] = useState({ outletId: '', orderStatus: '' });
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [pendingClientIds, setPendingClientIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<PosOrderRow | null>(null);
  const [discountOrder, setDiscountOrder] = useState<PosOrderRow | null>(null);
  const [stationBlock, setStationBlock] = useState<{ order: PosOrderRow; message: string } | null>(null);
  const [voiding, setVoiding] = useState<PosOrderRow | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [outletRows, orderRows, pending] = await Promise.all([
        posFlow.outlets(),
        posFlow.orders({
          ...(filters.outletId ? { outletId: filters.outletId } : {}),
          ...(filters.orderStatus ? { orderStatus: filters.orderStatus } : {})
        }),
        posService.getPendingSync().catch(() => ({ pendingCount: 0, items: [] }))
      ]);
      setOutlets(outletRows);
      setOrders(orderRows);
      setPendingSyncCount(Number(pending.pendingCount || 0));
      setPendingClientIds(
        (pending.items || []).map((item) => String((item as Record<string, unknown>).clientId || '')).filter(Boolean)
      );
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load POS orders'));
    } finally {
      setLoading(false);
    }
  }, [filters.outletId, filters.orderStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live: new QR orders, orders the kitchen marked ready, payments elsewhere.
  useEffect(() => {
    const unsubscribers = ['pos.qr_order.received', 'pos.order.ready', 'pos.order.paid', 'pos.order.sent_to_kds'].map((event) =>
      on(event, () => void load())
    );
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      window.clearInterval(timer);
    };
  }, [on, load]);

  const stats = useMemo(() => {
    const live = orders.filter((order) => order.orderStatus !== 'VOIDED');
    return {
      awaiting: live.filter((order) => order.isQrOrder && order.orderStatus === 'OPEN').length,
      inKitchen: live.filter((order) => order.orderStatus === 'SENT_TO_KITCHEN').length,
      ready: live.filter((order) => order.orderStatus === 'READY').length,
      unpaid: live
        .filter((order) => needsPayment(order) && order.paymentStatus !== 'COMPLETED')
        .reduce((sum, order) => sum + Number(order.total || 0), 0)
    };
  }, [orders]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setSaving(true);
    try {
      await action();
      enqueueSnackbar(success, { variant: 'success' });
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'That did not work'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const sendToKitchen = async (order: PosOrderRow, force = false) => {
    setSaving(true);
    try {
      await posFlow.sendToKitchen(order.id, force);
      enqueueSnackbar(`${order.orderNumber} sent to the kitchen`, { variant: 'success' });
      setStationBlock(null);
      await load();
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string; message?: string } } }).response?.data;
      if (data?.error === 'STATION_OUT_OF_ORDER') {
        setStationBlock({ order, message: data.message ?? 'A station is out of order' });
      } else {
        enqueueSnackbar(getApiErrorMessage(err, 'Could not send to the kitchen'), { variant: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const runSync = () =>
    run(async () => {
      await posService.bulkSyncOrders([]);
      if (pendingClientIds.length > 0) await posService.acknowledgeSync(pendingClientIds);
    }, 'Sync completed');

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4, overflowX: 'hidden' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>POS Orders</Typography>
            <Typography variant="body2" color="text.secondary">
              Accept orders, send them to the kitchen or bar, serve when ready, then take payment.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="outlined" onClick={() => void load()} disabled={saving}>Refresh</Button>
            <Button variant="outlined" onClick={() => void runSync()} disabled={saving}>Run Sync</Button>
            <Button variant="contained" onClick={() => setCreating(true)} disabled={saving}>New Order</Button>
          </Stack>
        </Stack>

        {loading && <LogoLoader inline minHeight={160} label="Loading orders" />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          {[
            ['QR orders to accept', stats.awaiting],
            ['In the kitchen', stats.inKitchen],
            ['Ready to serve', stats.ready],
            ['Awaiting payment', formatNaira(stats.unpaid)]
          ].map(([label, value]) => (
            <Grid item xs={6} md={3} key={String(label)}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">{label}</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{value}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <TextField select label="Outlet" value={filters.outletId} onChange={(event) => setFilters((prev) => ({ ...prev, outletId: event.target.value }))} sx={{ minWidth: { sm: 220 } }} fullWidth>
              <MenuItem value="">All outlets</MenuItem>
              {outlets.map((outlet) => (
                <MenuItem key={outlet.id} value={outlet.id}>{outlet.name}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Status" value={filters.orderStatus} onChange={(event) => setFilters((prev) => ({ ...prev, orderStatus: event.target.value }))} sx={{ minWidth: { sm: 200 } }} fullWidth>
              <MenuItem value="">All statuses</MenuItem>
              {(Object.keys(STATUS_LABEL) as Array<PosOrderRow['orderStatus']>).map((status) => (
                <MenuItem key={status} value={status}>{STATUS_LABEL[status]}</MenuItem>
              ))}
            </TextField>
            <Chip color={pendingSyncCount > 0 ? 'warning' : 'success'} label={`Pending sync: ${pendingSyncCount}`} />
          </Stack>
        </Paper>

        <DataTable
          rows={orders}
          rowKey={(order) => order.id}
          defaultRowsPerPage={10}
          emptyText={loading ? 'Loading orders...' : 'No orders found for the current filter.'}
          columns={[
            {
              key: 'orderNumber',
              label: 'Order',
              minWidth: 170,
              render: (order) => (
                <Stack spacing={0.25}>
                  <Typography variant="body2" fontWeight={700}>{order.orderNumber}</Typography>
                  {order.isQrOrder && (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Chip size="small" label="QR" color="primary" variant="outlined" />
                      <Typography variant="caption">{order.customerName}</Typography>
                    </Stack>
                  )}
                </Stack>
              )
            },
            { key: 'outlet', label: 'Outlet', minWidth: 130, render: (order) => order.outlet?.name || '—' },
            { key: 'where', label: 'Where', minWidth: 130, render: where },
            {
              key: 'items',
              label: 'Items',
              minWidth: 200,
              render: (order) =>
                (Array.isArray(order.items) ? order.items : []).map((line) => `${line.quantity}× ${line.name}`).join(', ') || '—'
            },
            { key: 'total', label: 'Total', minWidth: 110, render: (order) => formatNaira(order.total) },
            {
              key: 'orderStatus',
              label: 'Status',
              minWidth: 140,
              render: (order) => <Chip size="small" label={STATUS_LABEL[order.orderStatus]} color={STATUS_COLOR[order.orderStatus]} />
            },
            {
              key: 'payment',
              label: 'Payment',
              minWidth: 150,
              render: (order) =>
                !needsPayment(order) ? (
                  <Typography variant="caption">{order.orderType === 'ROOM_SERVICE' ? 'Charged to room' : 'No charge'}</Typography>
                ) : order.paymentStatus === 'COMPLETED' ? (
                  <Chip size="small" color="success" label={`Paid · ${(order.paymentMethod || '').toLowerCase()}`} />
                ) : (
                  <Typography variant="caption" color="warning.main">
                    Unpaid{order.metadata?.paymentPreference && order.metadata.paymentPreference !== 'ONLINE' ? ` · guest pays by ${order.metadata.paymentPreference.toLowerCase()}` : ''}
                  </Typography>
                )
            },
            { key: 'createdAt', label: 'Created', minWidth: 160, render: (order) => new Date(order.createdAt).toLocaleString() },
            {
              key: 'actions',
              label: 'Actions',
              minWidth: 300,
              render: (order) => {
                const live = order.orderStatus !== 'VOIDED' && order.orderStatus !== 'COMPLETED';
                const unpaid = needsPayment(order) && order.paymentStatus !== 'COMPLETED';
                return (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {order.orderStatus === 'OPEN' && (
                      <Button size="small" variant="contained" onClick={() => void sendToKitchen(order)} disabled={saving}>
                        {order.isQrOrder ? 'Accept & send to kitchen' : 'Send to kitchen'}
                      </Button>
                    )}
                    {live && unpaid && (
                      <Button size="small" variant="outlined" color="success" onClick={() => setPaying(order)}>
                        Take payment
                      </Button>
                    )}
                    {order.orderStatus === 'READY' && !unpaid && (
                      <Button size="small" variant="contained" color="success" onClick={() => void run(() => posFlow.complete(order.id), `${order.orderNumber} served and closed`)} disabled={saving}>
                        Serve & close
                      </Button>
                    )}
                    {live && (
                      <Button size="small" variant="outlined" color="secondary" startIcon={<LocalOfferRounded fontSize="small" />} onClick={() => setDiscountOrder(order)}>
                        Discount
                      </Button>
                    )}
                    {live && order.paymentStatus !== 'COMPLETED' && (
                      <Button size="small" color="error" onClick={() => { setVoiding(order); setVoidReason(''); }}>Void</Button>
                    )}
                  </Stack>
                );
              }
            }
          ]}
        />

        <NewOrderDialog
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={(orderNumber) => {
            setCreating(false);
            enqueueSnackbar(`Order ${orderNumber} created`, { variant: 'success' });
            void load();
          }}
        />

        <TakePaymentDialog
          order={paying}
          onClose={() => setPaying(null)}
          onPaid={(message) => {
            setPaying(null);
            enqueueSnackbar(message, { variant: 'success' });
            void load();
          }}
        />

        <Dialog open={Boolean(stationBlock)} onClose={() => setStationBlock(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Station out of order</DialogTitle>
          <DialogContent>
            <Typography variant="body2">{stationBlock?.message}</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>Change the order, or send it anyway if the kitchen will reroute it.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStationBlock(null)}>Back</Button>
            <Button color="warning" variant="contained" onClick={() => stationBlock && void sendToKitchen(stationBlock.order, true)}>Send anyway</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(voiding)} onClose={() => setVoiding(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Void {voiding?.orderNumber}?</DialogTitle>
          <DialogContent>
            <TextField autoFocus fullWidth label="Reason" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} sx={{ mt: 1 }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setVoiding(null)}>Cancel</Button>
            <Button
              color="error"
              variant="contained"
              disabled={!voidReason.trim() || saving}
              onClick={() => {
                const target = voiding;
                setVoiding(null);
                if (target) void run(() => posFlow.voidOrder(target.id, voidReason.trim()), `${target.orderNumber} voided`);
              }}
            >
              Void order
            </Button>
          </DialogActions>
        </Dialog>

        {discountOrder && (
          <DiscountModal
            open={Boolean(discountOrder)}
            onClose={() => setDiscountOrder(null)}
            orderId={discountOrder.id}
            items={(Array.isArray(discountOrder.items) ? discountOrder.items : []).map<DiscountModalItem>((line, index) => ({
              id: line.menuItemId || `item-${index}`,
              name: line.name || 'Item',
              price: Number(line.unitPrice || 0),
              quantity: Number(line.quantity || 1),
              discountAmount: 0
            }))}
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
