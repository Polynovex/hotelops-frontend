import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import Layout from '../../../components/Layout';
import { formatNaira } from '../../../services/hr.service';
import financeService, {
  PAYMENT_METHODS,
  type Transaction
} from '../../../services/finance.service';

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

const today = () => new Date().toISOString().slice(0, 10);

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;

/**
 * Payment history across reservations and POS in one view. An accountant
 * reconciling a day needs both together — a card payment is a card payment
 * whether it settled a room bill or a bar tab.
 */
const TransactionHistoryPage = () => {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [totalsByMethod, setTotalsByMethod] = useState<Array<{ paymentMethod: string; total: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [source, setSource] = useState<'RESERVATION' | 'POS' | ''>('');
  const [method, setMethod] = useState('');
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(today());
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await financeService.listTransactions({
        q: debouncedSearch || undefined,
        source,
        paymentMethod: method || undefined,
        from,
        to,
        limit: rowsPerPage,
        offset: page * rowsPerPage
      });
      setRows(result.data);
      setTotal(result.total);
      setTotalsByMethod(result.totalsByMethod);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load transaction history'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, source, method, from, to, page, rowsPerPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const describe = (row: Transaction) => {
    if (row.booking) {
      const guest = row.booking.guest;
      const name = guest ? `${guest.firstName} ${guest.lastName}` : 'Guest';
      const room = row.booking.room ? ` · Room ${row.booking.room.roomNumber}` : '';
      return `${name}${room}`;
    }
    if (row.posOrder) {
      return `${row.posOrder.outlet?.name ?? 'POS'} · Order ${row.posOrder.orderNumber}`;
    }
    return '—';
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>Transaction History</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Every payment and refund taken, across reservations and POS. Search by
          reference, booking number, or guest name.
        </Typography>

        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {totalsByMethod.length > 0 && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {totalsByMethod.map((entry) => (
              <Grid item xs={6} sm={4} md={2.4} key={entry.paymentMethod}>
                <Card>
                  <CardContent sx={{ py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {entry.paymentMethod.replace('_', ' ')}
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {formatNaira(entry.total)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                placeholder="Reference, booking number, or guest"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                fullWidth
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                select
                label="Source"
                value={source}
                onChange={(e) => { setSource(e.target.value as 'RESERVATION' | 'POS' | ''); setPage(0); }}
                fullWidth
                size="small"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="RESERVATION">Reservations</MenuItem>
                <MenuItem value="POS">POS</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                select
                label="Method"
                value={method}
                onChange={(e) => { setMethod(e.target.value); setPage(0); }}
                fullWidth
                size="small"
              >
                <MenuItem value="">All</MenuItem>
                {PAYMENT_METHODS.map((entry) => (
                  <MenuItem key={entry} value={entry}>{entry.replace('_', ' ')}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                label="From"
                type="date"
                value={from}
                onChange={(e) => { setFrom(e.target.value); setPage(0); }}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                label="To"
                type="date"
                value={to}
                onChange={(e) => { setTo(e.target.value); setPage(0); }}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </Paper>

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Reference</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Details</TableCell>
                <TableCell>Method</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              )}

              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No transactions match these filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {!loading && rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">{row.reference}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={row.source === 'RESERVATION' ? 'Reservation' : row.source === 'POS' ? 'POS' : 'Other'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{describe(row)}</Typography>
                    {row.booking?.bookingNumber && (
                      <Typography variant="caption" color="text.secondary">
                        {row.booking.bookingNumber}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{row.paymentMethod.replace('_', ' ')}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                      {row.isRefund && <Chip size="small" color="warning" label="Refund" />}
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color={row.isRefund ? 'error.main' : 'text.primary'}
                      >
                        {formatNaira(row.amount)}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.status}
                      color={
                        row.status === 'COMPLETED' ? 'success'
                          : row.status === 'PENDING' ? 'warning'
                          : row.status === 'REFUNDED' ? 'info'
                          : 'default'
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_e, next) => setPage(next)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
            rowsPerPageOptions={[25, 50, 100]}
          />
        </TableContainer>
      </Container>
    </Layout>
  );
};

export default TransactionHistoryPage;
