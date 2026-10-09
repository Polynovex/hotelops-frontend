import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useSnackbar } from 'notistack';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { posService } from '../../../services/api';
import { posFlow, type KitchenStation, type PosOrderRow } from '../../../services/posFlow';
import { playChime } from '../../../utils/alertChime';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * Kitchen Display.
 *
 * The kitchen, bakery and bar track one thing: whether an order is ready. They
 * see what to make (items, notes, station, where it goes) and mark it ready
 * for the POS agent to collect. There is no total and no payment control here
 * — money is handled at the POS, against the central orders account.
 */

const minutesSince = (iso?: string | null) =>
  iso ? Math.max(Math.round((Date.now() - new Date(iso).getTime()) / 60_000), 0) : null;

const notifyKitchen = () => {
  playChime('order');
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate?.(200);
};

const KdsPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { on } = useWebSocket();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<PosOrderRow[]>([]);
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [station, setStation] = useState('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tagging, setTagging] = useState<KitchenStation | null>(null);
  const [remark, setRemark] = useState('');
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const [rows, stationRows] = await Promise.all([posFlow.kdsOrders(), posFlow.stations().catch(() => [])]);
      setOrders(rows);
      setStations(stationRows);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load kitchen orders'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => void load(), 30_000);
    // Re-render each minute so the "waiting" timers move.
    const clock = window.setInterval(() => setTick((value) => value + 1), 60_000);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(clock);
    };
  }, [load]);

  useEffect(() => {
    const unsubscribers = [
      on('pos.order.sent_to_kds', (payload: unknown) => {
        void load();
        const order = payload as { orderNumber?: string; tableNumber?: string } | undefined;
        enqueueSnackbar(`New ticket ${order?.orderNumber ?? ''}${order?.tableNumber ? ` · table ${order.tableNumber}` : ''}`, { variant: 'info' });
        notifyKitchen();
      }),
      on('pos.station.updated', () => void load()),
      on('pos.order.paid', () => void load())
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [on, load, enqueueSnackbar]);

  /** Lines for the selected station only; an order with none of them is hidden. */
  const linesFor = (order: PosOrderRow) =>
    (Array.isArray(order.items) ? order.items : []).filter((line) => station === 'ALL' || line.kitchenStation === station);

  const preparing = useMemo(
    () => orders.filter((order) => order.orderStatus === 'SENT_TO_KITCHEN' && linesFor(order).length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, station]
  );
  const ready = useMemo(
    () => orders.filter((order) => order.orderStatus === 'READY' && linesFor(order).length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, station]
  );

  const act = async (order: PosOrderRow, action: 'ack' | 'ready') => {
    setBusyId(order.id);
    try {
      if (action === 'ack') {
        await posService.acknowledgeKdsOrder(order.id);
        enqueueSnackbar(`${order.orderNumber} acknowledged`, { variant: 'success' });
      } else {
        await posFlow.markReady(order.id);
        enqueueSnackbar(`${order.orderNumber} is ready — the POS agent has been told`, { variant: 'success' });
      }
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'That did not work'), { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const saveTag = async (target: KitchenStation, status: KitchenStation['status']) => {
    try {
      await posFlow.setStationStatus(target.id, status, status === 'OUT_OF_ORDER' ? remark.trim() : undefined);
      enqueueSnackbar(status === 'OUT_OF_ORDER' ? `${target.name} marked out of order` : `${target.name} back in service`, { variant: 'success' });
      setTagging(null);
      setRemark('');
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not update the station'), { variant: 'error' });
    }
  };

  const ticket = (order: PosOrderRow) => {
    const waited = minutesSince(order.orderStatus === 'READY' ? order.readyAt : (order as { sentToKdsAt?: string }).sentToKdsAt ?? order.createdAt);
    const late = order.orderStatus === 'SENT_TO_KITCHEN' && (waited ?? 0) >= 20;
    return (
      <Paper key={order.id} variant="outlined" sx={{ p: 2, borderColor: late ? 'error.main' : 'divider', borderWidth: late ? 2 : 1 }}>
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography fontWeight={800}>{order.orderNumber}</Typography>
            <Chip size="small" color={late ? 'error' : 'default'} label={`${waited ?? 0} min`} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {order.outlet?.name}
            {order.tableNumber ? ` · Table ${order.tableNumber}` : ''}
            {order.metadata?.roomNumber ? ` · Room ${order.metadata.roomNumber}` : ''}
            {order.isQrOrder && order.customerName ? ` · ${order.customerName}` : ''}
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {linesFor(order).map((line, index) => (
              <li key={`${line.menuItemId}-${index}`}>
                <Typography variant="body1" fontWeight={700} component="span">{line.quantity}× {line.name}</Typography>
                {line.kitchenStation && station === 'ALL' && (
                  <Typography variant="caption" color="text.secondary" component="span"> · {line.kitchenStation}</Typography>
                )}
                {line.notes && <Typography variant="body2" color="warning.main">“{line.notes}”</Typography>}
              </li>
            ))}
          </Box>
          {order.metadata?.notes && <Alert severity="info" sx={{ py: 0 }}>{order.metadata.notes}</Alert>}
          {order.orderStatus === 'SENT_TO_KITCHEN' ? (
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => void act(order, 'ack')} disabled={busyId === order.id}>Acknowledge</Button>
              <Button size="small" variant="contained" color="success" onClick={() => void act(order, 'ready')} disabled={busyId === order.id}>
                Mark ready
              </Button>
            </Stack>
          ) : (
            <Chip color="success" label="Ready — waiting for pickup" />
          )}
        </Stack>
      </Paper>
    );
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4, overflowX: 'hidden' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Kitchen Display</Typography>
            <Typography variant="body2" color="text.secondary">Prepare tickets and mark them ready. Payment is taken at the POS.</Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField select size="small" label="Station" value={station} onChange={(event) => setStation(event.target.value)} sx={{ minWidth: 200 }}>
              <MenuItem value="ALL">All stations</MenuItem>
              {stations.map((entry) => (
                <MenuItem key={entry.id} value={entry.code}>{entry.name}</MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" onClick={() => void load()}>Refresh</Button>
          </Stack>
        </Stack>

        {/* Station remark tags: taking orders, or out of order with a reason. */}
        {stations.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            {stations.map((entry) => (
              <Chip
                key={entry.id}
                label={entry.status === 'OUT_OF_ORDER' ? `${entry.name}: out of order${entry.remark ? ` — ${entry.remark}` : ''}` : `${entry.name}: taking orders`}
                color={entry.status === 'OUT_OF_ORDER' ? 'error' : 'success'}
                variant={entry.status === 'OUT_OF_ORDER' ? 'filled' : 'outlined'}
                onClick={() => (entry.status === 'OUT_OF_ORDER' ? void saveTag(entry, 'ACTIVE') : setTagging(entry))}
              />
            ))}
          </Stack>
        )}

        {loading && <LogoLoader inline minHeight={160} label="Loading kitchen orders" />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>Preparing ({preparing.length})</Typography>
            <Stack spacing={1.5}>
              {preparing.map(ticket)}
              {!loading && preparing.length === 0 && <Typography color="text.secondary">No tickets in preparation.</Typography>}
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>Ready for pickup ({ready.length})</Typography>
            <Stack spacing={1.5}>
              {ready.map(ticket)}
              {!loading && ready.length === 0 && <Typography color="text.secondary">Nothing waiting at the pass.</Typography>}
            </Stack>
          </Grid>
        </Grid>

        <Dialog open={Boolean(tagging)} onClose={() => setTagging(null)} fullWidth maxWidth="xs">
          <DialogTitle>Mark {tagging?.name} out of order</DialogTitle>
          <DialogContent>
            <TextField autoFocus fullWidth label="Reason" placeholder="e.g. Fryer down, gas finished" value={remark} onChange={(event) => setRemark(event.target.value)} sx={{ mt: 1 }} />
            <Typography variant="caption" color="text.secondary">POS agents are warned before sending orders to this station.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTagging(null)}>Cancel</Button>
            <Button color="error" variant="contained" disabled={!remark.trim()} onClick={() => tagging && void saveTag(tagging, 'OUT_OF_ORDER')}>
              Mark out of order
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default KdsPage;
