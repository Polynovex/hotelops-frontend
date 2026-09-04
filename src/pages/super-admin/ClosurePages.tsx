import { useEffect, useMemo, useState } from 'react';
import {
  MetricCard,
  PremiumCard,
  SectionHeader,
  StatusIndicator,
  type StatusTone
} from '../../components/premium';
import {
  BusinessRounded,
  CheckCircleRounded,
  PaymentsRounded,
  TrendingUpRounded
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Divider,
  Chip,
  Container,
  Grid,
  Stack,
  Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Layout from '../../components/Layout';
import LogoLoader from '../../components/LogoLoader';
import DataTable from '../../components/common/DataTable';
import { superAdminService, SystemEventsSnapshot, SystemMetrics } from '../../services/api';

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

/** Maps an overall health string to the shared status palette. */
const healthTone = (status?: string): StatusTone => {
  if (status === 'ok' || status === 'healthy') return 'healthy';
  if (status === 'degraded') return 'warning';
  if (!status) return 'inactive';
  return 'error';
};

/** Same, for an individual dependency's reported state. */
const serviceTone = (status: string): StatusTone => {
  const value = status.toLowerCase();
  if (value === 'up' || value === 'connected' || value === 'ok') return 'healthy';
  if (value === 'disabled' || value === 'inactive') return 'inactive';
  if (value === 'degraded') return 'warning';
  return 'error';
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

        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              label="Total Businesses"
              value={metrics.totalBusinesses}
              detail="All tenants on the platform"
              icon={<BusinessRounded />}
              variant="navy"
              loading={loading}
              onClick={() => navigate('/super-admin/businesses')}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              label="Active"
              value={metrics.activeBusinesses}
              detail={`${metrics.trialBusinesses} on trial`}
              icon={<CheckCircleRounded />}
              variant="tinted"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              label="Recent Signups"
              value={metrics.recentSignups}
              detail="Last 30 days"
              icon={<TrendingUpRounded />}
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              label="MRR"
              value={`₦${metrics.mrr.toLocaleString()}`}
              detail="Monthly recurring revenue"
              icon={<PaymentsRounded />}
              variant="navy"
              loading={loading}
            />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <PremiumCard sx={{ height: 320 }}>
              <SectionHeader title="Business Distribution" />
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  {/* Vertical grid lines removed: they add noise without aiding
                      comparison on a categorical axis. */}
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(15,34,57,0.10)" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: '#5A6A73' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: '#5A6A73' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(36,59,143,0.06)' }}
                    contentStyle={{
                      borderRadius: 10,
                      border: '1px solid rgba(15,34,57,0.10)',
                      boxShadow: '0 8px 30px rgba(15,34,57,0.10)',
                      fontSize: 13
                    }}
                  />
                  <Bar dataKey="value" fill="#243B8F" radius={[8, 8, 0, 0]} maxBarSize={64} />
                </BarChart>
              </ResponsiveContainer>
            </PremiumCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <PremiumCard sx={{ height: 320 }}>
              <SectionHeader title="System Health" />
              <Box sx={{ mb: 2 }}>
                <StatusIndicator
                  tone={healthTone(health?.status)}
                  label={health?.status === 'ok' ? 'System Operational' : `System ${health?.status || 'unknown'}`}
                  size={10}
                />
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              <Stack spacing={1.25}>
                {Object.entries(health?.services || {}).map(([service, status]) => (
                  <Stack key={service} direction="row" alignItems="center">
                    <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, textTransform: 'capitalize' }}>
                      {service.replace(/([A-Z])/g, ' $1')}
                    </Typography>
                    <StatusIndicator tone={serviceTone(status)} label={status} />
                  </Stack>
                ))}
                <Divider sx={{ my: 0.5 }} />
                <Stack direction="row">
                  <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>Processed events</Typography>
                  <Typography variant="body2" fontWeight={700}>{events.processedEvents}</Typography>
                </Stack>
                <Stack direction="row">
                  <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>Pending events</Typography>
                  <Typography variant="body2" fontWeight={700} color={events.pendingEvents > 0 ? 'warning.main' : undefined}>
                    {events.pendingEvents}
                  </Typography>
                </Stack>
              </Stack>
            </PremiumCard>
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
