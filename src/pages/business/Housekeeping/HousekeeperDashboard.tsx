import Layout from '../../../components/Layout';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DoneIcon from '@mui/icons-material/Done';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { useWebSocket } from '../../../hooks/useWebSocket';
import {
  housekeepingService,
  PRIORITY_COLOR,
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL,
  type HousekeepingNotification,
  type HousekeepingTask
} from '../../../services/housekeeping.service';

/**
 * Housekeeper view: see assigned rooms, start work, and mark them done.
 * A task marked done waits for manager approval; a rejected task comes back
 * here with the manager's reason attached.
 */
const HousekeeperDashboard = () => {
  const { on } = useWebSocket();

  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [notifications, setNotifications] = useState<HousekeepingNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [taskList, notificationData] = await Promise.all([
        housekeepingService.listTasks(),
        housekeepingService.listNotifications()
      ]);
      setTasks(taskList);
      setNotifications(notificationData.notifications);
      setUnreadCount(notificationData.unreadCount);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const events = [
      'housekeeping.task.assigned',
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

  const active = useMemo(
    () =>
      tasks.filter(
        (task) => task.status === 'PENDING' || task.status === 'IN_PROGRESS' || task.status === 'REJECTED'
      ),
    [tasks]
  );

  const awaitingApproval = useMemo(() => tasks.filter((task) => task.status === 'DONE'), [tasks]);
  const history = useMemo(() => tasks.filter((task) => task.status === 'APPROVED').slice(0, 20), [tasks]);
  const rejected = useMemo(() => tasks.filter((task) => task.status === 'REJECTED'), [tasks]);

  const runAction = async (task: HousekeepingTask, action: 'start' | 'done') => {
    setBusyTaskId(task.id);
    try {
      if (action === 'start') {
        await housekeepingService.startTask(task.id);
        setToast(`Started room ${task.room.roomNumber}`);
      } else {
        await housekeepingService.completeTask(task.id);
        setToast(`Room ${task.room.roomNumber} sent for approval`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await housekeepingService.markAllRead();
      await load();
    } catch {
      setToast('Could not mark notifications read');
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
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" fontWeight={700}>
            My Tasks
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Rooms assigned to you today.
          </Typography>
        </Box>
        <Tooltip title="Mark all notifications read">
          <span>
            <IconButton onClick={() => void handleMarkAllRead()} disabled={unreadCount === 0}>
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {rejected.map((task) => (
        <Alert severity="warning" sx={{ mb: 2 }} key={`reject-${task.id}`}>
          <AlertTitle>Room {task.room.roomNumber} needs redoing</AlertTitle>
          {task.rejectionReason}
        </Alert>
      ))}

      <Section title="To do" count={active.length}>
        {active.length === 0 ? (
          <Empty text="Nothing assigned right now." />
        ) : (
          <Stack spacing={1.5}>
            {active.map((task) => (
              <Paper key={task.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="h6" fontWeight={700}>
                        Room {task.room.roomNumber}
                      </Typography>
                      <Chip
                        size="small"
                        label={task.priority}
                        color={PRIORITY_COLOR[task.priority]}
                        variant="outlined"
                      />
                      <Chip size="small" label={TASK_STATUS_LABEL[task.status]} color={TASK_STATUS_COLOR[task.status]} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Floor {task.room.floor} · {task.room.roomType}
                    </Typography>
                    {task.notes && (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {task.notes}
                      </Typography>
                    )}
                  </Box>

                  <Stack direction="row" spacing={1}>
                    {task.status === 'PENDING' && (
                      <Button
                        variant="contained"
                        startIcon={<PlayArrowIcon />}
                        onClick={() => void runAction(task, 'start')}
                        disabled={busyTaskId === task.id}
                      >
                        Start
                      </Button>
                    )}
                    <Button
                      variant={task.status === 'PENDING' ? 'outlined' : 'contained'}
                      color="success"
                      startIcon={<DoneIcon />}
                      onClick={() => void runAction(task, 'done')}
                      disabled={busyTaskId === task.id}
                    >
                      Mark done
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Section>

      <Section title="Waiting for approval" count={awaitingApproval.length}>
        {awaitingApproval.length === 0 ? (
          <Empty text="Nothing pending inspection." />
        ) : (
          <Stack spacing={1}>
            {awaitingApproval.map((task) => (
              <Stack
                key={task.id}
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{ py: 1.2, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <DoneAllIcon color="warning" fontSize="small" />
                <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>
                  Room {task.room.roomNumber}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {task.completedAt ? new Date(task.completedAt).toLocaleTimeString() : ''}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </Section>

      <Section title="Recently approved" count={history.length}>
        {history.length === 0 ? (
          <Empty text="No completed tasks yet." />
        ) : (
          <Stack spacing={0.5}>
            {history.map((task) => (
              <Stack
                key={task.id}
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Room {task.room.roomNumber}
                </Typography>
                <Chip size="small" color="success" label="Approved" />
              </Stack>
            ))}
          </Stack>
        )}
      </Section>

      {notifications.length > 0 && (
        <Section title="Notifications" count={unreadCount}>
          <Stack spacing={0.5}>
            {notifications.slice(0, 15).map((notification) => (
              <Stack
                key={notification.id}
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{
                  py: 1,
                  px: 1,
                  borderRadius: 1,
                  bgcolor: notification.isRead ? 'transparent' : 'action.hover'
                }}
              >
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={notification.isRead ? 400 : 600}>
                    {notification.message}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(notification.createdAt).toLocaleString()}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Section>
      )}

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

const Section = ({ title, count, children }: { title: string; count: number; children: React.ReactNode }) => (
  <Box sx={{ mb: 4 }}>
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
      <Typography variant="subtitle1" fontWeight={700}>
        {title}
      </Typography>
      <Chip size="small" label={count} />
    </Stack>
    <Divider sx={{ mb: 1.5 }} />
    {children}
  </Box>
);

const Empty = ({ text }: { text: string }) => (
  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
    {text}
  </Typography>
);

/**
 * Wrapped in Layout so this page carries the same sidebar, header, and
 * page chrome as the rest of the dashboard. Wrapping at the export keeps
 * the loading and error early-returns inside the shell too.
 */
const HousekeeperDashboardWithLayout = () => (
  <Layout>
    <HousekeeperDashboard />
  </Layout>
);

export default HousekeeperDashboardWithLayout;
