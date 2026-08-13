import HrTabs from './HrTabs';
import Layout from '../../../components/Layout';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PrintIcon from '@mui/icons-material/Print';
import PaymentsIcon from '@mui/icons-material/Payments';
import {
  formatNaira,
  hrService,
  PAYROLL_STATUS_COLOR,
  type PayrollRecord,
  type Payslip
} from '../../../services/hr.service';

/** First and last day of the current month, as yyyy-mm-dd. */
const currentPeriod = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
};

const PayrollPage = () => {
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [totals, setTotals] = useState({ gross: 0, net: 0, tax: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [genOpen, setGenOpen] = useState(false);
  const [period, setPeriod] = useState(currentPeriod());
  const [generating, setGenerating] = useState(false);

  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await hrService.listPayrolls();
      setPayrolls(result.payrolls);
      setTotals(result.totals);
      setError('');
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string; message?: string } } }).response;
      setError(
        response?.data?.error === 'FEATURE_DISABLED'
          ? 'The HR module is not included in your current plan.'
          : response?.data?.message || 'Failed to load payroll'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await hrService.generatePayroll({
        periodStart: period.start,
        periodEnd: period.end
      });

      setToast(
        result.skipped.length > 0
          ? `${result.created} payroll run(s) created, ${result.skipped.length} skipped (already generated)`
          : `${result.created} payroll run(s) created`
      );
      setGenOpen(false);
      await load();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string; issues?: Array<{ message: string }> } } }).response;
      setError(response?.data?.issues?.[0]?.message || response?.data?.error || 'Failed to generate payroll');
    } finally {
      setGenerating(false);
    }
  };

  const advance = async (record: PayrollRecord) => {
    setBusyId(record.id);
    try {
      if (record.status === 'DRAFT') {
        await hrService.processPayroll(record.id);
        setToast('Payroll processed');
      } else if (record.status === 'PROCESSED') {
        await hrService.markPaid(record.id);
        setToast('Payroll marked paid');
      }
      await load();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      setError(response?.data?.error || 'Failed to update payroll');
    } finally {
      setBusyId(null);
    }
  };

  const openPayslip = async (record: PayrollRecord) => {
    try {
      setPayslip(await hrService.getPayslip(record.id));
    } catch {
      setError('Failed to load payslip');
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <HrTabs />
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Payroll
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generate, process, and pay staff salaries. PAYE is calculated automatically.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<PlayCircleIcon />} onClick={() => setGenOpen(true)}>
          Generate Payroll
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Total label="Gross" value={formatNaira(totals.gross)} />
        <Total label="PAYE tax" value={formatNaira(totals.tax)} />
        <Total label="Net payable" value={formatNaira(totals.net)} highlight />
      </Grid>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Period</TableCell>
              <TableCell align="right">Base</TableCell>
              <TableCell align="right">Overtime</TableCell>
              <TableCell align="right">Tax</TableCell>
              <TableCell align="right">Net pay</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            )}

            {!loading && payrolls.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                  <PaymentsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    No payroll runs yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Generate payroll for a period to see it here.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              payrolls.map((record) => (
                <TableRow key={record.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {record.staff ? `${record.staff.firstName} ${record.staff.lastName}` : '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {record.staff?.staffNumber || ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(record.periodStart).toLocaleDateString()} –{' '}
                      {new Date(record.periodEnd).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{formatNaira(record.basePay)}</TableCell>
                  <TableCell align="right">{formatNaira(record.overtimePay)}</TableCell>
                  <TableCell align="right">{formatNaira(record.tax)}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={700}>
                      {formatNaira(record.netPay)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={record.status} color={PAYROLL_STATUS_COLOR[record.status]} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" startIcon={<ReceiptLongIcon />} onClick={() => void openPayslip(record)}>
                        Payslip
                      </Button>
                      {record.status !== 'PAID' && (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={busyId === record.id}
                          onClick={() => void advance(record)}
                        >
                          {record.status === 'DRAFT' ? 'Process' : 'Mark paid'}
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={genOpen} onClose={() => setGenOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Generate payroll</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Creates a draft run for every active staff member. Hours worked are taken from attendance
            records in the period. Staff who already have a run for these dates are skipped.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Period start"
              type="date"
              value={period.start}
              onChange={(event) => setPeriod((p) => ({ ...p, start: event.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Period end"
              type="date"
              value={period.end}
              onChange={(event) => setPeriod((p) => ({ ...p, end: event.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setGenOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleGenerate()} disabled={generating}>
            {generating ? 'Generating…' : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payslip preview — print styles hide the surrounding chrome. */}
      <Dialog open={Boolean(payslip)} onClose={() => setPayslip(null)} fullWidth maxWidth="sm">
        <DialogTitle>Payslip</DialogTitle>
        <DialogContent>
          {payslip && (
            <Box id="payslip-print" sx={{ p: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {payslip.business.name}
                  </Typography>
                  {payslip.business.address && (
                    <Typography variant="caption" color="text.secondary">
                      {payslip.business.address}
                    </Typography>
                  )}
                </Box>
                {payslip.business.logoUrl && (
                  <Box
                    component="img"
                    src={payslip.business.logoUrl}
                    alt=""
                    sx={{ height: 44, maxWidth: 140, objectFit: 'contain' }}
                  />
                )}
              </Stack>

              <Divider sx={{ mb: 2 }} />

              <Row label="Payslip no." value={payslip.payslipNumber} />
              <Row label="Employee" value={payslip.employee.name} />
              {payslip.employee.jobTitle && <Row label="Job title" value={payslip.employee.jobTitle} />}
              <Row
                label="Period"
                value={`${new Date(payslip.period.start).toLocaleDateString()} – ${new Date(
                  payslip.period.end
                ).toLocaleDateString()}`}
              />
              {payslip.employee.taxId && <Row label="TIN" value={payslip.employee.taxId} />}

              <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 2.5, mb: 1 }}>
                Earnings
              </Typography>
              {payslip.earnings.map((item) => (
                <Row key={item.label} label={item.label} value={formatNaira(item.amount)} />
              ))}
              <Row label="Gross pay" value={formatNaira(payslip.grossPay)} bold />

              <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 2.5, mb: 1 }}>
                Deductions
              </Typography>
              {payslip.deductions.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  None
                </Typography>
              ) : (
                payslip.deductions.map((item) => (
                  <Row key={item.label} label={item.label} value={formatNaira(item.amount)} />
                ))
              )}
              <Row label="Total deductions" value={formatNaira(payslip.totalDeductions)} bold />

              <Divider sx={{ my: 2 }} />
              <Row label="NET PAY" value={formatNaira(payslip.netPay)} bold large />

              {payslip.employee.bankName && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  Paid to {payslip.employee.bankName} ····{payslip.employee.accountNumber?.slice(-4)}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPayslip(null)}>Close</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>
            Print
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast('')}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
};

const Total = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <Grid item xs={12} sm={4}>
    <Paper
      variant="outlined"
      sx={{ p: 2.5, borderRadius: 2, borderColor: highlight ? 'primary.main' : undefined }}
    >
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={700}>
        {value}
      </Typography>
    </Paper>
  </Grid>
);

const Row = ({
  label,
  value,
  bold,
  large
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
}) => (
  <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
    <Typography variant={large ? 'body1' : 'body2'} fontWeight={bold ? 700 : 400} color="text.secondary">
      {label}
    </Typography>
    <Typography variant={large ? 'h6' : 'body2'} fontWeight={bold ? 700 : 500}>
      {value}
    </Typography>
  </Stack>
);

/**
 * Wrapped in Layout so this page carries the same sidebar, header, and
 * page chrome as the rest of the dashboard. Wrapping at the export keeps
 * the loading and error early-returns inside the shell too.
 */
const PayrollPageWithLayout = () => (
  <Layout>
    <PayrollPage />
  </Layout>
);

export default PayrollPageWithLayout;
