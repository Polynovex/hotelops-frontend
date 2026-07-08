import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Container,
  MenuItem,
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
import { accountingService, ChartOfAccount, GeneralLedgerReport } from '../../../services/api';

const fmtNGN = (v: number | string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(v || 0));

const GeneralLedgerPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [report, setReport] = useState<GeneralLedgerReport | null>(null);
  const [filters, setFilters] = useState({ accountCode: '', startDate: '', endDate: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const accountData = await accountingService.getChartOfAccounts();
      setAccounts(accountData);

      const accountCode = filters.accountCode || accountData[0]?.accountCode;
      if (!accountCode) {
        setLoading(false);
        return;
      }

      if (!filters.accountCode) {
        setFilters((prev) => ({ ...prev, accountCode }));
      }

      const data = await accountingService.getGeneralLedgerReport(accountCode, {
        ...(filters.startDate ? { startDate: filters.startDate } : {}),
        ...(filters.endDate ? { endDate: filters.endDate } : {})
      });
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load general ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtitle = report
    ? `${report.account.accountCode} ${report.account.accountName} · ${filters.startDate || '—'} → ${filters.endDate || '—'}`
    : '';

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" mb={2}>
          <div>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              General Ledger
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Account activity details with running balances.
            </Typography>
          </div>
          <ReportDownloadButton
            title="General Ledger"
            subtitle={subtitle}
            filename={`general-ledger-${report?.account.accountCode || 'all'}`}
            columns={[
              { key: 'date', label: 'Date', format: (v) => new Date(v).toLocaleDateString() },
              { key: 'journalNumber', label: 'Journal #' },
              { key: 'reference', label: 'Reference', format: (v) => v || '—' },
              { key: 'description', label: 'Description', format: (v) => v || '—' },
              { key: 'debit', label: 'Debit', format: (v) => fmtNGN(v), align: 'right' },
              { key: 'credit', label: 'Credit', format: (v) => fmtNGN(v), align: 'right' },
              { key: 'runningBalance', label: 'Running Balance', format: (v) => fmtNGN(v), align: 'right' }
            ]}
            rows={report?.entries || []}
            totals={
              report
                ? [
                    { label: 'Total Debit', value: report.totals.debit, format: (v) => fmtNGN(v) },
                    { label: 'Total Credit', value: report.totals.credit, format: (v) => fmtNGN(v) }
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
              select
              label="Account"
              value={filters.accountCode}
              onChange={(event) => setFilters((prev) => ({ ...prev, accountCode: event.target.value }))}
              sx={{ minWidth: 280 }}
            >
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.accountCode}>
                  {account.accountCode} - {account.accountName}
                </MenuItem>
              ))}
            </TextField>

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
            <Button variant="contained" onClick={() => void load()} disabled={loading || !filters.accountCode}>
              Run Report
            </Button>
          </Stack>
        </Paper>

        {loading ? (
          <Paper>
            <LogoLoader label="Loading ledger entries" inline minHeight={260} />
          </Paper>
        ) : (
          <Paper>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Journal #</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Debit
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Credit
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Running Balance
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(report?.entries || []).map((entry, index) => (
                  <TableRow key={`${entry.journalNumber}-${index}`} hover>
                    <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                    <TableCell className="mono">{entry.journalNumber}</TableCell>
                    <TableCell>{entry.reference || '—'}</TableCell>
                    <TableCell>{entry.description || '—'}</TableCell>
                    <TableCell align="right" className="mono">
                      {fmtNGN(entry.debit)}
                    </TableCell>
                    <TableCell align="right" className="mono">
                      {fmtNGN(entry.credit)}
                    </TableCell>
                    <TableCell align="right" className="mono">
                      {fmtNGN(entry.runningBalance)}
                    </TableCell>
                  </TableRow>
                ))}

                {(!report || report.entries.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                        No ledger entries for selected range.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}

                {report && report.entries.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ fontWeight: 700 }}>
                      Totals
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }} className="mono">
                      {fmtNGN(report.totals.debit)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }} className="mono">
                      {fmtNGN(report.totals.credit)}
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

export default GeneralLedgerPage;