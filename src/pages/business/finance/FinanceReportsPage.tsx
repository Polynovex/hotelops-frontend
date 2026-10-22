import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Container,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import { dailyRecords, naira, type Meta } from '../../../services/dailyRecords';
import { getApiErrorMessage } from '../../../utils/apiError';
import UsaliReports from '../../../components/finance/UsaliReports';

/**
 * Finance reports and management summaries, built only from approved daily
 * records: revenue by source, P&L, below-the-line movements, cash and bank,
 * room performance (occupancy, ARR, best-selling rooms and types).
 */

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface Bucket {
  period: string;
  days: number;
  revenueBySource: Record<string, number>;
  totalRevenue: number;
  cogs: number;
  grossProfit: number;
  expensesByCategory: Record<string, number>;
  operatingExpenses: number;
  netOperatingProfit: number;
  belowTheLine: Record<string, number>;
  rooms: {
    roomNightsAvailable: number;
    roomsSold: number;
    complimentary: number;
    outOfOrderNights: number;
    occupancyPercent: number;
    averageRoomRate: number;
    roomRevenue: number;
    topRoomTypes: Array<{ roomType: string; sold: number; revenue: number }>;
    topRooms: Array<{ roomNumber: string; nights: number }>;
  };
  closingPositions: Array<{ account: string; type: string; closing: number; variance: number }>;
  cashVariance: number;
  management?: { roomRevenue: number; foodRevenue: number; barRevenue: number; otherRevenue: number; cashAvailable: number; bankBalance: number };
  budgetVsActual?: Array<{ category: string; budget: number; actual: number; difference: number }>;
}

const BELOW: Record<string, string> = {
  loanTaken: 'Loans taken',
  loanRepaid: 'Loan repayments',
  ownerWithdrawal: 'Owner withdrawals',
  capitalExpenditure: 'Capital expenditure',
  taxes: 'Taxes',
  otherNonOperating: 'Other non-operating payments'
};

