import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import ReportDownloadButton from '../../../components/ReportDownloadButton';
import { accountingService, ProfitLossReport } from '../../../services/api';

const fmtNGN = (v: number | string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(v || 0));

const ProfitLossPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await accountingService.getProfitLossReport({
        ...(filters.startDate ? { startDate: filters.startDate } : {}),
        ...(filters.endDate ? { endDate: filters.endDate } : {})
      });
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load P&L report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build a flat rows array for download (income then expenses then totals)
  const downloadRows = report
    ? [
        ...report.income.map((r) => ({ ...r, section: 'Income' })),
        ...report.expenses.map((r) => ({ ...r, section: 'Expense', amount: -r.amount }))
      ]
    : [];

  const subtitle =
    filters.startDate || filters.endDate
      ? `Period: ${filters.startDate || '—'} → ${filters.endDate || '—'}`
      : 'All periods';

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" mb={2}>
          <div>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              Profit &amp; Loss
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Income and expense summary from posted journals.
            </Typography>
          </div>
          <ReportDownloadButton
            title="Profit & Loss"
            subtitle={subtitle}
            columns={[
              { key: 'section', label: 'Section' },
              { key: 'code', label: 'Code' },
              { key: 'name', label: 'Name' },
              { key: 'amount', label: 'Amount', format: (v) => fmtNGN(v), align: 'right' }
            ]}
            rows={downloadRows}
            totals={
              report
                ? [
                    { label: 'Total Income', value: report.totalIncome, format: (v) => fmtNGN(v) },
                    { label: 'Total Expenses', value: report.totalExpenses, format: (v) => fmtNGN(v) },
                    { label: 'Net Profit', value: report.netProfit, format: (v) => fmtNGN(v) }
                  ]
                : []
            }
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
            <LogoLoader label="Loading P&L" inline minHeight={260} />
          </Paper>
        ) : (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Income
            </Typography>
            <Stack spacing={1} sx={{ mb: 2 }}>
              {(report?.income || []).map((row) => (
                <Box key={row.code} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>
                    <span className="mono">{row.code}</span> — {row.name}
                  </Typography>
                  <Typography className="mono">{fmtNGN(row.amount)}</Typography>
                </Box>
              ))}
              {(!report || report.income.length === 0) && (
                <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                  No income posted.
                </Typography>
              )}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Expenses
            </Typography>
            <Stack spacing={1} sx={{ mb: 2 }}>
              {(report?.expenses || []).map((row) => (
                <Box key={row.code} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>
                    <span className="mono">{row.code}</span> — {row.name}
                  </Typography>
                  <Typography className="mono">{fmtNGN(row.amount)}</Typography>
                </Box>
              ))}
              {(!report || report.expenses.length === 0) && (
                <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                  No expenses posted.
                </Typography>
              )}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 700 }}>Total Income</Typography>
                <Typography sx={{ fontWeight: 700 }} className="mono">
                  {fmtNGN(report?.totalIncome || 0)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 700 }}>Total Expenses</Typography>
                <Typography sx={{ fontWeight: 700 }} className="mono">
                  {fmtNGN(report?.totalExpenses || 0)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 700 }}>Net Profit</Typography>
                <Typography
                  sx={{
                    fontWeight: 700,
                    color: Number(report?.netProfit || 0) >= 0 ? 'success.main' : 'error.main'
                  }}
                  className="mono"
                >
                  {fmtNGN(report?.netProfit || 0)}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        )}
      </Container>
    </Layout>
  );
};

export default ProfitLossPage;
