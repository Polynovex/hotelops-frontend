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

  Stack,
  Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import { accountingService, NightAuditStatus } from '../../../services/api';

const NightAuditStatusPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<NightAuditStatus | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setStatus(await accountingService.getNightAuditStatus());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load night audit status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString();
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Night Audit Status
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Current business date, lock state, and latest close summary.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.2}>
            <Button variant="outlined" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
            <Button variant="contained" onClick={() => navigate('/business/accounting/night-audit/validate')}>
              Validate Audit
            </Button>
          </Stack>
        </Stack>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary">Current Business Date</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {formatDate(status?.businessDate)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary">Last Audit Date</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {formatDate(status?.lastAuditDate)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary">Transaction Lock</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {formatDate(status?.lockedUntil)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Business Day State
              </Typography>
              <Chip
                size="small"
                color={status?.isOpen ? 'success' : 'warning'}
                label={status?.isOpen ? 'OPEN' : 'CLOSED'}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Transactions on or before locked date are blocked after a successful night audit.
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              Latest Audit Summary
            </Typography>
            {status?.latestAudit ? (
              <Grid container spacing={1.5}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2">Audit Date: {formatDate(status.latestAudit.auditDate)}</Typography>
                  <Typography variant="body2">Closed At: {formatDate(status.latestAudit.closedAt)}</Typography>
                  <Typography variant="body2">Closed By: {status.latestAudit.closedBy || '—'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2">
                    Total Revenue: ₦{Number(status.latestAudit.totalRevenue || 0).toLocaleString()}
                  </Typography>
                  <Typography variant="body2">
                    POS Total: ₦{Number(status.latestAudit.totalPosSales || status.latestAudit.posTotal || 0).toLocaleString()}
                  </Typography>
                  <Typography variant="body2">
                    Journal: {status.latestAudit.revenueJournalId || '—'}
                  </Typography>
                </Grid>
              </Grid>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No completed night audit found yet.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Container>
    </Layout>
  );
};

export default NightAuditStatusPage;
