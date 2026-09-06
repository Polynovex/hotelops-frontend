import Layout from '../../../components/Layout';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Skeleton,
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
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import AddIcon from '@mui/icons-material/Add';
import BadgeIcon from '@mui/icons-material/Badge';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import {
  formatNaira,
  hrService,
  LEAVE_STATUS_COLOR,
  myHrService,
  PAYROLL_STATUS_COLOR,
  type LeaveType,
  type MyAttendance,
  type MyLeave,
  type MyStaffProfile,
  type PayrollRecord
} from '../../../services/hr.service';
import { EmptyState, MetricCard, PageHeader, SectionHeader } from '../../../components/premium';

const LEAVE_TYPES: LeaveType[] = ['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'OTHER'];

/**
 * Employee self-service portal.
 *
 * Every request here resolves the caller's own staff record server-side, so a
 * member of staff sees only their own attendance, leave, and payslips — no
 * staffId is ever sent from the client.
 */
const MyHrPortal = () => {
  const [profile, setProfile] = useState<MyStaffProfile | null>(null);
  const [attendance, setAttendance] = useState<MyAttendance | null>(null);
  const [leave, setLeave] = useState<MyLeave | null>(null);
  const [payslips, setPayslips] = useState<PayrollRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notLinked, setNotLinked] = useState(false);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [form, setForm] = useState({ type: 'ANNUAL' as LeaveType, startDate: '', endDate: '', reason: '' });

  const load = useCallback(async () => {
    setLoading(true);

    /**
     * All four requests at once, not the profile and then the rest.
     *
     * Awaiting the profile first made the page as slow as the sum of two
     * round trips rather than the slowest one — noticeable against a remote
     * database, and this is the only screen some staff accounts have. None of
     * the other three needs anything from the profile, so nothing is gained by
     * making them wait for it.
     *
     * allSettled rather than all: one slow or failing section should not blank
     * the whole page, since each renders independently below.
     *
     * The cost is that an account with no staff record now makes three requests
     * that will 404 rather than short-circuiting after the profile. That is the
     * right way round: accounts that do have a record are the ones this page
     * exists for, and for them it is the difference between two round trips and
     * one. The unlinked case is handled below and the extra calls are cheap.
     */
    const [meResult, attResult, leaveResult, slipResult] = await Promise.allSettled([
      myHrService.getProfile(),
      myHrService.getAttendance(),
      myHrService.getLeave(),
      myHrService.getPayslips()
    ]);

    if (meResult.status === 'fulfilled') {
      setProfile(meResult.value);
      setNotLinked(false);
      setError('');
    } else {
      const response = (
        meResult.reason as { response?: { data?: { error?: string; message?: string } } }
      ).response;
      if (response?.data?.error === 'NO_STAFF_RECORD') {
        // Common and expected: the account exists but HR has not linked a
        // staff record to it yet. Explain rather than showing a bare error.
        setNotLinked(true);
      } else if (response?.data?.error === 'FEATURE_DISABLED') {
        setError('The HR module is not included in your current plan.');
      } else {
        setError(response?.data?.message || 'Could not load your HR information');
      }
    }

    if (attResult.status === 'fulfilled') setAttendance(attResult.value);
    if (leaveResult.status === 'fulfilled') setLeave(leaveResult.value);
    if (slipResult.status === 'fulfilled') setPayslips(slipResult.value);

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** GPS is offered but never required — a denied prompt must not block a punch. */
  const getPosition = () =>
    new Promise<{ lat?: number; lng?: number; method: string }>((resolve) => {
      if (!navigator.geolocation) {
        resolve({ method: 'MANUAL' });
        return;
      }
      const timer = setTimeout(() => resolve({ method: 'MANUAL' }), 5000);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timer);
          resolve({ lat: position.coords.latitude, lng: position.coords.longitude, method: 'GPS' });
        },
        () => {
          clearTimeout(timer);
          resolve({ method: 'MANUAL' });
        },
        { timeout: 5000 }
      );
    });

  const clock = async (direction: 'in' | 'out') => {
    setBusy(true);
    try {
      const position = await getPosition();
      const payload = { method: position.method, lat: position.lat, lng: position.lng };

      if (direction === 'in') {
        await hrService.clockIn(payload);
        setToast('Clocked in');
      } else {
        await hrService.clockOut(payload);
        setToast('Clocked out');
      }
      await load();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      setError(response?.data?.error || `Could not clock ${direction}`);
    } finally {
      setBusy(false);
    }
  };

  const submitLeave = async () => {
    if (!form.startDate || !form.endDate) {
      setError('Please choose both dates');
      return;
    }

    setBusy(true);
    try {
      await myHrService.requestLeave({
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim() || undefined
      });
      setToast('Leave request submitted for approval');
      setLeaveOpen(false);
      setForm({ type: 'ANNUAL', startDate: '', endDate: '', reason: '' });
      await load();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string; issues?: Array<{ message: string }> } } }).response;
      setError(response?.data?.issues?.[0]?.message || response?.data?.error || 'Could not submit request');
    } finally {
      setBusy(false);
    }
  };

  const cancelLeave = async (id: string) => {
    try {
      await myHrService.cancelLeave(id);
      setToast('Request withdrawn');
      await load();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      setError(response?.data?.error || 'Could not withdraw the request');
    }
  };

  if (loading) {
    /**
     * The page's own shape, not a spinner in the middle of an empty screen.
     *
     * These requests take a few seconds against a remote database, and a bare
     * spinner gives no sense of what is arriving or how much of it — on the
     * one screen a support-staff account has, that reads as broken.
     */
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Skeleton variant="text" width={260} height={44} />
        <Skeleton variant="text" width={180} height={24} sx={{ mb: 3 }} />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
            gap: 2,
            mb: 3
          }}
        >
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} variant="rounded" height={132} sx={{ borderRadius: 3 }} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={280} sx={{ borderRadius: 3 }} />
      </Container>
    );
  }

  if (notLinked) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <BadgeIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" fontWeight={700} gutterBottom>
            No staff record linked
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your login is not yet connected to an employee record, so there is nothing
            to show here. Ask HR to link your account and this page will fill in.
          </Typography>
        </Paper>
      </Container>
    );
  }

  const today = attendance?.today;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader
        title={`Hello, ${profile?.firstName ?? ''}`}
        subtitle={[profile?.jobTitle, profile?.department?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
        actions={
          <>
            <Button
              variant="contained"
              startIcon={<LoginIcon />}
              onClick={() => void clock('in')}
              disabled={busy || today?.clockedIn}
            >
              {today?.clockedIn ? 'Clocked in' : 'Clock In'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<LogoutIcon />}
              onClick={() => void clock('out')}
              disabled={busy || !today?.clockedIn || today?.clockedOut}
            >
              {today?.clockedOut ? 'Clocked out' : 'Clock Out'}
            </Button>
          </>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            label="Today"
            value={today?.clockedIn ? new Date(today.clockIn!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            detail={today?.clockedOut ? 'Shift complete' : today?.clockedIn ? 'Currently clocked in' : 'Not clocked in'}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard label="Hours (30 days)" value={attendance?.totals.hours ?? 0} detail={`${attendance?.totals.days ?? 0} days recorded`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard label="Overtime" value={attendance?.totals.overtime ?? 0} detail="Hours beyond standard day" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            label="Leave remaining"
            value={leave?.balance.remaining ?? 0}
            detail={`of ${leave?.balance.entitled ?? 0} days`}
            variant="navy"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <SectionHeader
              title="My leave"
              count={leave?.requests.length ?? 0}
              action={
                <Button size="small" startIcon={<AddIcon />} onClick={() => setLeaveOpen(true)}>
                  Request leave
                </Button>
              }
            />
            {(leave?.requests.length ?? 0) === 0 ? (
              <EmptyState title="No leave requests" description="Your requests and their status will appear here." />
            ) : (
              <Stack spacing={1}>
                {leave!.requests.map((request) => (
                  <Stack
                    key={request.id}
                    direction="row"
                    alignItems="center"
                    spacing={1.5}
                    sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {request.type} · {request.totalDays} day{request.totalDays === 1 ? '' : 's'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(request.startDate).toLocaleDateString()} –{' '}
                        {new Date(request.endDate).toLocaleDateString()}
                      </Typography>
                    </Box>
                    <Chip size="small" label={request.status} color={LEAVE_STATUS_COLOR[request.status]} />
                    {request.status === 'PENDING' && (
                      <Button size="small" color="inherit" onClick={() => void cancelLeave(request.id)}>
                        Withdraw
                      </Button>
                    )}
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <SectionHeader title="My payslips" count={payslips.length} />
            {payslips.length === 0 ? (
              <EmptyState
                icon={<ReceiptLongIcon />}
                title="No payslips yet"
                description="Payslips appear once payroll has been processed."
              />
            ) : (
              <Stack spacing={1}>
                {payslips.slice(0, 8).map((slip) => (
                  <Stack
                    key={slip.id}
                    direction="row"
                    alignItems="center"
                    spacing={1.5}
                    sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {new Date(slip.periodStart).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Net {formatNaira(slip.netPay)}
                      </Typography>
                    </Box>
                    <Chip size="small" label={slip.status} color={PAYROLL_STATUS_COLOR[slip.status]} />
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <SectionHeader title="Recent attendance" count={attendance?.records.length ?? 0} />
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>In</TableCell>
                <TableCell>Out</TableCell>
                <TableCell align="right">Hours</TableCell>
                <TableCell align="right">Overtime</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(attendance?.records.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState title="No attendance yet" description="Clock in to start recording your hours." />
                  </TableCell>
                </TableRow>
              )}
              {attendance?.records.slice(0, 20).map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                  <TableCell>{row.clockIn ? new Date(row.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                  <TableCell>{row.clockOut ? new Date(row.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                  <TableCell align="right">{row.totalHours.toFixed(2)}</TableCell>
                  <TableCell align="right">{row.overtimeHours > 0 ? row.overtimeHours.toFixed(2) : '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={row.status.replace('_', ' ')} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Request leave</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You have <strong>{leave?.balance.remaining ?? 0} days</strong> remaining. Your manager
            will review this request.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2.5}>
            <TextField
              select
              label="Leave type"
              value={form.type}
              onChange={(event) => setForm((f) => ({ ...f, type: event.target.value as LeaveType }))}
              fullWidth
            >
              {LEAVE_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                label="From"
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((f) => ({ ...f, startDate: event.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="To"
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((f) => ({ ...f, endDate: event.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <TextField
              label="Reason (optional)"
              value={form.reason}
              onChange={(event) => setForm((f) => ({ ...f, reason: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLeaveOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void submitLeave()} disabled={busy}>
            {busy ? 'Submitting…' : 'Submit request'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3000}
        onClose={() => setToast('')}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
};

const MyHrPortalWithLayout = () => (
  <Layout>
    <MyHrPortal />
  </Layout>
);

export default MyHrPortalWithLayout;
