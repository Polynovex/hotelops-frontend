import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import ReportDownloadButton from '../../../components/ReportDownloadButton';
import { accountingService, VatSummaryReport } from '../../../services/api';

const fmtNGN = (v: number | string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(v || 0));

const VatSummaryPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState<VatSummaryReport | null>(null);
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await accountingService.getVatSummaryReport({
        ...(filters.startDate ? { startDate: filters.startDate } : {}),
        ...(filters.endDate ? { endDate: filters.endDate } : {})
      });
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load VAT summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadRows = report
    ? [
        { metric: 'VAT Rate', value: `${report.vatRate}%` },
        { metric: 'Taxable Amount', value: report.taxableAmount },
        { metric: 'VAT Amount', value: report.vatAmount }
      ]
    : [];

  const subtitle =
    filters.startDate || filters.endDate
      ? `Period: ${filters.startDate || '—'} → ${filters.endDate || '—'}`
      : 'All periods';

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" mb={2}>
          <div>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              VAT Summary
            </Typography>
            <Typography variant="body2" color="text.secondary">
              VAT return summary with configurable period filters.
            </Typography>
          </div>
          <ReportDownloadButton
            title="VAT Summary"
            subtitle={subtitle}
            columns={[
              { key: 'metric', label: 'Metric' },
              {
                key: 'value',
                label: 'Value',
                format: (v) => (typeof v === 'number' ? fmtNGN(v) : String(v ?? '')),
                align: 'right'
              }
            ]}
            rows={downloadRows}
            disabled={loading}
          />
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
            <TextField
              type="date"
              label="Start Date"
              value={filters.startDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              type="date"
              label="End Date"
              value={filters.endDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="contained" onClick={() => void load()} disabled={loading}>
              Run Report
            </Button>
          </Stack>
        </Paper>

        {loading ? (
          <Paper>
            <LogoLoader label="Calculating VAT" inline minHeight={200} />
          </Paper>
        ) : (
          <Paper sx={{ p: 3 }}>
            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>VAT Rate</Typography>
                <Typography className="mono">{Number(report?.vatRate || 0)}%</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>Taxable Amount</Typography>
                <Typography className="mono">{fmtNGN(report?.taxableAmount || 0)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid', borderColor: 'primary.main', pt: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>VAT Amount</Typography>
                <Typography sx={{ fontWeight: 700 }} className="mono">
                  {fmtNGN(report?.vatAmount || 0)}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        )}
      </Container>
    </Layout>
  );
};

export default VatSummaryPage;