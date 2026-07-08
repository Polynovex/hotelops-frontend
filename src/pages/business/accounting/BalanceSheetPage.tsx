import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import ReportDownloadButton from '../../../components/ReportDownloadButton';
import { accountingService, BalanceSheetReport } from '../../../services/api';

const fmtNGN = (v: number | string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(v || 0));

const Section = ({
  title,
  rows,
  total
}: {
  title: string;
  rows: Array<{ code: string; name: string; balance: number }>;
  total: number;
}) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
      {title}
    </Typography>
    <Stack spacing={1}>
      {rows.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
          No {title.toLowerCase()} recorded.
        </Typography>
      ) : (
        rows.map((row) => (
          <Box key={row.code} sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography>
              <span className="mono">{row.code}</span> — {row.name}
            </Typography>
            <Typography className="mono">{fmtNGN(row.balance)}</Typography>
          </Box>
        ))
      )}
      <Divider />
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography sx={{ fontWeight: 700 }}>Total {title}</Typography>
        <Typography sx={{ fontWeight: 700 }} className="mono">
          {fmtNGN(total)}
        </Typography>
      </Box>
    </Stack>
  </Box>
);

const BalanceSheetPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState<BalanceSheetReport | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setReport(await accountingService.getBalanceSheetReport());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load balance sheet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const downloadRows = report
    ? [
        ...report.assets.map((r) => ({ ...r, section: 'Asset' })),
        ...report.liabilities.map((r) => ({ ...r, section: 'Liability' })),
        ...report.equity.map((r) => ({ ...r, section: 'Equity' }))
      ]
    : [];

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              Balance Sheet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Snapshot of assets, liabilities, and equity as of report date.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
            <ReportDownloadButton
              title="Balance Sheet"
              subtitle={`As of ${report?.asOfDate ? new Date(report.asOfDate).toLocaleDateString() : '—'}`}
              columns={[
                { key: 'section', label: 'Section' },
                { key: 'code', label: 'Code' },
                { key: 'name', label: 'Name' },
                { key: 'balance', label: 'Balance', format: (v) => fmtNGN(v), align: 'right' }
              ]}
              rows={downloadRows}
              totals={
                report
                  ? [
                      { label: 'Total Assets', value: report.totals.totalAssets, format: (v) => fmtNGN(v) },
                      { label: 'Total Liabilities', value: report.totals.totalLiabilities, format: (v) => fmtNGN(v) },
                      { label: 'Total Equity', value: report.totals.totalEquity, format: (v) => fmtNGN(v) },
                      {
                        label: 'Liabilities + Equity',
                        value: report.totals.liabilitiesAndEquity,
                        format: (v) => fmtNGN(v)
                      }
                    ]
                  : []
              }
              disabled={loading}
            />
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Paper>
            <LogoLoader label="Loading balance sheet" inline minHeight={260} />
          </Paper>
        ) : (
          <Paper sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              As of: {report?.asOfDate ? new Date(report.asOfDate).toLocaleString() : '—'}
            </Typography>

            <Section title="Assets" rows={report?.assets || []} total={Number(report?.totals.totalAssets || 0)} />
            <Section
              title="Liabilities"
              rows={report?.liabilities || []}
              total={Number(report?.totals.totalLiabilities || 0)}
            />
            <Section title="Equity" rows={report?.equity || []} total={Number(report?.totals.totalEquity || 0)} />

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 700 }}>Total Liabilities + Equity</Typography>
              <Typography sx={{ fontWeight: 700 }} className="mono">
                {fmtNGN(report?.totals.liabilitiesAndEquity || 0)}
              </Typography>
            </Box>
          </Paper>
        )}
      </Container>
    </Layout>
  );
};

export default BalanceSheetPage;