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
  Divider,
  Grid,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { useWebSocket } from '../../../hooks/useWebSocket';
import {
  housekeepingService,
  PRIORITY_COLOR,
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL,
  type DirtyRoom,
  type Housekeeper,
  type HousekeepingPriority,
  type HousekeepingTask
} from '../../../services/housekeeping.service';

/**
 * Housekeeping manager view: assign dirty rooms to staff, then approve or
 * reject completed work. Rooms stay out of sellable inventory until approved.
 */
const HousekeepingManagerDashboard = () => {
  const { on } = useWebSocket();

  const [dirtyRooms, setDirtyRooms] = useState<DirtyRoom[]>([]);
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [assignRoom, setAssignRoom] = useState<DirtyRoom | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [priority, setPriority] = useState<HousekeepingPriority>('MEDIUM');
  const [assignNotes, setAssignNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [rejectTask, setRejectTask] = useState<HousekeepingTask | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    try {
      const [rooms, taskList, staff] = await Promise.all([
        housekeepingService.listDirtyRooms(),
        housekeepingService.listTasks(),
        housekeepingService.listHousekeepers()
      ]);
      setDirtyRooms(rooms);
      setTasks(taskList);
      setHousekeepers(staff);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load housekeeping data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Live refresh: any workflow event from the backend re-pulls the board.
  useEffect(() => {
    const events = [
      'housekeeping.room_dirty',
      'housekeeping.task.assigned',
      'housekeeping.task.started',
      'housekeeping.task.completed',
      'housekeeping.task.approved',
      'housekeeping.task.rejected'
    ];

    const unsubscribers = events.map((event) => on(event, () => void load()));

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, [on, load]);

  const awaitingApproval = useMemo(() => tasks.filter((task) => task.status === 'DONE'), [tasks]);
  const inFlight = useMemo(
    () => tasks.filter((task) => task.status === 'PENDING' || task.status === 'IN_PROGRESS'),
    [tasks]
  );

  const openAssign = (room: DirtyRoom) => {
    setAssignRoom(room);
    setSelectedStaff([]);
    setPriority('MEDIUM');
    setAssignNotes('');
  };

  const handleAssign = async () => {
    if (!assignRoom || selectedStaff.length === 0) {
      return;
    }

    setSaving(true);
    try {
      await housekeepingService.assignTask({
        roomId: assignRoom.id,
        assignedTo: selectedStaff,
        priority,
        notes: assignNotes.trim() || undefined
      });
      setToast(`Room ${assignRoom.roomNumber} assigned`);
      setAssignRoom(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign task');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (task: HousekeepingTask) => {
    try {
      await housekeepingService.approveTask(task.id);
      setToast(`Room ${task.room.roomNumber} approved and returned to inventory`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve task');
    }
  };

  const handleReject = async () => {
    if (!rejectTask || !rejectReason.trim()) {
      return;
    }

    try {
      await housekeepingService.rejectTask(rejectTask.id, rejectReason.trim());
      setToast(`Room ${rejectTask.room.roomNumber} sent back for redo`);
      setRejectTask(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject task');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700}>
        Housekeeping
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Assign dirty rooms, then approve completed work to return rooms to inventory.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <SectionCard
            title="Dirty rooms"
            subtitle="Awaiting assignment"
            count={dirtyRooms.length}
            icon={<CleaningServicesIcon color="warning" />}
          >
            {dirtyRooms.length === 0 ? (
              <EmptyNote text="No rooms are waiting for assignment." />
            ) : (
              <Stack spacing={1.5}>
                {dirtyRooms.map((room) => (
                  <Paper key={room.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body1" fontWeight={700}>
                          Room {room.roomNumber}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Floor {room.floor} · {room.roomType}
                        </Typography>
                      </Box>
                      <Button size="small" variant="contained" onClick={() => openAssign(room)}>
                        Assign
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={7}>
          <SectionCard
            title="Awaiting your approval"
            subtitle="Housekeeper marked these done"
            count={awaitingApproval.length}
            icon={<DoneAllIcon color="warning" />}
          >
            {awaitingApproval.length === 0 ? (
              <EmptyNote text="Nothing is waiting for inspection." />
            ) : (
              <Stack spacing={1.5}>
                {awaitingApproval.map((task) => (
                  <Paper key={task.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="flex-start" spacing={2}>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body1" fontWeight={700}>
                          Room {task.room.roomNumber}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          By {task.assignedTo.map((s) => `${s.firstName} ${s.lastName}`).join(', ') || '—'}
                          {task.completedAt && ` · ${new Date(task.completedAt).toLocaleTimeString()}`}
                        </Typography>
                        {task.notes && (
                          <Typography variant="caption" color="text.secondary">
                            Note: {task.notes}
                          </Typography>
                        )}
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<CheckCircleIcon />}
                          onClick={() => void handleApprove(task)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<CancelIcon />}
                          onClick={() => {
                            setRejectTask(task);
                            setRejectReason('');
                          }}
                        >
                          Reject
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </SectionCard>

          <Box sx={{ mt: 3 }}>
            <SectionCard title="In progress" subtitle="Assigned and being cleaned" count={inFlight.length}>
              {inFlight.length === 0 ? (
                <EmptyNote text="No active cleaning tasks." />
              ) : (
                <Stack spacing={1}>
                  {inFlight.map((task) => (
                    <Stack
                      key={task.id}
                      direction="row"
                      alignItems="center"
                      spacing={1.5}
                      sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      <Typography variant="body2" fontWeight={600} sx={{ minWidth: 90 }}>
                        Room {task.room.roomNumber}
                      </Typography>
                      <Chip size="small" label={TASK_STATUS_LABEL[task.status]} color={TASK_STATUS_COLOR[task.status]} />
                      <Chip size="small" variant="outlined" label={task.priority} color={PRIORITY_COLOR[task.priority]} />
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ flexGrow: 1 }}>
                        {task.assignedTo.map((s) => s.firstName).join(', ')}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </SectionCard>
          </Box>
        </Grid>
      </Grid>

      {/* Assign dialog */}
      <Dialog open={Boolean(assignRoom)} onClose={() => setAssignRoom(null)} fullWidth maxWidth="sm">
        <DialogTitle>Assign room {assignRoom?.roomNumber}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Housekeepers
              </Typography>
              <Select
                multiple
                fullWidth
                value={selectedStaff}
                onChange={(event) =>
                  setSelectedStaff(
                    typeof event.target.value === 'string'
                      ? event.target.value.split(',')
                      : (event.target.value as string[])
                  )
                }
                renderValue={(selected) =>
                  housekeepers
                    .filter((person) => selected.includes(person.id))
                    .map((person) => person.name)
                    .join(', ')
                }
                displayEmpty
              >
                {housekeepers.length === 0 && (
                  <MenuItem disabled value="">
                    No housekeeping staff found
                  </MenuItem>
                )}
                {housekeepers.map((person) => (
                  <MenuItem key={person.id} value={person.id}>
                    {person.name}
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      ({person.openTasks} open)
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <TextField
              select
              label="Priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as HousekeepingPriority)}
              fullWidth
            >
              {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((level) => (
                <MenuItem key={level} value={level}>
                  {level}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Notes (optional)"
              value={assignNotes}
              onChange={(event) => setAssignNotes(event.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAssignRoom(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void handleAssign()}
            disabled={selectedStaff.length === 0 || saving}
          >
            {saving ? 'Assigning…' : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={Boolean(rejectTask)} onClose={() => setRejectTask(null)} fullWidth maxWidth="sm">
        <DialogTitle>Reject room {rejectTask?.room.roomNumber}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The housekeeper will see this reason and must redo the work. The room stays unavailable
            until you approve it.
          </Typography>
          <TextField
            label="Reason"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            fullWidth
            required
            multiline
            minRows={3}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejectTask(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void handleReject()}
            disabled={!rejectReason.trim()}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3500}
        onClose={() => setToast('')}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
};

const SectionCard = ({
  title,
  subtitle,
  count,
  icon,
  children
}: {
  title: string;
  subtitle: string;
  count: number;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
      {icon}
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      </Box>
      <Chip size="small" label={count} />
    </Stack>
    <Divider sx={{ my: 1.5 }} />
    {children}
  </Paper>
);

const EmptyNote = ({ text }: { text: string }) => (
  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
    {text}
  </Typography>
);

/**
 * Wrapped in Layout so this page carries the same sidebar, header, and
 * page chrome as the rest of the dashboard. Wrapping at the export keeps
 * the loading and error early-returns inside the shell too.
 */
const HousekeepingManagerDashboardWithLayout = () => (
  <Layout>
    <HousekeepingManagerDashboard />
  </Layout>
);

export default HousekeepingManagerDashboardWithLayout;
