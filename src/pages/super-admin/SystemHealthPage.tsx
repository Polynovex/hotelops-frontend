import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  Typography
} from '@mui/material';
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

const SystemHealthPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<Record<string, unknown>>({});
  const [metrics, setMetrics] = useState<SystemMetrics>(defaultMetrics);
  const [events, setEvents] = useState<SystemEventsSnapshot>({ pendingEvents: 0, processedEvents: 0, recentEvents: [] });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [healthData, metricsData, eventsData] = await Promise.all([
        superAdminService.getSystemHealth(),
        superAdminService.getSystemMetrics(),
        superAdminService.getSystemEvents()
      ]);
      setHealth(healthData);
      setMetrics(metricsData);
      setEvents(eventsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load system health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /**
   * The server reports { database, cache, eventBus }. This page read
   * `services.rabbitmq`, which does not exist in that payload, so the queue row
   * always rendered "unknown" regardless of the real state — the metric looked
   * broken when the reporting was simply reading the wrong key.
   */
  const services = (health.services || {}) as {
    database?: string;
    cache?: string;
    eventBus?: string;
  };

  /**
   * "disabled" is a legitimate state, not a fault: the cache and event bus are
   * optional dependencies, and the app degrades deliberately when they are
   * absent. Showing that distinctly avoids reading a supported configuration as
   * an outage.
   */
  const dependencyTone = (status?: string) => {
    const value = (status || '').toLowerCase();
    if (['up', 'ok', 'connected', 'healthy'].includes(value)) return 'success' as const;
    if (['disabled', 'inactive'].includes(value)) return 'default' as const;
    if (value === 'degraded') return 'warning' as const;
    if (!value) return 'default' as const;
    return 'error' as const;
  };

  const dependencyLabel = (status?: string) => {
    if (!status) return 'Not reported';
    if (status === 'disabled') return 'Not configured';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>System Health</Typography>
            <Typography variant="body2" color="text.secondary">Platform dependencies, business metrics and outbox activity.</Typography>
          </Box>
          <Button variant="outlined" onClick={() => void load()} disabled={loading}>Refresh</Button>
        </Box>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={3}>
            <Card><CardContent><Typography color="textSecondary">Health Status</Typography><Typography variant="h5" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>{String(health.status || 'unknown')}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card><CardContent><Typography color="textSecondary">Active Businesses</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{metrics.activeBusinesses}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card><CardContent><Typography color="textSecondary">Pending Events</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{events.pendingEvents}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card><CardContent><Typography color="textSecondary">MRR</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>₦{metrics.mrr.toLocaleString()}</Typography></CardContent></Card>
          </Grid>
        </Grid>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Dependencies</Typography>
              <Stack spacing={1.25}>
                {([
                  { label: 'Database', status: services.database, required: true },
                  { label: 'Cache (Redis)', status: services.cache, required: false },
                  { label: 'Queue (RabbitMQ)', status: services.eventBus, required: false }
                ]).map((dependency) => (
                  <Stack
                    key={dependency.label}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Box>
                      <Typography variant="body2">{dependency.label}</Typography>
                      {!dependency.required && dependency.status === 'disabled' && (
                        <Typography variant="caption" color="text.secondary">
                          Optional — the platform falls back in-process
                        </Typography>
                      )}
                    </Box>
                    <Chip
                      size="small"
                      label={dependencyLabel(dependency.status)}
                      color={dependencyTone(dependency.status)}
                      variant={dependencyTone(dependency.status) === 'default' ? 'outlined' : 'filled'}
                    />
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Business Distribution</Typography>
              <Typography variant="body2">Total: {metrics.totalBusinesses}</Typography>
              <Typography variant="body2">Trial: {metrics.trialBusinesses}</Typography>
              <Typography variant="body2">Suspended: {metrics.suspendedBusinesses}</Typography>
              <Typography variant="body2">Recent Signups (30d): {metrics.recentSignups}</Typography>
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Recent System Events</Typography>
          <DataTable
            rows={events.recentEvents}
            rowKey={(event) => event.id}
            defaultRowsPerPage={10}
            emptyText={loading ? 'Loading events...' : 'No recent events available.'}
            columns={[
              { key: 'id', label: 'Event ID', minWidth: 220 },
              { key: 'eventType', label: 'Type', minWidth: 160 },
              {
                key: 'createdAt',
                label: 'Created',
                minWidth: 180,
                render: (event) => new Date(event.createdAt).toLocaleString()
              },
              {
                key: 'processed',
                label: 'Processed',
                minWidth: 120,
                render: (event) => (event.processed ? 'Yes' : 'No')
              }
            ]}
          />
        </Box>
      </Container>
    </Layout>
  );
};

export default SystemHealthPage;
