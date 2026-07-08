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
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Layout from '../../components/Layout';
import LogoLoader from '../../components/LogoLoader';
import DataTable from '../../components/common/DataTable';
import { superAdminService, api, SystemEventsSnapshot, SystemMetrics } from '../../services/api';

const defaultMetrics: SystemMetrics = {
  totalBusinesses: 0,
  activeBusinesses: 0,
  trialBusinesses: 0,
  suspendedBusinesses: 0,
  recentSignups: 0,
  totalPlans: 0,
  mrr: 0
};

const eventStatusColor = (processed?: boolean) => (processed ? 'success' : 'warning');

const DatabaseMigrationPanel = () => {
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceType, setSourceType] = useState('generic');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ message: string; migrated?: number } | null>(null);
  const [error, setError] = useState('');

  const runMigration = async () => {
    if (!sourceUrl.trim()) { setError('Source database URL is required'); return; }
    setSaving(true);
    setError('');
    setResult(null);
    try {
      const response = await api.post('/admin/migrate/sync', { sourceUrl: sourceUrl.trim(), sourceType });
      const data = response.data as { message?: string; migrated?: number };
      setResult({ message: data.message || 'Migration started successfully', migrated: data.migrated });
      setSourceUrl('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Database Migration & Sync</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Import data from an existing hotel database or booking website into HotelOpX. Only Super Admins can perform this action.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {result && <Alert severity="success" sx={{ mb: 2 }}>{result.message}{result.migrated !== undefined ? ` (${result.migrated} records migrated)` : ''}</Alert>}
      <Stack spacing={2}>
        <TextField
          select
          label="Source System Type"
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
          size="small"
          sx={{ maxWidth: 320 }}
        >
          {[
            { value: 'generic', label: 'Generic / Custom Database' },
            { value: 'opera', label: 'Oracle Opera PMS' },
            { value: 'protel', label: 'Protel PMS' },
            { value: 'cloudbeds', label: 'Cloudbeds' },
            { value: 'mews', label: 'Mews PMS' },
            { value: 'booking_com', label: 'Booking.com Export' },
            { value: 'website_api', label: 'Hotel Website API' },
          ].map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Source Database URL / API Endpoint"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://old-system.example.com/api/export  or  postgres://user:pass@host/db"
          fullWidth
          size="small"
        />
        <Box>
          <Button variant="contained" onClick={() => void runMigration()} disabled={saving || !sourceUrl.trim()}>
            {saving ? 'Running Migration…' : 'Start Migration / Sync'}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
};

export const SuperAdminDashboardPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState<SystemMetrics>(defaultMetrics);
  const [events, setEvents] = useState<SystemEventsSnapshot>({
    pendingEvents: 0,
    processedEvents: 0,
    recentEvents: []
  });
  const [health, setHealth] = useState<{ status: string; services?: Record<string, string> } | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const [metricsData, eventsData, healthData] = await Promise.all([
        superAdminService.getSystemMetrics(),
        superAdminService.getSystemEvents(),
        superAdminService.getSystemHealth()
      ]);

      setMetrics(metricsData);
      setEvents(eventsData);
      setHealth(healthData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load super admin dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const chartData = useMemo(
    () => [
      { name: 'Active', value: metrics.activeBusinesses },
      { name: 'Trial', value: metrics.trialBusinesses },
      { name: 'Suspended', value: metrics.suspendedBusinesses }
    ],
    [metrics]
  );

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Super Admin Dashboard</Typography>
            <Typography variant="body2" color="text.secondary">Platform KPIs, health checks, and event-bus activity.</Typography>
          </Box>

          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" onClick={() => void load()} disabled={loading}>Refresh</Button>
            <Button variant="contained" onClick={() => navigate('/super-admin/businesses')}>Manage Businesses</Button>
          </Stack>
        </Stack>

        {loading && <LogoLoader inline minHeight={140} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}><Card><CardContent><Typography color="textSecondary">Total Businesses</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{metrics.totalBusinesses}</Typography></CardContent></Card></Grid>
          <Grid item xs={12} sm={6} md={3}><Card><CardContent><Typography color="textSecondary">Active</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{metrics.activeBusinesses}</Typography></CardContent></Card></Grid>
          <Grid item xs={12} sm={6} md={3}><Card><CardContent><Typography color="textSecondary">Recent Signups</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{metrics.recentSignups}</Typography></CardContent></Card></Grid>
          <Grid item xs={12} sm={6} md={3}><Card><CardContent><Typography color="textSecondary">MRR</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>₦{metrics.mrr.toLocaleString()}</Typography></CardContent></Card></Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: 320 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Business Distribution</Typography>
              <ResponsiveContainer width="100%" height="88%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1E3A8A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: 320 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>System Health</Typography>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Status:</strong> {health?.status || 'unknown'}</Typography>
                {Object.entries(health?.services || {}).map(([service, status]) => (
                  <Typography key={service} variant="body2"><strong>{service}:</strong> {status}</Typography>
                ))}
                <Typography variant="body2"><strong>Processed Events:</strong> {events.processedEvents}</Typography>
                <Typography variant="body2"><strong>Pending Events:</strong> {events.pendingEvents}</Typography>
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ mt: 2 }}>
          <DataTable
            rows={events.recentEvents}
            rowKey={(event) => event.id}
            defaultRowsPerPage={10}
            emptyText="No recent system events."
            columns={[
              { key: 'id', label: 'Event ID', minWidth: 220 },
              { key: 'eventType', label: 'Type', minWidth: 180 },
              {
                key: 'createdAt',
                label: 'Created',
                minWidth: 180,
                render: (event) => new Date(event.createdAt).toLocaleString()
              },
              {
                key: 'status',
                label: 'Status',
                minWidth: 130,
                render: (event) => (
                  <Chip size="small" label={event.processed ? 'Processed' : 'Pending'} color={eventStatusColor(event.processed) as 'default'} />
                )
              }
            ]}
          />
        </Box>

        <DatabaseMigrationPanel />
      </Container>
    </Layout>
  );
};

export const SuperAdminAuditLogPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<SystemEventsSnapshot['recentEvents']>([]);

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const eventsSnapshot = await superAdminService.getSystemEvents();
      setEvents(eventsSnapshot.recentEvents);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Super Admin Audit Log</Typography>
            <Typography variant="body2" color="text.secondary">Platform system events and event-bus processing status.</Typography>
          </Box>
          <Button variant="outlined" onClick={() => void load()} disabled={loading}>Refresh</Button>
        </Stack>

        {loading && <LogoLoader inline minHeight={140} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>System Events</Typography>
        <DataTable
          rows={events}
          rowKey={(event) => event.id}
          defaultRowsPerPage={10}
          emptyText="No events available."
          columns={[
            { key: 'eventType', label: 'Event', minWidth: 220 },
            {
              key: 'createdAt',
              label: 'Created',
              minWidth: 200,
              render: (event) => new Date(event.createdAt).toLocaleString()
            },
            {
              key: 'status',
              label: 'Status',
              minWidth: 140,
              render: (event) => (
                <Chip size="small" label={event.processed ? 'Processed' : 'Pending'} color={eventStatusColor(event.processed) as 'default'} />
              )
            }
          ]}
        />
      </Container>
    </Layout>
  );
};
