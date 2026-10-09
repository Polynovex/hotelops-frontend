import HrTabs from './HrTabs';
import Layout from '../../../components/Layout';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import {
  hrService,
  type ApprovalStatus,
  type AttendanceRecord,
  type WorkPeriod
} from '../../../services/hr.service';
import { useAuthStore } from '../../../store/authStore';
import { useClockAction } from '../../../components/hr/useClockAction';

/**
 * Attendance with HR approval.
 *
 * Every clock-in, clock-out and overtime entry waits for HR sign-off, and
 * payroll pays only approved time. Three views:
 *
 *  - Approvals: everything awaiting a decision, oldest first, regardless of
 *    date — nothing ages out of the queue.
 *  - Records: the log for a date range, with corrections.
 *  - Work period: shift start/end, grace minutes and the standard day that
 *    lateness and overtime are measured against.
 */

const STATUS_COLOR: Record<AttendanceRecord['status'], 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'error',
  HALF_DAY: 'info',
  HOLIDAY: 'default'
};

const APPROVAL_COLOR: Record<ApprovalStatus, 'warning' | 'success' | 'error'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error'
};

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

/** `datetime-local` wants local time without a zone. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

type ReviewTarget = { record: AttendanceRecord; decision: 'APPROVE' | 'REJECT' };

const AttendancePage = () => {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const can = (code: string) => permissions.includes('*') || permissions.includes(code);
  const canApprove = can('APPROVE_ATTENDANCE');
  const canEdit = can('EDIT_ATTENDANCE');

  const [tab, setTab] = useState<'approvals' | 'records' | 'period'>(canApprove ? 'approvals' : 'records');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [pending, setPending] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [range, setRange] = useState({
    from: isoDay(new Date(Date.now() - 6 * 86_400_000)),
    to: isoDay(new Date())
  });

  const [review, setReview] = useState<ReviewTarget | null>(null);
  const [reviewScope, setReviewScope] = useState<'ALL' | 'ATTENDANCE' | 'OVERTIME'>('ALL');
  const [reviewNote, setReviewNote] = useState('');
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({ clockIn: '', clockOut: '', lateReason: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const [period, setPeriod] = useState<WorkPeriod | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, queue] = await Promise.all([
        hrService.listAttendance({ from: range.from, to: range.to }),
        canApprove ? hrService.listAttendance({ pending: true }) : Promise.resolve([])
      ]);
      setRecords(rows);
      setPending([...queue].sort((a, b) => a.date.localeCompare(b.date)));
      setError('');
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string; message?: string } } }).response;
      setError(
        response?.data?.error === 'FEATURE_DISABLED'
          ? 'The HR module is not included in your current plan.'
          : response?.data?.message || 'Failed to load attendance'
      );
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, canApprove]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    hrService.getWorkPeriod().then(setPeriod).catch(() => undefined);
  }, []);

  const { clock, busy: clocking, dialog: clockDialog } = useClockAction({
    onDone: async (message) => {
      setToast(message);
      await load();
    },
    onError: setError
  });

  const openReview = (record: AttendanceRecord, decision: 'APPROVE' | 'REJECT') => {
    setReview({ record, decision });
    setReviewScope('ALL');
    setReviewNote('');
  };

  const submitReview = async () => {
    if (!review) return;
    if (review.decision === 'REJECT' && !reviewNote.trim()) {
      setError('Add a note explaining the rejection.');
      return;
    }
    setSaving(true);
    try {
      await hrService.reviewAttendance(review.record.id, {
        decision: review.decision,
        scope: reviewScope,
        note: reviewNote.trim() || undefined
      });
      setToast(review.decision === 'APPROVE' ? 'Approved' : 'Rejected');
      setReview(null);
      await load();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setError(data?.error || 'Could not save the decision');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (record: AttendanceRecord) => {
    setEditing(record);
    setEditForm({
      clockIn: toLocalInput(record.clockIn),
      clockOut: toLocalInput(record.clockOut),
      lateReason: record.lateReason ?? '',
      notes: record.notes ?? ''
    });
  };

  const submitEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await hrService.updateAttendance(editing.id, {
        clockIn: editForm.clockIn ? new Date(editForm.clockIn).toISOString() : null,
        clockOut: editForm.clockOut ? new Date(editForm.clockOut).toISOString() : null,
        lateReason: editForm.lateReason,
        notes: editForm.notes
      });
      setToast('Attendance corrected and approved');
      setEditing(null);
      await load();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setError(data?.error || 'Could not save the correction');
    } finally {
      setSaving(false);
    }
  };

  const savePeriod = async () => {
    if (!period) return;
    setSaving(true);
    try {
      setPeriod(await hrService.updateWorkPeriod(period));
      setToast('Work period saved');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setError(data?.error || 'Could not save the work period');
    } finally {
      setSaving(false);
    }
  };

  const rows = tab === 'approvals' ? pending : records;
  const emptyText = useMemo(
    () => (tab === 'approvals' ? 'Nothing is waiting for approval.' : 'Nothing logged for the selected dates.'),
    [tab]
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <HrTabs />
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Attendance
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Clock-ins, clock-outs and overtime need HR approval. Payroll pays approved time only.
            {period && ` Work period ${period.startTime}–${period.endTime}, ${period.graceMinutes} min grace.`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" startIcon={<LoginIcon />} onClick={() => void clock('in')} disabled={clocking}>
            Clock In
          </Button>
          <Button variant="outlined" startIcon={<LogoutIcon />} onClick={() => void clock('out')} disabled={clocking}>
            Clock Out
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_event, value) => setTab(value)} sx={{ mb: 2 }} variant="scrollable" allowScrollButtonsMobile>
        {canApprove && (
          <Tab
            value="approvals"
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>Approvals</span>
                {pending.length > 0 && <Chip size="small" color="warning" label={pending.length} />}
              </Stack>
            }
          />
        )}
        <Tab value="records" label="Records" />
        {canEdit && <Tab value="period" label="Work period" />}
      </Tabs>

      {tab === 'period' && period && (
        <Paper variant="outlined" sx={{ p: 3, maxWidth: 560, borderRadius: 2 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Shift start"
                type="time"
                value={period.startTime}
                onChange={(event) => setPeriod({ ...period, startTime: event.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Shift end"
                type="time"
                value={period.endTime}
                onChange={(event) => setPeriod({ ...period, endTime: event.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Grace period (minutes)"
                type="number"
                value={period.graceMinutes}
                onChange={(event) => setPeriod({ ...period, graceMinutes: Number(event.target.value) })}
                inputProps={{ min: 0, max: 240 }}
                helperText="Clock-ins within this window are not late"
                fullWidth
              />
              <TextField
                label="Standard day (hours)"
                type="number"
                value={period.standardHours}
                onChange={(event) => setPeriod({ ...period, standardHours: Number(event.target.value) })}
                inputProps={{ min: 1, max: 24, step: 0.5 }}
                helperText="Hours beyond this are overtime"
                fullWidth
              />
            </Stack>
            {period.timeZone && (
              <Typography variant="caption" color="text.secondary">
                Times are in the hotel's timezone ({period.timeZone}).
              </Typography>
            )}
            <Box>
              <Button variant="contained" onClick={() => void savePeriod()} disabled={saving}>
                Save work period
              </Button>
            </Box>
          </Stack>
        </Paper>
      )}

      {tab === 'records' && (
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            label="From"
            type="date"
            size="small"
            value={range.from}
            onChange={(event) => setRange((r) => ({ ...r, from: event.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={range.to}
            onChange={(event) => setRange((r) => ({ ...r, to: event.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      )}

      {tab !== 'period' && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Employee</TableCell>
                <TableCell>In</TableCell>
                <TableCell>Out</TableCell>
                <TableCell align="right">Hours</TableCell>
                <TableCell align="right">Overtime</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Late reason</TableCell>
                <TableCell>Approval</TableCell>
                {(canApprove || canEdit) && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              )}

              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 8 }}>
                    <EventAvailableIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="subtitle1" fontWeight={600}>
                      No attendance records
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {emptyText}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                rows.map((record) => (
                  <TableRow key={record.id} hover>
                    <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {record.staff ? `${record.staff.firstName} ${record.staff.lastName}` : '—'}
                      </Typography>
                      {record.editedAt && (
                        <Typography variant="caption" color="text.secondary">
                          Corrected by HR
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{time(record.clockIn)}</TableCell>
                    <TableCell>{time(record.clockOut)}</TableCell>
                    <TableCell align="right">{record.totalHours.toFixed(2)}</TableCell>
                    <TableCell align="right">
                      {record.overtimeHours > 0 ? (
                        <Tooltip title={record.overtimeReason || 'No reason given'}>
                          <Stack alignItems="flex-end">
                            <Typography variant="body2" fontWeight={600} color="warning.main">
                              {record.overtimeHours.toFixed(2)}
                            </Typography>
                            {record.overtimeStatus && record.overtimeStatus !== 'NONE' && (
                              <Typography variant="caption" color={`${APPROVAL_COLOR[record.overtimeStatus]}.main`}>
                                {record.overtimeStatus.toLowerCase()}
                              </Typography>
                            )}
                          </Stack>
                        </Tooltip>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={
                          record.status === 'LATE' && record.lateMinutes
                            ? `Late ${record.lateMinutes}m`
                            : record.status.replace('_', ' ')
                        }
                        color={STATUS_COLOR[record.status]}
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Typography variant="body2" noWrap title={record.lateReason ?? undefined}>
                        {record.lateReason || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {record.approvalStatus && (
                        <Tooltip title={record.reviewNote || ''}>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={record.approvalStatus.toLowerCase()}
                            color={APPROVAL_COLOR[record.approvalStatus]}
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                    {(canApprove || canEdit) && (
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {canApprove && (
                          <>
                            <Button size="small" color="success" startIcon={<CheckRoundedIcon />} onClick={() => openReview(record, 'APPROVE')}>
                              Approve
                            </Button>
                            <Button size="small" color="error" startIcon={<CloseRoundedIcon />} onClick={() => openReview(record, 'REJECT')}>
                              Reject
                            </Button>
                          </>
                        )}
                        {canEdit && (
                          <Button size="small" startIcon={<EditRoundedIcon />} onClick={() => openEdit(record)}>
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Approve / reject */}
      <Dialog open={Boolean(review)} onClose={() => !saving && setReview(null)} fullWidth maxWidth="xs">
        <DialogTitle>{review?.decision === 'APPROVE' ? 'Approve attendance' : 'Reject attendance'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">
              {review?.record.staff ? `${review.record.staff.firstName} ${review.record.staff.lastName}` : ''} —{' '}
              {review && new Date(review.record.date).toLocaleDateString()}, {time(review?.record.clockIn ?? null)}–
              {time(review?.record.clockOut ?? null)}
            </Typography>
            {review?.record.lateReason && (
              <Alert severity="warning">Late reason: {review.record.lateReason}</Alert>
            )}
            {review && review.record.overtimeHours > 0 && (
              <TextField
                select
                label="Apply to"
                value={reviewScope}
                onChange={(event) => setReviewScope(event.target.value as typeof reviewScope)}
              >
                <MenuItem value="ALL">Attendance and overtime</MenuItem>
                <MenuItem value="ATTENDANCE">Attendance only</MenuItem>
                <MenuItem value="OVERTIME">Overtime only ({review.record.overtimeHours.toFixed(2)}h)</MenuItem>
              </TextField>
            )}
            <TextField
              label={review?.decision === 'REJECT' ? 'Reason (required)' : 'Note (optional)'}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              multiline
              minRows={2}
              required={review?.decision === 'REJECT'}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReview(null)} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            color={review?.decision === 'APPROVE' ? 'success' : 'error'}
            onClick={() => void submitReview()}
            disabled={saving}
          >
            {review?.decision === 'APPROVE' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Correct times */}
      <Dialog open={Boolean(editing)} onClose={() => !saving && setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Correct attendance</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Clock in"
                type="datetime-local"
                value={editForm.clockIn}
                onChange={(event) => setEditForm((form) => ({ ...form, clockIn: event.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Clock out"
                type="datetime-local"
                value={editForm.clockOut}
                onChange={(event) => setEditForm((form) => ({ ...form, clockOut: event.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
            <TextField
              label="Late reason"
              value={editForm.lateReason}
              onChange={(event) => setEditForm((form) => ({ ...form, lateReason: event.target.value }))}
            />
            <TextField
              label="HR notes"
              value={editForm.notes}
              onChange={(event) => setEditForm((form) => ({ ...form, notes: event.target.value }))}
              multiline
              minRows={2}
            />
            <Typography variant="caption" color="text.secondary">
              Hours and overtime are recalculated. Saving approves the day; changed overtime goes back to pending.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={() => void submitEdit()} disabled={saving}>
            Save correction
          </Button>
        </DialogActions>
      </Dialog>

      {clockDialog}

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
const AttendancePageWithLayout = () => (
  <Layout>
    <AttendancePage />
  </Layout>
);

export default AttendancePageWithLayout;
