import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Container,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import ReportDownloadButton from '../../../components/ReportDownloadButton';
import { accountingService, TrialBalanceReport } from '../../../services/api';

const fmtNGN = (v: number | string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(v || 0));

const TrialBalancePage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await accountingService.getTrialBalanceReport({
        ...(filters.startDate ? { startDate: filters.startDate } : {}),
        ...(filters.endDate ? { endDate: filters.endDate } : {})
      });
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load trial balance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtitle =
    filters.startDate || filters.endDate
      ? `Period: ${filters.startDate || '—'} → ${filters.endDate || '—'}`
      : 'All periods';

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" mb={2}>
          <div>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              Trial Balance
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Posted journal balances by account for the selected period.
            </Typography>
          </div>
          <ReportDownloadButton
            title="Trial Balance"
            subtitle={subtitle}
            columns={[
              { key: 'accountCode', label: 'Code' },
              { key: 'accountName', label: 'Name' },
              { key: 'accountType', label: 'Type' },
              { key: 'periodDebit', label: 'Period Debit', format: (v) => fmtNGN(v), align: 'right' },
              { key: 'periodCredit', label: 'Period Credit', format: (v) => fmtNGN(v), align: 'right' },
              { key: 'closingBalance', label: 'Closing Balance', format: (v) => fmtNGN(v), align: 'right' }
            ]}
            rows={report?.rows || []}
            totals={
              report
                ? [
                    { label: 'Total Debit', value: report.totals.totalDebit, format: (v) => fmtNGN(v) },
                    { label: 'Total Credit', value: report.totals.totalCredit, format: (v) => fmtNGN(v) }
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
            <LogoLoader label="Loading trial balance" inline minHeight={260} />
          </Paper>
        ) : (
          <Paper>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Period Debit
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Period Credit
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Closing Balance
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(report?.rows || []).map((row) => (
                  <TableRow key={row.accountCode} hover>
                    <TableCell className="mono">{row.accountCode}</TableCell>
                    <TableCell>{row.accountName}</TableCell>
                    <TableCell>{row.accountType}</TableCell>
                    <TableCell align="right" className="mono">
                      {fmtNGN(row.periodDebit)}
                    </TableCell>
                    <TableCell align="right" className="mono">
                      {fmtNGN(row.periodCredit)}
                    </TableCell>
                    <TableCell align="right" className="mono">
                      {fmtNGN(row.closingBalance)}
                    </TableCell>
                  </TableRow>
                ))}

                {(!report || report.rows.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                        No rows returned for this period.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}

                {report && report.rows.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ fontWeight: 700 }}>
                      Totals
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }} className="mono">
                      {fmtNGN(report.totals.totalDebit)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }} className="mono">
                      {fmtNGN(report.totals.totalCredit)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Container>
    </Layout>
  );
};

export default TrialBalancePage;
