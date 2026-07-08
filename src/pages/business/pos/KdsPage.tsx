import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
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
import { Outlet, PosOrder, posService } from '../../../services/api';

const KdsPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [filters, setFilters] = useState({ outletId: '', includeCompleted: false });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [outletData, kdsOrders] = await Promise.all([
        posService.getOutlets(),
        posService.getKdsOrders({
          ...(filters.outletId ? { outletId: filters.outletId } : {}),
          includeCompleted: filters.includeCompleted
        })
      ]);
      setOutlets(outletData);
      setOrders(kdsOrders);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load KDS orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.outletId, filters.includeCompleted]);

  const pendingOrders = useMemo(
    () => orders.filter((order) => order.orderStatus === 'SENT_TO_KITCHEN').length,
    [orders]
  );

  const acknowledge = async (orderId: string) => {
    setSaving(true);
    try {
      await posService.acknowledgeKdsOrder(orderId);
      enqueueSnackbar('KDS order acknowledged', { variant: 'success' });
      await load();
    } catch (err: unknown) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Failed to acknowledge order', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const completeOrder = async (orderId: string) => {
    setSaving(true);
    try {
      await posService.completeOrder(orderId);
      enqueueSnackbar('KDS order completed', { variant: 'success' });
      await load();
    } catch (err: unknown) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Failed to complete order', { variant: 'error' });
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
              Kitchen Display System
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Live kitchen queue for sent orders with acknowledge and completion actions.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="outlined" onClick={() => void load()} disabled={loading || saving}>
              Refresh
            </Button>
          </Stack>
        </Box>

        {loading && <LogoLoader inline minHeight={160} label="Loading kitchen orders" />}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}>
            <Card><CardContent><Typography color="textSecondary">Queue Size</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{pendingOrders}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
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
                  label="Include Completed"
                  value={filters.includeCompleted ? 'yes' : 'no'}
                  onChange={(event) => setFilters((prev) => ({ ...prev, includeCompleted: event.target.value === 'yes' }))}
                  sx={{ minWidth: { sm: 200 } }}
                  fullWidth
                >
                  <MenuItem value="no">No</MenuItem>
                  <MenuItem value="yes">Yes</MenuItem>
                </TextField>
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          {orders.map((order) => (
            <Grid item xs={12} md={6} lg={4} key={order.id}>
              <Paper sx={{ p: 2, border: '1px solid #e6eaf0' }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontWeight: 700 }}>{order.orderNumber}</Typography>
                    <Chip
                      size="small"
                      label={order.orderStatus}
                      color={order.orderStatus === 'COMPLETED' ? 'success' : 'info'}
                    />
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    Outlet: {order.outlet?.name || order.outletId}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Table: {order.tableNumber || '—'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total: ₦{Number(order.total || 0).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Sent: {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : '—'}
                  </Typography>

                  <Stack direction="row" spacing={1}>
                    {order.orderStatus === 'SENT_TO_KITCHEN' && (
                      <Button size="small" onClick={() => void acknowledge(order.id)}>
                        Acknowledge
                      </Button>
                    )}
                    {order.orderStatus === 'SENT_TO_KITCHEN' && (
                      <Button size="small" variant="contained" onClick={() => void completeOrder(order.id)}>
                        Complete
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          ))}

          {!loading && orders.length === 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No KDS orders available for the selected filter.
                </Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      </Container>
    </Layout>
  );
};

export default KdsPage;
