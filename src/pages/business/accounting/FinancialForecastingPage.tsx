import { useEffect, useState } from 'react';
import { downloadFile } from '../../../services/desktopBridge';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography
} from '@mui/material';
import { DownloadRounded, TrendingUpRounded } from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { useAuthStore } from '../../../store/authStore';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';

interface YoyMonth {
  month: string;
  currentYear: number;
  priorYear: number;
  change: number;
  changePercent: number | null;
}

interface ForecastYear {
  year: number;
  predictedRevenue: number;
}

interface HistoricalYear {
  year: number;
  revenue: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(v);

const FinancialForecastingPage = () => {
  const token = useAuthStore((s) => s.token);
  const baseUrl = (import.meta as any).env?.VITE_API_URL ?? '';

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [yoyData, setYoyData] = useState<{ currentYear: number; priorYear: number; months: YoyMonth[]; totals: { currentYear: number; priorYear: number } } | null>(null);
  const [forecastData, setForecastData] = useState<{ historical: HistoricalYear[]; forecast: ForecastYear[]; model: { r2: number } } | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [yoyRes, forecastRes] = await Promise.all([
        fetch(`${baseUrl}/finance/year-over-year`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${baseUrl}/finance/forecast?yearsBack=5&yearsForward=3`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (yoyRes.ok) setYoyData(await yoyRes.json());
      if (forecastRes.ok) setForecastData(await forecastRes.json());
    } catch (err: any) {
      setError(err.message ?? 'Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const downloadExcel = async (endpoint: string, filename: string) => {
    try {
      const res = await fetch(`${baseUrl}/finance/export/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Export failed');
      const buffer = await res.arrayBuffer();
      await downloadFile(
        buffer,
        filename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    } catch (err: any) {
      setError(err.message ?? 'Export failed');
    }
  };

  const combinedChart = forecastData
    ? [
        ...forecastData.historical.map((h) => ({ year: h.year, actual: h.revenue, forecast: null })),
        ...forecastData.forecast.map((f) => ({ year: f.year, actual: null, forecast: f.predictedRevenue }))
      ]
    : [];

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2} mb={3}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Financial Forecasting</Typography>
            <Typography variant="body2" color="text.secondary">
              Year-over-year comparison and linear regression revenue forecast
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} flexWrap="wrap">
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadRounded />}
              onClick={() => downloadExcel('revenue', `revenue-report-${new Date().getFullYear()}.xlsx`)}
            >
              Export YoY (.xlsx)
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadRounded />}
              onClick={() => downloadExcel('forecast', `forecast-${new Date().getFullYear()}.xlsx`)}
            >
              Export Forecast (.xlsx)
            </Button>
          </Stack>
        </Stack>

        {loading && <LogoLoader inline minHeight={160} label="Loading financial data…" />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label="Year-over-Year" />
          <Tab label="Revenue Forecast" />
        </Tabs>

        {tab === 0 && yoyData && (
          <>
            <Grid container spacing={2} mb={3}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" variant="body2">{yoyData.currentYear} Total</Typography>
                    <Typography variant="h4" fontWeight={700}>{fmt(yoyData.totals.currentYear)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" variant="body2">{yoyData.priorYear} Total</Typography>
                    <Typography variant="h4" fontWeight={700}>{fmt(yoyData.totals.priorYear)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" variant="body2">YoY Change</Typography>
                    <Typography
                      variant="h4"
                      fontWeight={700}
                      color={yoyData.totals.currentYear >= yoyData.totals.priorYear ? 'success.main' : 'error.main'}
                    >
                      {yoyData.totals.priorYear > 0
                        ? `${(((yoyData.totals.currentYear - yoyData.totals.priorYear) / yoyData.totals.priorYear) * 100).toFixed(1)}%`
                        : '—'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" fontWeight={700} mb={2}>Monthly Comparison</Typography>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={yoyData.months} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="currentYear" name={String(yoyData.currentYear)} fill="#1A3A4A" />
                  <Bar dataKey="priorYear" name={String(yoyData.priorYear)} fill="#D7A34D" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight={700} mb={1}>Monthly Detail</Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Month', yoyData.currentYear, yoyData.priorYear, 'Change', 'Change %'].map((h) => (
                        <th key={String(h)} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #eee', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yoyData.months.map((m) => (
                      <tr key={m.month}>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>{m.month}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>{fmt(m.currentYear)}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>{fmt(m.priorYear)}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', color: m.change >= 0 ? '#2e7d32' : '#c62828' }}>
                          {m.change >= 0 ? '+' : ''}{fmt(m.change)}
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
                          {m.changePercent !== null ? `${m.changePercent > 0 ? '+' : ''}${m.changePercent}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </Paper>
          </>
        )}

        {tab === 1 && forecastData && (
          <>
            <Stack direction="row" spacing={2} mb={3} flexWrap="wrap">
              <Chip
                icon={<TrendingUpRounded />}
                label={`Model R² = ${(forecastData.model.r2 * 100).toFixed(1)}% fit`}
                color={forecastData.model.r2 >= 0.7 ? 'success' : forecastData.model.r2 >= 0.4 ? 'warning' : 'error'}
              />
              <Typography variant="body2" color="text.secondary" alignSelf="center">
                Higher R² = more reliable forecast
              </Typography>
            </Stack>

            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" fontWeight={700} mb={2}>Historical + Forecast Trend</Typography>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={combinedChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v) => `₦${(v / 1_000_000).toFixed(1)}M`} />
                  <Tooltip formatter={(v: any) => fmt(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="actual" name="Actual Revenue" stroke="#1A3A4A" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                  <Line type="monotone" dataKey="forecast" name="Predicted Revenue" stroke="#D7A34D" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 4 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </Paper>

            <Grid container spacing={2}>
              <Grid item xs={12} md={5}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" fontWeight={700} mb={1}>Historical Revenue</Typography>
                  <Divider sx={{ mb: 1 }} />
                  {forecastData.historical.map((h) => (
                    <Stack key={h.year} direction="row" justifyContent="space-between" py={0.75}>
                      <Typography variant="body2">{h.year}</Typography>
                      <Typography variant="body2" fontWeight={600}>{fmt(h.revenue)}</Typography>
                    </Stack>
                  ))}
                </Paper>
              </Grid>
              <Grid item xs={12} md={7}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" fontWeight={700} mb={1}>Revenue Forecast</Typography>
                  <Divider sx={{ mb: 1 }} />
                  {forecastData.forecast.map((f) => (
                    <Stack key={f.year} direction="row" justifyContent="space-between" alignItems="center" py={0.75}>
                      <Typography variant="body2">{f.year}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label="Predicted" color="warning" variant="outlined" />
                        <Typography variant="body2" fontWeight={700} color="warning.main">{fmt(f.predictedRevenue)}</Typography>
                      </Stack>
                    </Stack>
                  ))}
                </Paper>
              </Grid>
            </Grid>
          </>
        )}
      </Container>
    </Layout>
  );
};

export default FinancialForecastingPage;
