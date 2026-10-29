import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Container, Grid, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import { useSnackbar } from 'notistack';
import Layout from '../../../components/Layout';
import { api } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { formatCurrency } from '../../../utils/formatters';
import { getApiErrorMessage } from '../../../utils/apiError';

type Summary = {
  addOn: { code: string; name: string; description: string | null };
  outlet: { id: string; name: string; isActive: boolean } | null;
  services: Array<{ id: string; name: string; price: number; isAvailable: boolean; sku: string }>;
  takings: { today: number; month: number };
  recent: Array<{ id: string; orderNumber: string; total: number; paymentStatus: string; orderStatus: string; createdAt: string }>;
};

/**
 * One outlet add-on (pool, spa, laundry, or one HotelOpX created): what it
 * sells and what it has taken. Its services are priced here; they are sold
 * from the POS (its own tab there), paid on the spot or billed to a room, and
 * the takings reach Finance under the add-on's own line.
 */
const AddOnOutletPage = () => {
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const isOwner = useAuthStore((state) => state.user?.role) === 'BUSINESS_ADMIN';
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', price: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: summary } = await api.get(`/add-ons/${code}`);
      setData(summary);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load this add-on'));
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  const addService = async () => {
    if (!data?.outlet) return;
    setBusy(true);
    try {
      await api.post(`/outlets/${data.outlet.id}/menu-items`, {
        sku: `${data.addOn.code.slice(0, 4)}-${Date.now().toString(36).slice(-5).toUpperCase()}`,
        name: form.name.trim(),
        price: Number(form.price),
        taxRate: 0,
        category: data.addOn.name
      });
      setForm({ name: '', price: '' });
      enqueueSnackbar('Service added', { variant: 'success' });
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not add the service'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
        {data && (
          <Stack spacing={2.5}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography variant="h4" fontWeight={700}>{data.addOn.name}</Typography>
                <Typography variant="body2" color="text.secondary">{data.addOn.description}</Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignSelf: { md: 'center' } }}>
                <Button variant="outlined" onClick={() => navigate('/business/pos/menu')}>Menu configuration</Button>
                <Button variant="contained" onClick={() => navigate('/business/pos/sales')}>Sales</Button>
              </Stack>
            </Stack>

            <Grid container spacing={1.5}>
              <Grid item xs={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">Taken today</Typography>
                  <Typography variant="h5" fontWeight={800}>{formatCurrency(data.takings.today)}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">This month</Typography>
                  <Typography variant="h5" fontWeight={800}>{formatCurrency(data.takings.month)}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Alert severity="info" sx={{ height: '100%' }}>
                  Sell {data.addOn.name.toLowerCase()} services from the POS ({data.outlet?.name ?? data.addOn.name} tab): paid on the spot or sent to a guest&apos;s room. Takings show in Finance as {data.addOn.name}.
                </Alert>
              </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
              <Box sx={{ p: 2 }}>
                <Typography fontWeight={800}>Services and prices</Typography>
                {isOwner && (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
                    <TextField size="small" label="Service" placeholder="Day pass, Full body massage…" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} sx={{ minWidth: 240 }} />
                    <TextField size="small" label="Price (₦)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} sx={{ width: 160 }} />
                    <Button startIcon={<AddRounded />} variant="contained" onClick={() => void addService()} disabled={busy || !form.name.trim() || !(Number(form.price) >= 0) || form.price === ''}>
                      Add service
                    </Button>
                  </Stack>
                )}
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow><TableCell>Service</TableCell><TableCell align="right">Price</TableCell><TableCell>Status</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {data.services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>{service.name}</TableCell>
                      <TableCell align="right">{formatCurrency(service.price)}</TableCell>
                      <TableCell><Chip size="small" label={service.isAvailable ? 'Available' : 'Unavailable'} color={service.isAvailable ? 'success' : 'default'} /></TableCell>
                    </TableRow>
                  ))}
                  {!data.services.length && (
                    <TableRow><TableCell colSpan={3}><Typography color="text.secondary" sx={{ py: 2 }}>No services yet. Add the first one above.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>

            <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
              <Typography fontWeight={800} sx={{ p: 2, pb: 1 }}>Latest sales</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow><TableCell>Order</TableCell><TableCell>When</TableCell><TableCell align="right">Total</TableCell><TableCell>Payment</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {data.recent.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.orderNumber}</TableCell>
                      <TableCell>{new Date(order.createdAt).toLocaleString()}</TableCell>
                      <TableCell align="right">{formatCurrency(order.total)}</TableCell>
                      <TableCell><Chip size="small" label={order.paymentStatus} /></TableCell>
                    </TableRow>
                  ))}
                  {!data.recent.length && (
                    <TableRow><TableCell colSpan={4}><Typography color="text.secondary" sx={{ py: 2 }}>No sales yet.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          </Stack>
        )}
      </Container>
    </Layout>
  );
};

export default AddOnOutletPage;
