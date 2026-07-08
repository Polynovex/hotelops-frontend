import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import { useAuthStore } from '../../../store/authStore';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import DataTable from '../../../components/common/DataTable';

type Classification = 'STAR' | 'PUZZLE' | 'PLOWHORSE' | 'DOG';

interface MERow {
  itemId: string;
  name: string;
  category: string | null;
  price: number;
  cost: number;
  orderCount: number;
  revenue: number;
  contributionMargin: number;
  contributionMarginRate: number;
  classification: Classification;
}

interface MESummary {
  STAR: number;
  PUZZLE: number;
  PLOWHORSE: number;
  DOG: number;
  avgOrderCount: number;
  avgContributionMargin: number;
  totalRevenue: number;
  periodDays: number;
}

const classColor = (c: Classification) => {
  if (c === 'STAR') return 'success';
  if (c === 'PUZZLE') return 'warning';
  if (c === 'PLOWHORSE') return 'info';
  return 'error';
};

const classDesc: Record<Classification, string> = {
  STAR: 'High popularity · High profitability — promote & protect',
  PUZZLE: 'Low popularity · High profitability — reposition or reprice',
  PLOWHORSE: 'High popularity · Low profitability — reduce cost or raise price',
  DOG: 'Low popularity · Low profitability — consider removing'
};

const QuadrantCard = ({ label, count, desc, color }: { label: string; count: number; desc: string; color: string }) => (
  <Card sx={{ borderLeft: `4px solid`, borderColor: `${color}.main` }}>
    <CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
        <Typography variant="h6" fontWeight={700}>{label}</Typography>
        <Typography variant="h3" fontWeight={700} color={`${color}.main`}>{count}</Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">{desc}</Typography>
    </CardContent>
  </Card>
);

const MenuEngineeringPage = () => {
  const token = useAuthStore((s) => s.token);
  const baseUrl = (import.meta as any).env?.VITE_API_URL ?? '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<MERow[]>([]);
  const [summary, setSummary] = useState<MESummary | null>(null);
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<Classification | 'ALL'>('ALL');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${baseUrl}/api/pos/menu-engineering?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRows(data.rows ?? []);
      setSummary(data.summary ?? null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load menu engineering data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [days]);

  const filtered = tab === 'ALL' ? rows : rows.filter((r) => r.classification === tab);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2} mb={3}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Menu Engineering</Typography>
            <Typography variant="body2" color="text.secondary">
              BCG matrix classification: Stars, Puzzles, Plowhorses, Dogs
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <TextField select label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))} size="small" sx={{ minWidth: 130 }}>
              <MenuItem value={7}>Last 7 days</MenuItem>
              <MenuItem value={30}>Last 30 days</MenuItem>
              <MenuItem value={90}>Last 90 days</MenuItem>
              <MenuItem value={365}>Last 1 year</MenuItem>
            </TextField>
          </Stack>
        </Stack>

        {loading && <LogoLoader inline minHeight={160} label="Analysing menu…" />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {summary && (
          <Grid container spacing={2} mb={3}>
            {(['STAR', 'PUZZLE', 'PLOWHORSE', 'DOG'] as Classification[]).map((c) => (
              <Grid item xs={12} sm={6} md={3} key={c}>
                <QuadrantCard
                  label={c}
                  count={summary[c]}
                  desc={classDesc[c]}
                  color={classColor(c)}
                />
              </Grid>
            ))}
            <Grid item xs={12} sm={6} md={4}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">Total Revenue (period)</Typography>
                  <Typography variant="h5" fontWeight={700}>₦{summary.totalRevenue.toLocaleString()}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">Avg. Orders / Item</Typography>
                  <Typography variant="h5" fontWeight={700}>{summary.avgOrderCount.toFixed(1)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">Avg. Contribution Margin</Typography>
                  <Typography variant="h5" fontWeight={700}>₦{summary.avgContributionMargin.toFixed(0)}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        <Paper sx={{ p: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="All Items" value="ALL" />
            {(['STAR', 'PUZZLE', 'PLOWHORSE', 'DOG'] as const).map((c) => (
              <Tab
                key={c}
                value={c}
                label={
                  <Chip
                    size="small"
                    label={`${c} (${rows.filter((r) => r.classification === c).length})`}
                    color={classColor(c) as any}
                  />
                }
              />
            ))}
          </Tabs>

          <DataTable
            rows={filtered}
            rowKey={(r) => r.itemId}
            defaultRowsPerPage={20}
            emptyText="No menu items found for the selected period."
            columns={[
              { key: 'name', label: 'Item', minWidth: 180 },
              { key: 'category', label: 'Category', minWidth: 130, render: (r) => r.category ?? '—' },
              { key: 'price', label: 'Price', minWidth: 120, render: (r) => `₦${r.price.toLocaleString()}` },
              { key: 'cost', label: 'Cost', minWidth: 120, render: (r) => r.cost > 0 ? `₦${r.cost.toLocaleString()}` : '—' },
              { key: 'orderCount', label: 'Orders', minWidth: 100 },
              { key: 'revenue', label: 'Revenue', minWidth: 140, render: (r) => `₦${r.revenue.toLocaleString()}` },
              {
                key: 'contributionMargin',
                label: 'CM',
                minWidth: 120,
                render: (r) => `₦${r.contributionMargin.toLocaleString()} (${(r.contributionMarginRate * 100).toFixed(0)}%)`
              },
              {
                key: 'classification',
                label: 'Class',
                minWidth: 140,
                render: (r) => (
                  <Chip size="small" label={r.classification} color={classColor(r.classification) as any} />
                )
              }
            ]}
          />
        </Paper>
      </Container>
    </Layout>
  );
};

export default MenuEngineeringPage;
