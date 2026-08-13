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
import AddIcon from '@mui/icons-material/Add';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import {
  hrService,
  LEAVE_STATUS_COLOR,
  type LeaveRequestRecord,
  type LeaveStatus,
  type LeaveType,
  type StaffMember
} from '../../../services/hr.service';

const LEAVE_TYPES: LeaveType[] = ['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'OTHER'];

const LeavePage = () => {
  const [requests, setRequests] = useState<LeaveRequestRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | ''>('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    staffId: '',
    type: 'ANNUAL' as LeaveType,
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leave, staffList] = await Promise.all([
        hrService.listLeave(statusFilter ? { status: statusFilter } : undefined),
        hrService.listStaff({ status: 'ACTIVE' })
      ]);
      setRequests(leave);
      setStaff(staffList);
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

  const handleSubmit = async () => {
    if (!form.staffId || !form.startDate || !form.endDate) {
      setError('Staff member and both dates are required');
      return;
    }

    setSaving(true);
    try {
      await hrService.requestLeave({
        staffId: form.staffId,
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim() || undefined
      });
      setToast('Leave request submitted');
      setDialogOpen(false);
      setForm({ staffId: '', type: 'ANNUAL', startDate: '', endDate: '', reason: '' });
      await load();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string; issues?: Array<{ message: string }> } } }).response;
      setError(response?.data?.issues?.[0]?.message || response?.data?.error || 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

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
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          New Request
        </Button>
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
                          onClick={() => void review(request, true)}
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New leave request</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              select
              label="Employee"
              value={form.staffId}
              onChange={(event) => setForm((f) => ({ ...f, staffId: event.target.value }))}
              fullWidth
              required
            >
              {staff.length === 0 && (
                <MenuItem disabled value="">
                  No active staff
                </MenuItem>
              )}
              {staff.map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </MenuItem>
              ))}
            </TextField>

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
                label="Start date"
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((f) => ({ ...f, startDate: event.target.value }))}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="End date"
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((f) => ({ ...f, endDate: event.target.value }))}
                fullWidth
                required
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
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Submitting…' : 'Submit'}
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
