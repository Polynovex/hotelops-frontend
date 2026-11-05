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
  MenuItem,
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
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import { useAuthStore } from '../../../store/authStore';
import { getApiErrorMessage } from '../../../utils/apiError';
import {
  hrService,
  LEAVE_STATUS_COLOR,
  type LeaveRequestRecord,
  type LeaveStatus
} from '../../../services/hr.service';

const LeavePage = () => {
  const [requests, setRequests] = useState<LeaveRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | ''>('');
  const isOwner = useAuthStore((state) => state.user?.role) === 'BUSINESS_ADMIN';
  const [approving, setApproving] = useState<LeaveRequestRecord | null>(null);
  const [form, setForm] = useState({ startDate: '', endDate: '', notes: '', overrideReason: '' });
  const [overBalance, setOverBalance] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState('');
  const ymd = (iso: string) => iso.slice(0, 10);
  const daysBetween = (a: string, b: string) => (a && b ? Math.floor((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1 : 0);
  const openApprove = (request: LeaveRequestRecord) => {
    setForm({ startDate: ymd(request.startDate), endDate: ymd(request.endDate), notes: '', overrideReason: '' });
    setOverBalance(null);
    setDialogError('');
    setApproving(request);
  };
  const confirmApprove = async () => {
    if (!approving) return;
    setBusyId(approving.id);
    setDialogError('');
    try {
      await hrService.approveLeave(approving.id, {
        startDate: form.startDate,
        endDate: form.endDate,
        notes: form.notes.trim() || undefined,
        ...(overBalance && form.overrideReason.trim() ? { balanceOverrideReason: form.overrideReason.trim() } : {})
      });
      setApproving(null);
      setToast('Leave approved; the staff member has been told');
      await load();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; message?: string } } }).response?.data;
      if (data?.error === 'OVER_BALANCE') setOverBalance(data.message ?? 'Over the leave balance');
      else setDialogError(getApiErrorMessage(err, 'Could not approve the leave'));
    } finally {
      setBusyId(null);
    }
  };

  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Only the requests are needed now: the staff list existed to populate
      // the create form's picker, which has moved to the staff portal.
      const leave = await hrService.listLeave(
        statusFilter ? { status: statusFilter } : undefined
      );
      setRequests(leave);
      setError('');
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string; message?: string } } }).response;
      setError(
        response?.data?.error === 'FEATURE_DISABLED'
          ? 'The HR module is not included in your current plan.'
          : response?.data?.message || 'Failed to load leave requests'
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (request: LeaveRequestRecord, approve: boolean) => {
    setBusyId(request.id);
    try {
      if (approve) {
        await hrService.approveLeave(request.id);
        setToast('Leave approved');
      } else {
        await hrService.rejectLeave(request.id);
        setToast('Leave rejected');
      }
      await load();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      setError(response?.data?.error || 'Failed to update leave request');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <HrTabs />
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Leave
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Requests, approvals, and balances.
          </Typography>
        </Box>
        {/* Staff raise their own requests from My HR. Creating one on their
            behalf here made the requester and the approver the same person,
            and left no record on the staff member's own portal. */}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <TextField
        select
        size="small"
        label="Status"
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value as LeaveStatus | '')}
        sx={{ minWidth: 180, mb: 2 }}
      >
        <MenuItem value="">All</MenuItem>
        {(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((value) => (
          <MenuItem key={value} value={value}>
            {value}
          </MenuItem>
        ))}
      </TextField>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Dates</TableCell>
              <TableCell align="right">Days</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            )}

            {!loading && requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                  <BeachAccessIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    No leave requests
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Requests will appear here once staff submit them.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              requests.map((request) => (
                <TableRow key={request.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {request.staff ? `${request.staff.firstName} ${request.staff.lastName}` : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>{request.type}</TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(request.startDate).toLocaleDateString()} –{' '}
                      {new Date(request.endDate).toLocaleDateString()}
                    </Typography>
                    {request.requestedStartDate && (ymd(request.requestedStartDate) !== ymd(request.startDate) || ymd(request.requestedEndDate ?? '') !== ymd(request.endDate)) && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Asked for {new Date(request.requestedStartDate).toLocaleDateString()} – {new Date(request.requestedEndDate ?? request.requestedStartDate).toLocaleDateString()}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{request.totalDays}</TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {request.reason || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={request.status} color={LEAVE_STATUS_COLOR[request.status]} />
                  </TableCell>
                  <TableCell align="right">
                    {request.status === 'PENDING' && (
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          disabled={busyId === request.id}
                          onClick={() => openApprove(request)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          disabled={busyId === request.id}
                          onClick={() => void review(request, false)}
                        >
                          Reject
                        </Button>
                      </Stack>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>


      <Dialog open={Boolean(approving)} onClose={() => setApproving(null)} fullWidth maxWidth="xs">
        <DialogTitle>Approve leave</DialogTitle>
        <DialogContent>
          {approving && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {approving.staff ? `${approving.staff.firstName} ${approving.staff.lastName}` : 'Staff member'} asked for{' '}
                {new Date(approving.requestedStartDate ?? approving.startDate).toLocaleDateString()} – {new Date(approving.requestedEndDate ?? approving.endDate).toLocaleDateString()}. Change the dates if you are approving part of it or moving it.
              </Typography>
              {dialogError && <Alert severity="error">{dialogError}</Alert>}
              <Stack direction="row" spacing={1.5}>
                <TextField type="date" label="Start" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
                <TextField type="date" label="End" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
              </Stack>
              <Typography variant="body2">{daysBetween(form.startDate, form.endDate)} day{daysBetween(form.startDate, form.endDate) === 1 ? '' : 's'}</Typography>
              <TextField label="Note to the staff member (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} fullWidth multiline minRows={2} />
              {overBalance && (
                <Alert severity="warning">
                  {overBalance}
                  {isOwner && (
                    <TextField sx={{ mt: 1.5, bgcolor: 'background.paper' }} size="small" fullWidth label="Reason for approving over the balance *" value={form.overrideReason} onChange={(e) => setForm({ ...form, overrideReason: e.target.value })} />
                  )}
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproving(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            disabled={Boolean(busyId) || !form.startDate || !form.endDate || form.endDate < form.startDate || (Boolean(overBalance) && (!isOwner || form.overrideReason.trim().length < 5))}
            onClick={() => void confirmApprove()}
          >
            Approve
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

/**
 * Wrapped in Layout so this page carries the same sidebar, header, and
 * page chrome as the rest of the dashboard. Wrapping at the export keeps
 * the loading and error early-returns inside the shell too.
 */
const LeavePageWithLayout = () => (
  <Layout>
    <LeavePage />
  </Layout>
);

export default LeavePageWithLayout;
