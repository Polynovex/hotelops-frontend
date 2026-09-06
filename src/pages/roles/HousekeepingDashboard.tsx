import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, Chip, Divider, Stack, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import CleaningServicesRounded from '@mui/icons-material/CleaningServicesRounded';
import DoneAllRounded from '@mui/icons-material/DoneAllRounded';
import PendingActionsRounded from '@mui/icons-material/PendingActionsRounded';
import BuildRounded from '@mui/icons-material/BuildRounded';
import MeetingRoomRounded from '@mui/icons-material/MeetingRoomRounded';
import ChecklistRounded from '@mui/icons-material/ChecklistRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import {
  DashboardShell,
  MetricCard,
  MetricGrid,
  QuickActions,
  SectionBlock
} from '../../components/dashboard';
import type { QuickAction } from '../../components/dashboard';
import {
  housekeepingOpsService,
  roomOpsService,
  type HousekeepingTaskRecord,
  type RoomRecord
} from '../../services/operations';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../utils/apiError';

/**
 * The housekeeper's landing screen.
 *
 * Housekeepers previously landed on the room status board — a grid of every
 * room in the property, which answers "what is the state of the hotel?" rather
 * than "what am I supposed to do next?". This leads with the work: rooms
 * waiting to be cleaned, what is in progress, and what is blocked on
 * maintenance.
 *
 * No shift bar here: housekeeping does not run a till, and the server refuses
 * them shift routes, so offering one would be a control that only ever errors.
 */
const HousekeepingDashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isDark = theme.palette.mode === 'dark';

  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [tasks, setTasks] = useState<HousekeepingTaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roomList, taskList] = await Promise.all([
        roomOpsService.listRooms(),
        housekeepingOpsService.listTasks()
      ]);
      setRooms(roomList);
      setTasks(taskList);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load your rooms and tasks.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const byStatus = (status: string) => rooms.filter((room) => room.status === status).length;
    return {
      toClean: byStatus('CLEANING'),
      maintenance: byStatus('MAINTENANCE'),
      available: byStatus('AVAILABLE'),
      occupied: byStatus('OCCUPIED')
    };
  }, [rooms]);

  const inProgress = tasks.filter((task) => task.status === 'IN_PROGRESS');
  const todo = tasks.filter((task) => task.status === 'TODO');
  const doneToday = tasks.filter((task) => task.status === 'DONE').length;

  const firstName = user?.firstName?.trim() || 'there';

  const actions: QuickAction[] = [
    {
      label: 'Room status board',
      hint: 'Update a room',
      icon: MeetingRoomRounded,
      primary: true,
      onClick: () => navigate('/business/rooms/status-board')
    },
    {
      label: 'My tasks',
      hint: 'Assigned work',
      icon: ChecklistRounded,
      onClick: () => navigate('/business/housekeeping')
    },
    {
      label: 'Report an issue',
      hint: 'Maintenance request',
      icon: BuildRounded,
      onClick: () => navigate('/business/housekeeping')
    },
    {
      label: 'My HR',
      hint: 'Shifts and payslips',
      icon: PendingActionsRounded,
      onClick: () => navigate('/my-hr')
    }
  ];

  return (
    <DashboardShell
      eyebrow="Housekeeping"
      title={`Your rounds, ${firstName}.`}
      subtitle="Rooms waiting on you, what is in progress, and anything blocked."
      actions={
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshRounded />}
          onClick={() => void load()}
          disabled={loading}
          sx={{ minHeight: 38 }}
        >
          Refresh
        </Button>
      }
    >
      {error ? (
        <Alert severity="warning" action={<Button size="small" onClick={() => void load()}>Retry</Button>}>
          {error}
        </Alert>
      ) : null}

      <SectionBlock title="Your board" description="Across every room in the property.">
        <MetricGrid>
          <MetricCard
            label="To clean"
            value={counts.toClean}
            caption="Rooms needing service"
            icon={CleaningServicesRounded}
            loading={loading}
            tone={counts.toClean > 0 ? 'attention' : 'good'}
            onClick={() => navigate('/business/rooms/status-board')}
          />
          <MetricCard
            label="In progress"
            value={inProgress.length}
            caption="Started, not finished"
            icon={PendingActionsRounded}
            loading={loading}
          />
          <MetricCard
            label="Out of order"
            value={counts.maintenance}
            caption="Blocked on maintenance"
            icon={BuildRounded}
            loading={loading}
            tone={counts.maintenance > 0 ? 'critical' : 'neutral'}
          />
          <MetricCard
            label="Ready"
            value={counts.available}
            caption="Clean and sellable"
            icon={DoneAllRounded}
            loading={loading}
            tone="good"
          />
        </MetricGrid>
      </SectionBlock>

      <SectionBlock title="Quick actions" description="What housekeeping does most.">
        <QuickActions actions={actions} />
      </SectionBlock>

      <SectionBlock
        title="Next up"
        description={
          doneToday > 0
            ? `${doneToday} task${doneToday === 1 ? '' : 's'} completed today.`
            : 'Tasks waiting to be started.'
        }
        action={
          <Button size="small" onClick={() => navigate('/business/housekeeping')}>
            All tasks
          </Button>
        }
      >
        <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          {todo.length === 0 && inProgress.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                {loading ? 'Loading your board…' : 'Nothing waiting'}
              </Typography>
              {!loading ? (
                <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
                  Every room on your board is clean. New work appears here as guests check out.
                </Typography>
              ) : null}
            </Box>
          ) : (
            <Stack divider={<Divider flexItem />}>
              {[...inProgress, ...todo].slice(0, 8).map((task) => (
                <Stack
                  key={task.id}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={2}
                  sx={{ px: 2.25, py: 1.6 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>
                      Room {task.roomNumber}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }} noWrap>
                      {task.title}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                    {task.priority === 'HIGH' ? (
                      <Chip
                        size="small"
                        label="High"
                        sx={{
                          height: 21,
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: theme.palette.error.main,
                          background: alpha(theme.palette.error.main, isDark ? 0.2 : 0.1)
                        }}
                      />
                    ) : null}
                    <Chip
                      size="small"
                      label={task.status === 'IN_PROGRESS' ? 'In progress' : 'To do'}
                      sx={{
                        height: 21,
                        fontSize: 10.5,
                        fontWeight: 600,
                        color:
                          task.status === 'IN_PROGRESS'
                            ? theme.palette.warning.main
                            : theme.palette.text.secondary,
                        background: alpha(
                          task.status === 'IN_PROGRESS'
                            ? theme.palette.warning.main
                            : theme.palette.text.primary,
                          isDark ? 0.16 : 0.07
                        )
                      }}
                    />
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </Card>
      </SectionBlock>
    </DashboardShell>
  );
};

export default HousekeepingDashboard;
