import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Container,
  Grid,
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
import Layout from '../../../components/Layout';
import { api } from '../../../services/api';
import { getApiErrorMessage } from '../../../utils/apiError';

/** Every sale at every outlet: totals, per outlet, per day, payment methods and best sellers. */

type SalesSummary = {
  totals: { orders: number; gross: number; discount: number; net: number; averageOrder: number };
  outlets: Array<{ outletId: string; outlet: string; type: string; orders: number; gross: number; discount: number; net: number }>;
  daily: Array<Record<string, number | string> & { date: string; total: number }>;
  paymentMethods: Record<string, number>;
  topItems: Array<{ name: string; quantity: number; revenue: number }>;
};

const money = (value: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value || 0);
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

const SalesSummaryPage: React.FC = () => {
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 6 * 86_400_000)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [data, setData] = useState<SalesSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api
      .get<SalesSummary>('/pos/sales/summary', { params: { from, to } })
      .then(({ data: summary }) => setData(summary))
      .catch((err) => setError(getApiErrorMessage(err, 'Could not load sales')));
  }, [from, to]);

  const outletNames = useMemo(() => (data?.outlets ?? []).map((row) => row.outlet), [data]);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800}>Sales</Typography>
            <Typography variant="body2" color="text.secondary">Every sale at every outlet, after promotions.</Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
          </Stack>
        </Stack>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          {[
            ['Net sales', money(data?.totals.net ?? 0)],
            ['Orders', String(data?.totals.orders ?? 0)],
            ['Average order', money(data?.totals.averageOrder ?? 0)],
            ['Promotion discounts', money(data?.totals.discount ?? 0)]
          ].map(([label, value]) => (
            <Grid item xs={6} md={3} key={label}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="h5" fontWeight={800}>{value}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12} lg={7}>
            <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto', mb: 2 }}>
              <Typography fontWeight={800} sx={{ p: 2, pb: 0 }}>By outlet</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Outlet</TableCell>
                    <TableCell align="right">Orders</TableCell>
                    <TableCell align="right">Gross</TableCell>
                    <TableCell align="right">Discount</TableCell>
                    <TableCell align="right">Net</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data?.outlets ?? []).map((row) => (
                    <TableRow key={row.outletId}>
                      <TableCell>{row.outlet} <Typography component="span" variant="caption" color="text.secondary">{row.type}</Typography></TableCell>
                      <TableCell align="right">{row.orders}</TableCell>
                      <TableCell align="right">{money(row.gross)}</TableCell>
                      <TableCell align="right">{money(row.discount)}</TableCell>
                      <TableCell align="right"><strong>{money(row.net)}</strong></TableCell>
                    </TableRow>
                  ))}
                  {!data?.outlets.length && (
                    <TableRow><TableCell colSpan={5}><Typography variant="body2" color="text.secondary">No sales in this period.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>

            <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
              <Typography fontWeight={800} sx={{ p: 2, pb: 0 }}>Daily sales</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    {outletNames.map((name) => <TableCell key={name} align="right">{name}</TableCell>)}
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data?.daily ?? []).map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{row.date}</TableCell>
                      {outletNames.map((name) => <TableCell key={name} align="right">{money(Number(row[name] ?? 0))}</TableCell>)}
                      <TableCell align="right"><strong>{money(row.total)}</strong></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Grid>
          <Grid item xs={12} lg={5}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
              <Typography fontWeight={800} sx={{ mb: 1 }}>Payment methods</Typography>
              {Object.entries(data?.paymentMethods ?? {}).map(([method, amount]) => (
                <Stack key={method} direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
                  <Typography variant="body2">{method.replace(/_/g, ' ').toLowerCase()}</Typography>
                  <Typography variant="body2" fontWeight={700}>{money(amount)}</Typography>
                </Stack>
              ))}
            </Paper>
            <Paper variant="outlined" sx={{ borderRadius: 2 }}>
              <Typography fontWeight={800} sx={{ p: 2, pb: 0 }}>Best sellers</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Revenue</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data?.topItems ?? []).map((item) => (
                    <TableRow key={item.name}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">{money(item.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Layout>
  );
};

export default SalesSummaryPage;
