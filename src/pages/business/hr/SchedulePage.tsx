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
  IconButton,
  MenuItem,
  Paper,
  FormControlLabel,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import GenerateRotaDialog from '../../../components/hr/GenerateRotaDialog';
import AttendanceCalendar from '../../../components/hr/AttendanceCalendar';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EventNoteIcon from '@mui/icons-material/EventNote';
import { hrService, type StaffMember } from '../../../services/hr.service';
import {
  SCHEDULE_STATUS_COLOR,
  scheduleService,
  type ShiftScheduleRecord
} from '../../../services/loyalty.service';
import { EmptyState, PageHeader } from '../../../components/premium';

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const startOfWeek = (date: Date) => {
  const result = new Date(date);
  // Monday-first week, matching how rotas are usually posted.
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
};

/** Weekly rota grid: one column per day, shifts grouped under each. */
const humaniseDept = (value?: string | null) =>
  value ? value.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ') : 'No department';
/** "FRONT_DESK:Morning" (from the generator) → "Morning"; anything else as typed. */
const shiftName = (position?: string | null) => (position && position.includes(':') ? position.split(':').slice(1).join(':') : position || '');

const SchedulePage = () => {
  const [view, setView] = useState<'rota' | 'calendar'>('rota');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [access, setAccess] = useState({ enabled: true, earlyMinutes: 15, afterMinutes: 120 });
  const [editing, setEditing] = useState<ShiftScheduleRecord | null>(null);
  const [editForm, setEditForm] = useState({ date: '', start: '', end: '', position: '' });
  const [cancelling, setCancelling] = useState<ShiftScheduleRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [schedules, setSchedules] = useState<ShiftScheduleRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ staffId: '', date: '', start: '09:00', end: '17:00', position: '' });
  const [saving, setSaving] = useState(false);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, index) => {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + index);
        return day;
      }),
    [weekStart]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const [rota, staffList] = await Promise.all([
        scheduleService.list({ from: isoDay(weekStart), to: isoDay(weekEnd) }),
        hrService.listStaff({ status: 'ACTIVE' })
      ]);
      setSchedules(rota);
      setStaff(staffList);
      setError('');
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string; message?: string } } }).response;
      setError(
        response?.data?.error === 'FEATURE_DISABLED'
          ? 'The HR module is not included in your current plan.'
          : response?.data?.message || 'Failed to load the rota'
      );
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, ShiftScheduleRecord[]>();
    for (const shift of schedules) {
      const key = isoDay(new Date(shift.date));
      map.set(key, [...(map.get(key) || []), shift]);
    }
    return map;
  }, [schedules]);

  const openCreate = (date: Date) => {
    setForm({ staffId: '', date: isoDay(date), start: '09:00', end: '17:00', position: '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.staffId || !form.date) {
      setError('Pick a staff member and a date');
      return;
    }

    setSaving(true);
    try {
      await scheduleService.create({
        staffId: form.staffId,
        startsAt: new Date(`${form.date}T${form.start}:00`).toISOString(),
        endsAt: new Date(`${form.date}T${form.end}:00`).toISOString(),
        position: form.position.trim() || undefined
      });
      setToast('Shift added');
      setDialogOpen(false);
      await load();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      // The backend rejects overlaps; surface that message directly.
      setError(response?.data?.error || 'Failed to add shift');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (shift: ShiftScheduleRecord) => {
    try {
      await scheduleService.remove(shift.id);
      setToast('Shift removed');
      await load();
    } catch {
      setError('Failed to remove shift');
    }
  };

  const hhmm = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const openEdit = (shift: ShiftScheduleRecord) => {
    setEditForm({ date: isoDay(new Date(shift.startsAt)), start: hhmm(shift.startsAt), end: hhmm(shift.endsAt), position: shift.position ?? '' });
    setEditing(shift);
  };
  const saveEdit = async () => {
    if (!editing) return;
    const startsAt = new Date(`${editForm.date}T${editForm.start}:00`);
    let endsAt = new Date(`${editForm.date}T${editForm.end}:00`);
    if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 86_400_000);
    try {
      await scheduleService.update(editing.id, { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), position: editForm.position || null });
      setToast('Shift updated');
      setEditing(null);
      await load();
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to update the shift');
    }
  };
  const confirmCancel = async () => {
    if (!cancelling) return;
    try {
      await hrService.cancelShift(cancelling.id, cancelReason.trim());
      setToast('Shift cancelled');
      setCancelling(null);
      await load();
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to cancel the shift');
    }
  };
  const decideOvertime = async (shift: ShiftScheduleRecord, action: 'approve' | 'reject') => {
    try {
      await hrService.decideShiftOvertime(shift.id, action);
      setToast(action === 'approve' ? 'Overtime approved' : 'Overtime not approved');
      await load();
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Could not decide the overtime');
    }
  };
  const openAccess = async () => {
    try {
      setAccess(await hrService.shiftAccessPolicy());
    } catch {
      // Keep the defaults on screen.
    }
    setAccessOpen(true);
  };
  const saveAccess = async () => {
    try {
      setAccess(await hrService.saveShiftAccessPolicy(access));
      setToast('Shift access saved');
      setAccessOpen(false);
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Could not save shift access');
    }
  };

  const shiftWeek = (delta: number) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta * 7);
    setWeekStart(next);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <HrTabs />
      <PageHeader
        title="Staff Rota"
        subtitle="Weekly shift schedule. Overlapping shifts are rejected automatically."
        actions={
          <>
            <Button variant="contained" onClick={() => setGenerateOpen(true)}>Generate shifts</Button>
            <Button variant="outlined" onClick={() => void openAccess()}>Shift access</Button>
            <Button onClick={() => shiftWeek(-1)}>← Previous</Button>
            <Button onClick={() => setWeekStart(startOfWeek(new Date()))}>This week</Button>
            <Button onClick={() => shiftWeek(1)}>Next →</Button>
          </>
        }
      />
      <Tabs value={view} onChange={(_e, v) => setView(v)} sx={{ mb: 2 }}>
        <Tab value="rota" label="Shifts" />
        <Tab value="calendar" label="Attendance calendar" />
      </Tabs>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {view === 'calendar' ? (
        <AttendanceCalendar />
      ) : loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Stack direction="row" spacing={1.5} sx={{ minWidth: 900, pb: 1 }}>
            {weekDays.map((day) => {
              const key = isoDay(day);
              const shifts = byDay.get(key) || [];
              const isToday = key === isoDay(new Date());

              return (
                <Paper
                  key={key}
                  variant="outlined"
                  sx={{
                    flex: 1,
                    minWidth: 150,
                    p: 1.5,
                    borderRadius: 2,
                    borderColor: isToday ? 'primary.main' : undefined,
                    bgcolor: isToday ? 'action.hover' : undefined
                  }}
                >
                  <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {day.toLocaleDateString(undefined, { weekday: 'short' })}
                      </Typography>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {day.getDate()}
                      </Typography>
                    </Box>
                    <Tooltip title="Add shift">
                      <IconButton size="small" onClick={() => openCreate(day)} aria-label={`Add shift on ${key}`}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  <Stack spacing={1}>
                    {shifts.length === 0 && (
                      <Typography variant="caption" color="text.disabled">
                        No shifts
                      </Typography>
                    )}
                    {Object.entries(
                      shifts.reduce<Record<string, ShiftScheduleRecord[]>>((groups, shift) => {
                        const dept = shift.staff?.department ?? (shift.position?.includes(':') ? shift.position.split(':')[0] : '');
                        (groups[dept] ||= []).push(shift);
                        return groups;
                      }, {})
                    ).map(([dept, group]) => (
                      <Box key={dept}>
                        <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>
                          {humaniseDept(dept)}
                        </Typography>
                        <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                          {group.map((shift) => (
                            <Paper key={shift.id} variant="outlined" sx={{ p: 1, borderRadius: 1.5, opacity: shift.status === 'CANCELLED' ? 0.5 : 1 }}>
                              <Typography variant="caption" fontWeight={700} display="block" noWrap>
                                {shift.staff ? `${shift.staff.firstName} ${shift.staff.lastName}` : '—'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {shiftName(shift.position) ? `${shiftName(shift.position)} · ` : ''}
                                {new Date(shift.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {' – '}
                                {new Date(shift.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Typography>
                              {shift.overtimeStatus === 'PENDING' && (
                                <Box sx={{ mt: 0.5 }}>
                                  <Chip size="small" color="info" label="Overtime asked" sx={{ height: 18, fontSize: 10 }} />
                                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                                    <Button size="small" color="success" sx={{ minHeight: 24, px: 1, fontSize: 11 }} onClick={() => void decideOvertime(shift, 'approve')}>Approve</Button>
                                    <Button size="small" color="error" sx={{ minHeight: 24, px: 1, fontSize: 11 }} onClick={() => void decideOvertime(shift, 'reject')}>Reject</Button>
                                  </Stack>
                                </Box>
                              )}
                              {shift.overtimeStatus === 'APPROVED' && <Chip size="small" color="info" variant="outlined" label="Overtime approved" sx={{ mt: 0.5, height: 18, fontSize: 10 }} />}
                              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                                <Chip size="small" label={shift.status} color={SCHEDULE_STATUS_COLOR[shift.status]} sx={{ height: 18, fontSize: 10 }} />
                                <Box sx={{ flexGrow: 1 }} />
                                {shift.status === 'SCHEDULED' && (
                                  <>
                                    <Button size="small" sx={{ minHeight: 22, px: 0.75, fontSize: 11 }} onClick={() => openEdit(shift)}>Edit</Button>
                                    <Button size="small" color="warning" sx={{ minHeight: 22, px: 0.75, fontSize: 11 }} onClick={() => { setCancelReason(''); setCancelling(shift); }}>Cancel</Button>
                                  </>
                                )}
                                <IconButton size="small" onClick={() => void remove(shift)} aria-label="Remove shift" sx={{ p: 0.25 }}>
                                  <DeleteIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      )}

      {!loading && schedules.length === 0 && (
        <EmptyState
          icon={<EventNoteIcon />}
          title="No shifts this week"
          description="Use the + on any day to add a shift."
        />
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add shift</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              select
              label="Staff"
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
              label="Date"
              type="date"
              value={form.date}
              onChange={(event) => setForm((f) => ({ ...f, date: event.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />

            <Stack direction="row" spacing={2}>
              <TextField
                label="Start"
                type="time"
                value={form.start}
                onChange={(event) => setForm((f) => ({ ...f, start: event.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="End"
                type="time"
                value={form.end}
                onChange={(event) => setForm((f) => ({ ...f, end: event.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Stack>

            <TextField
              label="Position (optional)"
              value={form.position}
              onChange={(event) => setForm((f) => ({ ...f, position: event.target.value }))}
              fullWidth
              placeholder="e.g. Front desk, Bar"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Adding…' : 'Add shift'}
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
      <GenerateRotaDialog open={generateOpen} onClose={() => setGenerateOpen(false)} onDone={(message) => { setGenerateOpen(false); setToast(message); void load(); }} />

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle>Edit shift</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField type="date" label="Date" InputLabelProps={{ shrink: true }} value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
            <Stack direction="row" spacing={1}>
              <TextField type="time" label="Starts" InputLabelProps={{ shrink: true }} value={editForm.start} onChange={(e) => setEditForm({ ...editForm, start: e.target.value })} fullWidth />
              <TextField type="time" label="Ends" InputLabelProps={{ shrink: true }} value={editForm.end} onChange={(e) => setEditForm({ ...editForm, end: e.target.value })} fullWidth />
            </Stack>
            <TextField label="Position / shift" value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => void saveEdit()}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(cancelling)} onClose={() => setCancelling(null)} fullWidth maxWidth="xs">
        <DialogTitle>Cancel shift</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth label="Reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelling(null)}>Keep it</Button>
          <Button color="warning" variant="contained" disabled={cancelReason.trim().length < 3} onClick={() => void confirmCancel()}>Cancel shift</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={accessOpen} onClose={() => setAccessOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Shift access</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControlLabel control={<Switch checked={access.enabled} onChange={(e) => setAccess({ ...access, enabled: e.target.checked })} />} label="Access follows the rota" />
            <TextField type="number" label="Sign-in opens before a shift (minutes)" value={access.earlyMinutes} onChange={(e) => setAccess({ ...access, earlyMinutes: Number(e.target.value) })} />
            <TextField type="number" label="Access continues after a shift (minutes)" value={access.afterMinutes} onChange={(e) => setAccess({ ...access, afterMinutes: Number(e.target.value) })} />
            <Typography variant="caption" color="text.secondary">
              Applies only to staff on the rota. After the shift and this allowance, someone who has not ended their shift can only end it; overtime asked for in time
              pauses their access until approved. Only the owner or GM can unlock an account early (Staff → profile). The owner is never restricted.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccessOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void saveAccess()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

/**
 * Wrapped in Layout so this page carries the same sidebar, header, and
 * page chrome as the rest of the dashboard. Wrapping at the export keeps
 * the loading and error early-returns inside the shell too.
 */
const SchedulePageWithLayout = () => (
  <Layout>
    <SchedulePage />
  </Layout>
);

export default SchedulePageWithLayout;
