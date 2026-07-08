import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography
} from '@mui/material';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import ReportDownloadButton from '../../../components/ReportDownloadButton';
import { accountingService, AgingReport } from '../../../services/api';

const fmtNGN = (v: number | string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(v || 0));

const AgingReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [arReport, setArReport] = useState<AgingReport | null>(null);
  const [apReport, setApReport] = useState<AgingReport | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [ar, ap] = await Promise.all([
        accountingService.getAgingArReport(),
        accountingService.getAgingApReport()
      ]);
      setArReport(ar);
      setApReport(ap);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load aging reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const active = tab === 0 ? arReport : apReport;
  const summary = active?.summary;
  const label = tab === 0 ? 'Accounts Receivable' : 'Accounts Payable';

  const downloadRows = useMemo(() => {
    if (!summary) return [];
    return [
      { bucket: '0–30 days', amount: summary['0-30'] },
      { bucket: '31–60 days', amount: summary['31-60'] },
      { bucket: '61–90 days', amount: summary['61-90'] },
      { bucket: '90+ days', amount: summary['90+'] }
    ];
  }, [summary]);

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              Aging Reports
            </Typography>
            <Typography variant="body2" color="text.secondary">
              AR/AP aging buckets for outstanding balances.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
            <ReportDownloadButton
              title={`Aging — ${label}`}
              subtitle={`Generated ${new Date().toLocaleDateString()}`}
              columns={[
                { key: 'bucket', label: 'Bucket' },
                { key: 'amount', label: 'Amount', format: (v) => fmtNGN(v), align: 'right' }
              ]}
              rows={downloadRows}
              totals={summary ? [{ label: 'Total', value: summary.total, format: (v) => fmtNGN(v) }] : []}
              disabled={loading}
            />
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Paper sx={{ p: 2, mb: 2 }}>
          <Tabs value={tab} onChange={(_, value: number) => setTab(value)}>
            <Tab label="Accounts Receivable" />
            <Tab label="Accounts Payable" />
          </Tabs>
        </Paper>

        {loading ? (
          <Paper>
            <LogoLoader label="Loading aging report" inline minHeight={260} />
          </Paper>
        ) : (
          <Paper sx={{ p: 3 }}>
            <Stack spacing={1.25}>
              {downloadRows.map((row) => (
                <Box key={row.bucket} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>{row.bucket}</Typography>
                  <Typography className="mono">{fmtNGN(row.amount)}</Typography>
                </Box>
              ))}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid', borderColor: 'primary.main', pt: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>Total</Typography>
                <Typography sx={{ fontWeight: 700 }} className="mono">
                  {fmtNGN(summary?.total || 0)}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        )}
      </Container>
    </Layout>
  );
};

export default AgingReportsPage;