export default function FinanceReportsPage() {
  // Management reports (HotelOpX terms), the USALI-aligned statement, and the
  // mapping between them — all from the same approved records.
  const [mode, setMode] = useState<'management' | 'usali' | 'mapping'>('management');
  const [period, setPeriod] = useState<Period>('monthly');
  const [range, setRange] = useState({ from: '', to: new Date().toISOString().slice(0, 10) });
  const [meta, setMeta] = useState<Meta | null>(null);
  const [data, setData] = useState<{ periods: Bucket[]; overall: Bucket | null; approvedDays: number; pendingDays: number; visibleFrom: string; outstandingSupplierDebt?: number; outstandingLoans?: number } | null>(null);
  const [focus, setFocus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await dailyRecords.summary(period, range.from || undefined, range.to || undefined);
      setData(result);
      setFocus(result.periods[result.periods.length - 1]?.period ?? '');
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the reports'));
    } finally {
      setLoading(false);
    }
  }, [period, range.from, range.to]);

  useEffect(() => {
    void load();
    dailyRecords.meta().then(setMeta).catch(() => undefined);
  }, [load]);

  const labelOf = (key: string, list?: Array<{ key: string; label: string }>) => list?.find((entry) => entry.key === key)?.label ?? key;
  const bucket = data?.periods.find((entry) => entry.period === focus) ?? data?.overall ?? null;

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Finance reports</Typography>
            <Typography variant="body2" color="text.secondary">From approved daily records only. Pending submissions and edits are not counted.</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ display: mode === 'management' ? 'flex' : 'none' }}>
            <ToggleButtonGroup exclusive size="small" value={period} onChange={(_event, value) => value && setPeriod(value)}>
              {(['daily', 'weekly', 'monthly', 'yearly'] as Period[]).map((value) => (
                <ToggleButton key={value} value={value} sx={{ textTransform: 'capitalize' }}>{value}</ToggleButton>
              ))}
            </ToggleButtonGroup>
            <TextField size="small" type="date" label="From" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField size="small" type="date" label="To" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} InputLabelProps={{ shrink: true }} />
          </Stack>
        </Stack>

        <Tabs value={mode} onChange={(_event, value) => setMode(value)} sx={{ mb: 2 }} variant="scrollable" allowScrollButtonsMobile>
          <Tab value="management" label="Management reports" />
          <Tab value="usali" label="USALI statement" />
          <Tab value="mapping" label="USALI mapping" />
        </Tabs>

        {mode !== 'management' ? (
          <UsaliReports view={mode} onViewChange={setMode} />
        ) : (
        <>
        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {data && data.pendingDays > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>{data.pendingDays} day(s) in this range are awaiting approval and are shown at their last approved figures.</Alert>
        )}
        {data && data.approvedDays === 0 && !loading && (
          <Alert severity="info" sx={{ mb: 2 }}>No approved records in this range yet (visible from {data.visibleFrom}).</Alert>
        )}

        {data && data.periods.length > 0 && (
          <>
            {/* Management summary: one row per period. */}
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>Management summary</Typography>
            {/* Daily sales record: one row per period, one column per revenue source. */}
            {period === 'daily' && (
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Typography fontWeight={800} sx={{ p: 2, pb: 0 }}>Daily sales record</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      {(meta?.revenueSources ?? []).map((source) => <TableCell key={source.key} align="right">{source.label}</TableCell>)}
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.periods.map((row) => (
                      <TableRow key={row.period}>
                        <TableCell>{row.period}</TableCell>
                        {(meta?.revenueSources ?? []).map((source) => <TableCell key={source.key} align="right">{naira(row.revenueBySource[source.key] ?? 0)}</TableCell>)}
                        <TableCell align="right"><strong>{naira(row.totalRevenue)}</strong></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Period</TableCell>
                    <TableCell align="right">Revenue</TableCell>
                    <TableCell align="right">Gross profit</TableCell>
                    <TableCell align="right">Expenses</TableCell>
                    <TableCell align="right">Net operating</TableCell>
                    <TableCell align="right">Occupancy</TableCell>
                    <TableCell align="right">ARR</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.periods.map((row) => (
                    <TableRow key={row.period} hover selected={row.period === focus} onClick={() => setFocus(row.period)} sx={{ cursor: 'pointer' }}>
                      <TableCell>{row.period} <Typography component="span" variant="caption" color="text.secondary">({row.days}d)</Typography></TableCell>
                      <TableCell align="right">{naira(row.totalRevenue)}</TableCell>
                      <TableCell align="right">{naira(row.grossProfit)}</TableCell>
                      <TableCell align="right">{naira(row.operatingExpenses)}</TableCell>
                      <TableCell align="right" sx={{ color: row.netOperatingProfit < 0 ? 'error.main' : 'success.main', fontWeight: 700 }}>{naira(row.netOperatingProfit)}</TableCell>
                      <TableCell align="right">{row.rooms.occupancyPercent}%</TableCell>
                      <TableCell align="right">{naira(row.rooms.averageRoomRate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {bucket && (
              <>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                  <Typography variant="h6" fontWeight={800}>Detail</Typography>
                  <TextField select size="small" value={focus} onChange={(event) => setFocus(event.target.value)} sx={{ minWidth: 220 }}>
                    {data.periods.map((row) => <MenuItem key={row.period} value={row.period}>{row.period}</MenuItem>)}
                  </TextField>
                </Stack>
                <Grid container spacing={2}>
                  {/* The finance template's management summary, in its order. */}
                  <Grid item xs={12}>
                    <Card variant="outlined"><CardContent>
                      <Typography fontWeight={800} sx={{ mb: 1 }}>Management summary — {bucket.period}</Typography>
                      <Grid container spacing={1}>
                        {([
                          ['Total revenue', bucket.totalRevenue],
                          ['Room revenue', bucket.management?.roomRevenue ?? bucket.rooms.roomRevenue],
                          ['Food revenue', bucket.management?.foodRevenue ?? 0],
                          ['Bar revenue', bucket.management?.barRevenue ?? 0],
                          ['Other revenue', bucket.management?.otherRevenue ?? 0],
                          ['Cost of sales', bucket.cogs],
                          ['Gross profit', bucket.grossProfit],
                          ['Operating expenses', bucket.operatingExpenses],
                          ['Net operating profit', bucket.netOperatingProfit],
                          ['Cash available', bucket.management?.cashAvailable ?? 0],
                          ['Bank balance', bucket.management?.bankBalance ?? 0],
                          ['Outstanding supplier debt', data.outstandingSupplierDebt ?? 0],
                          ['Outstanding loans', data.outstandingLoans ?? 0]
                        ] as Array<[string, number]>).map(([label, value]) => (
                          <Grid item xs={6} sm={4} md={3} key={label}>
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                            <Typography fontWeight={800} color={value < 0 ? 'error.main' : undefined}>{naira(value)}</Typography>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent></Card>
                  </Grid>
                  {bucket.budgetVsActual?.length ? (
                    <Grid item xs={12}>
                      <Card variant="outlined"><CardContent>
                        <Typography fontWeight={800} sx={{ mb: 1 }}>Operating expenses: budget vs actual</Typography>
                        <Table size="small">
                          <TableHead><TableRow><TableCell>Expense</TableCell><TableCell align="right">Budget</TableCell><TableCell align="right">Actual</TableCell><TableCell align="right">Difference</TableCell></TableRow></TableHead>
                          <TableBody>
                            {bucket.budgetVsActual.map((row) => (
                              <TableRow key={row.category}>
                                <TableCell>{labelOf(row.category, meta?.expenseCategories)}</TableCell>
                                <TableCell align="right">{naira(row.budget)}</TableCell>
                                <TableCell align="right">{naira(row.actual)}</TableCell>
                                <TableCell align="right" sx={{ color: row.difference < 0 ? 'error.main' : 'success.main', fontWeight: 700 }}>{naira(row.difference)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent></Card>
                    </Grid>
                  ) : null}
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined"><CardContent>
                      <Typography fontWeight={800} sx={{ mb: 1 }}>Revenue by source</Typography>
                      {Object.entries(bucket.revenueBySource).sort((a, b) => b[1] - a[1]).map(([key, value]) => (
                        <Stack key={key} direction="row" justifyContent="space-between"><Typography variant="body2">{labelOf(key, meta?.revenueSources)}</Typography><Typography variant="body2" fontWeight={700}>{naira(value)}</Typography></Stack>
                      ))}
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}><Typography fontWeight={800}>Total</Typography><Typography fontWeight={800}>{naira(bucket.totalRevenue)}</Typography></Stack>
                    </CardContent></Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined"><CardContent>
                      <Typography fontWeight={800} sx={{ mb: 1 }}>Profit and loss</Typography>
                      {[
                        ['Total revenue', bucket.totalRevenue],
                        ['Less cost of goods sold', -bucket.cogs],
                        ['Gross profit', bucket.grossProfit],
                        ...Object.entries(bucket.expensesByCategory).map(([key, value]) => [`Less ${labelOf(key, meta?.expenseCategories).toLowerCase()}`, -value] as [string, number]),
                        ['Net operating profit', bucket.netOperatingProfit]
                      ].map(([label, value]) => (
                        <Stack key={String(label)} direction="row" justifyContent="space-between">
                          <Typography variant="body2" fontWeight={String(label).startsWith('Less') ? 400 : 800}>{label}</Typography>
                          <Typography variant="body2" fontWeight={String(label).startsWith('Less') ? 400 : 800} color={Number(value) < 0 ? 'error.main' : undefined}>{naira(Number(value))}</Typography>
                        </Stack>
                      ))}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>Tracked separately:</Typography>
                      {Object.entries(bucket.belowTheLine).map(([key, value]) => (
                        <Stack key={key} direction="row" justifyContent="space-between"><Typography variant="body2">{BELOW[key] ?? key}</Typography><Typography variant="body2">{naira(value)}</Typography></Stack>
                      ))}
                    </CardContent></Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined"><CardContent>
                      <Typography fontWeight={800} sx={{ mb: 1 }}>Room performance</Typography>
                      {[
                        ['Room nights available', bucket.rooms.roomNightsAvailable],
                        ['Rooms sold', bucket.rooms.roomsSold],
                        ['Complimentary', bucket.rooms.complimentary],
                        ['Out of order (nights)', bucket.rooms.outOfOrderNights],
                        ['Occupancy', `${bucket.rooms.occupancyPercent}%`],
                        ['Average room rate', naira(bucket.rooms.averageRoomRate)],
                        ['Room revenue', naira(bucket.rooms.roomRevenue)]
                      ].map(([label, value]) => (
                        <Stack key={String(label)} direction="row" justifyContent="space-between"><Typography variant="body2">{label}</Typography><Typography variant="body2" fontWeight={700}>{value}</Typography></Stack>
                      ))}
                      {bucket.rooms.topRoomTypes.length > 0 && (
                        <Typography variant="body2" sx={{ mt: 1 }}>Best-selling types: {bucket.rooms.topRoomTypes.map((type) => `${type.roomType} (${type.sold})`).join(', ')}</Typography>
                      )}
                      {bucket.rooms.topRooms.length > 0 && (
                        <Typography variant="body2">Most-sold rooms: {bucket.rooms.topRooms.map((room) => `${room.roomNumber} (${room.nights})`).join(', ')}</Typography>
                      )}
                    </CardContent></Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined"><CardContent>
                      <Typography fontWeight={800} sx={{ mb: 1 }}>Cash and bank position (closing)</Typography>
                      {bucket.closingPositions.length === 0 && <Typography variant="body2" color="text.secondary">No positions recorded.</Typography>}
                      {bucket.closingPositions.map((position) => (
                        <Stack key={position.account} direction="row" justifyContent="space-between">
                          <Typography variant="body2">{position.account} <Typography component="span" variant="caption" color="text.secondary">({position.type.replace('_', ' ').toLowerCase()})</Typography></Typography>
                          <Typography variant="body2" fontWeight={700}>{naira(position.closing)}</Typography>
                        </Stack>
                      ))}
                      {Math.abs(bucket.cashVariance) > 0.01 && (
                        <Alert severity="warning" sx={{ mt: 1 }}>Unexplained variance across the period: {naira(bucket.cashVariance)}</Alert>
                      )}
                    </CardContent></Card>
                  </Grid>
                </Grid>
              </>
            )}
          </>
        )}
        </>
        )}
      </Container>
    </Layout>
  );
}
