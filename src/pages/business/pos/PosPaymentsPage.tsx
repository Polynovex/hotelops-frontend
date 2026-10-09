import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Card, CardContent, Chip, Container, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/common/DataTable';
import LogoLoader from '../../../components/LogoLoader';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { formatNaira, posFlow, type Outlet, type PaymentLogRow } from '../../../services/posFlow';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * Payment log for POS staff, managers and the owner: every payment taken at
 * the till or online on a QR order, all posted to the central orders account.
 */
export default function PosPaymentsPage() {
  const { on } = useWebSocket();
  const today = new Date().toISOString().slice(0, 10);
  const [range, setRange] = useState({ from: today, to: today });
  const [outletId, setOutletId] = useState('');
  const [method, setMethod] = useState('');
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [rows, setRows] = useState<PaymentLogRow[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await posFlow.payments({
        from: `${range.from}T00:00:00.000Z`,
        to: `${range.to}T23:59:59.999Z`,
        ...(outletId ? { outletId } : {}),
        ...(method ? { method } : {})
      });
      setRows(data.payments);
      setTotals(data.totals);
      setGrandTotal(data.grandTotal);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load payments'));
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, outletId, method]);

  useEffect(() => {
    void load();
    posFlow.outlets().then(setOutlets).catch(() => undefined);
  }, [load]);

  useEffect(() => {
    const unsubscribe = on('pos.order.paid', () => void load());
    return unsubscribe;
  }, [on, load]);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" fontWeight={700}>POS payments</Typography>
          <Typography variant="body2" color="text.secondary">
            Every payment taken at the till or online, posted to the central orders account.
          </Typography>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField size="small" type="date" label="From" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label="To" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField select size="small" label="Outlet" value={outletId} onChange={(event) => setOutletId(event.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">All outlets</MenuItem>
            {outlets.map((outlet) => <MenuItem key={outlet.id} value={outlet.id}>{outlet.name}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Method" value={method} onChange={(event) => setMethod(event.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">All methods</MenuItem>
            {['CASH', 'CARD', 'TRANSFER', 'PAYSTACK', 'FLUTTERWAVE'].map((value) => <MenuItem key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</MenuItem>)}
          </TextField>
        </Stack>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent>
              <Typography variant="body2" color="text.secondary">Total received</Typography>
              <Typography variant="h5" fontWeight={800}>{formatNaira(grandTotal)}</Typography>
            </CardContent></Card>
          </Grid>
          {Object.entries(totals).map(([key, value]) => (
            <Grid item xs={6} sm={3} md={2} key={key}>
              <Card><CardContent>
                <Typography variant="body2" color="text.secondary">{key.charAt(0) + key.slice(1).toLowerCase()}</Typography>
                <Typography variant="h6" fontWeight={700}>{formatNaira(value)}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>

        {loading ? (
          <LogoLoader inline minHeight={160} />
        ) : (
          <DataTable
            rows={rows}
            rowKey={(row) => row.id}
            defaultRowsPerPage={20}
            emptyText="No payments in this period."
            columns={[
              { key: 'createdAt', label: 'Time', minWidth: 160, render: (row) => new Date(row.createdAt).toLocaleString() },
              { key: 'orderNumber', label: 'Order', minWidth: 150, render: (row) => (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <span>{row.orderNumber}</span>
                  {row.isQrOrder && <Chip size="small" label="QR" variant="outlined" />}
                </Stack>
              ) },
              { key: 'outlet', label: 'Outlet', minWidth: 130, render: (row) => row.outlet ?? '—' },
              { key: 'method', label: 'Method', minWidth: 110, render: (row) => row.method.charAt(0) + row.method.slice(1).toLowerCase() },
              { key: 'amount', label: 'Amount', minWidth: 120, render: (row) => formatNaira(row.amount) },
              { key: 'status', label: 'Status', minWidth: 110, render: (row) => <Chip size="small" label={row.status.toLowerCase()} color={row.status === 'COMPLETED' ? 'success' : 'warning'} /> },
              { key: 'recordedBy', label: 'Taken by', minWidth: 140, render: (row) => row.recordedBy ?? '—' },
              { key: 'reference', label: 'Reference', minWidth: 180 }
            ]}
          />
        )}
      </Container>
    </Layout>
  );
}
