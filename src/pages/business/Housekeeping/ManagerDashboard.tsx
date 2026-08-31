// import Layout from '../../../components/Layout';
// import { useCallback, useEffect, useMemo, useState } from 'react';
// import {
//   Alert,
//   Box,
//   Button,
//   Chip,
//   CircularProgress,
//   Container,
//   Dialog,
//   DialogActions,
//   DialogContent,
// //   Divider,
//   Grid,
//   MenuItem,
//   Paper,
//   Select,
//   Snackbar,
//   Stack,
//   TextField,
//   Typography
// } from '@mui/material';
// import CheckCircleIcon from '@mui/icons-material/CheckCircle';
// import CancelIcon from '@mui/icons-material/Cancel';
// import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
// import DoneAllIcon from '@mui/icons-material/DoneAll';
// import { useWebSocket } from '../../../hooks/useWebSocket';
// import {
//   housekeepingService,
//   PRIORITY_COLOR,
//   TASK_STATUS_COLOR,
//   TASK_STATUS_LABEL,
//   type DirtyRoom,
//   type Housekeeper,
//   type HousekeepingPriority,
//   type HousekeepingTask
// } from '../../../services/housekeeping.service';

// /**
//  * Housekeeping manager view: assign dirty rooms to staff, then approve or
//  * reject completed work. Rooms stay out of sellable inventory until approved.
//  */
// const HousekeepingManagerDashboard = () => {
//   const { on } = useWebSocket();

//   const [dirtyRooms, setDirtyRooms] = useState<DirtyRoom[]>([]);
//   const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
//   const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState('');
//   const [toast, setToast] = useState('');

//   const [assignRoom, setAssignRoom] = useState<DirtyRoom | null>(null);
//   const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
//   const [priority, setPriority] = useState<HousekeepingPriority>('MEDIUM');
//   const [assignNotes, setAssignNotes] = useState('');
//   const [saving, setSaving] = useState(false);

//   const [rejectTask, setRejectTask] = useState<HousekeepingTask | null>(null);
//   const [rejectReason, setRejectReason] = useState('');

//   const load = useCallback(async () => {
//     try {
//       const [rooms, taskList, staff] = await Promise.all([
//         housekeepingService.listDirtyRooms(),
//         housekeepingService.listTasks(),
//         housekeepingService.listHousekeepers()
//       ]);
//       setDirtyRooms(rooms);
//       setTasks(taskList);
//       setHousekeepers(staff);
//       setError('');
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to load housekeeping data');
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     void load();
//   }, [load]);

//   // Live refresh: any workflow event from the backend re-pulls the board.
//   useEffect(() => {
//     const events = [
//       'housekeeping.room_dirty',
//       'housekeeping.task.assigned',
//       'housekeeping.task.started',
//       'housekeeping.task.completed',
//       'housekeeping.task.approved',
//       'housekeeping.task.rejected'
//     ];

//     const unsubscribers = events.map((event) => on(event, () => void load()));

//     return () => {
//       unsubscribers.forEach((unsubscribe) => {
//         if (typeof unsubscribe === 'function') {
//           unsubscribe();
//         }
//       });
//     };
//   }, [on, load]);

//   const awaitingApproval = useMemo(() => tasks.filter((task) => task.status === 'DONE'), [tasks]);
//   const inFlight = useMemo(
//     () => tasks.filter((task) => task.status === 'PENDING' || task.status === 'IN_PROGRESS'),
//     [tasks]
//   );

//   const openAssign = (room: DirtyRoom) => {
//     setAssignRoom(room);
//     setSelectedStaff([]);
//     setPriority('MEDIUM');
//     setAssignNotes('');
//   };

//   const handleAssign = async () => {
//     if (!assignRoom || selectedStaff.length === 0) {
//       return;
//     }

//     setSaving(true);
//     try {
//       await housekeepingService.assignTask({
//         roomId: assignRoom.id,
//         assignedTo: selectedStaff,
//         priority,
//         notes: assignNotes.trim() || undefined
//       });
//       setToast(`Room ${assignRoom.roomNumber} assigned`);
//       setAssignRoom(null);
//       await load();
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to assign task');
//     } finally {
//       setSaving(false);
//     }
//   };

//   const handleApprove = async (task: HousekeepingTask) => {
//     try {
//       await housekeepingService.approveTask(task.id);
//       setToast(`Room ${task.room.roomNumber} approved and returned to inventory`);
//       await load();
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to approve task');
//     }
//   };

//   const handleReject = async () => {
//     if (!rejectTask || !rejectReason.trim()) {
//       return;
//     }

//     try {
//       await housekeepingService.rejectTask(rejectTask.id, rejectReason.trim());
//       setToast(`Room ${rejectTask.room.roomNumber} sent back for redo`);
//       setRejectTask(null);
//       setRejectReason('');
//       await load();
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to reject task');
//     }
//   };

//   if (loading) {
//     return (
//       <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
//         <CircularProgress />
//       </Box>
//     );
//   }

//   return (
//     <Container maxWidth="xl" sx={{ py: 4 }}>
//       <Typography variant="h4" fontWeight={700}>
//         Housekeeping
//       </Typography>
//       <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
//         Assign dirty rooms, then approve completed work to return rooms to inventory.
//       </Typography>

//       {error && (
//         <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
//           {error}
//         </Alert>
//       )}

//       <Grid container spacing={3}>
//         <Grid item xs={12} md={5}>
//           <SectionCard
//             title="Dirty rooms"
//             subtitle="Awaiting assignment"
//             count={dirtyRooms.length}
//             icon={<CleaningServicesIcon color="warning" />}
//           >
//             {dirtyRooms.length === 0 ? (
//               <EmptyNote text="No rooms are waiting for assignment." />
//             ) : (
//               <Stack spacing={1.5}>
//                 {dirtyRooms.map((room) => (
//                   <Paper key={room.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
//                     <Stack direction="row" alignItems="center" spacing={2}>
//                       <Box sx={{ flexGrow: 1 }}>
//                         <Typography variant="body1" fontWeight={700}>
//                           Room {room.roomNumber}
//                         </Typography>
//                         <Typography variant="caption" color="text.secondary">
//                           Floor {room.floor} · {room.roomType}
//                         </Typography>
//                       </Box>
//                       <Button size="small" variant="contained" onClick={() => openAssign(room)}>
//                         Assign
//                       </Button>
//                     </Stack>
//                   </Paper>
//                 ))}
//               </Stack>
//             )}
//           </SectionCard>
//         </Grid>

//         <Grid item xs={12} md={7}>
//           <SectionCard
//             title="Awaiting your approval"
//             subtitle="Housekeeper marked these done"
//             count={awaitingApproval.length}
//             icon={<DoneAllIcon color="warning" />}
//           >
//             {awaitingApproval.length === 0 ? (
//               <EmptyNote text="Nothing is waiting for inspection." />
//             ) : (
//               <Stack spacing={1.5}>
//                 {awaitingApproval.map((task) => (
//                   <Paper key={task.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
//                     <Stack direction="row" alignItems="flex-start" spacing={2}>
//                       <Box sx={{ flexGrow: 1, minWidth: 0 }}>
//                         <Typography variant="body1" fontWeight={700}>
//                           Room {task.room.roomNumber}
//                         </Typography>
//                         <Typography variant="caption" color="text.secondary" display="block">
//                           By {task.assignedTo.map((s) => `${s.firstName} ${s.lastName}`).join(', ') || '—'}
//                           {task.completedAt && ` · ${new Date(task.completedAt).toLocaleTimeString()}`}
//                         </Typography>
//                         {task.notes && (
//                           <Typography variant="caption" color="text.secondary">
//                             Note: {task.notes}
//                           </Typography>
//                         )}
//                       </Box>
//                       <Stack direction="row" spacing={1}>
//                         <Button
//                           size="small"
//                           variant="contained"
//                           color="success"
//                           startIcon={<CheckCircleIcon />}
//                           onClick={() => void handleApprove(task)}
//                         >
//                           Approve
//                         </Button>
//                         <Button
//                           size="small"
//                           variant="outlined"
//                           color="error"
//                           startIcon={<CancelIcon />}
//                           onClick={() => {
//                             setRejectTask(task);
//                             setRejectReason('');
//                           }}
//                         >
//                           Reject
//                         </Button>
//                       </Stack>
//                     </Stack>
//                   </Paper>
//                 ))}
//               </Stack>
//             )}
//           </SectionCard>

//           <Box sx={{ mt: 3 }}>
//             <SectionCard title="In progress" subtitle="Assigned and being cleaned" count={inFlight.length}>
//               {inFlight.length === 0 ? (
//                 <EmptyNote text="No active cleaning tasks." />
//               ) : (
//                 <Stack spacing={1}>
//                   {inFlight.map((task) => (
//                     <Stack
//                       key={task.id}
//                       direction="row"
//                       alignItems="center"
//                       spacing={1.5}
//                       sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
//                     >
//                       <Typography variant="body2" fontWeight={600} sx={{ minWidth: 90 }}>
//                         Room {task.room.roomNumber}
//                       </Typography>
//                       <Chip size="small" label={TASK_STATUS_LABEL[task.status]} color={TASK_STATUS_COLOR[task.status]} />
//                       <Chip size="small" variant="outlined" label={task.priority} color={PRIORITY_COLOR[task.priority]} />
//                       <Typography variant="caption" color="text.secondary" noWrap sx={{ flexGrow: 1 }}>
//                         {task.assignedTo.map((s) => s.firstName).join(', ')}
//                       </Typography>
//                     </Stack>
//                   ))}
//                 </Stack>
//               )}
//             </SectionCard>
//           </Box>
//         </Grid>
//       </Grid>

//       {/* Assign dialog */}
//       <Dialog open={Boolean(assignRoom)} onClose={() => setAssignRoom(null)} fullWidth maxWidth="sm">
//         <DialogTitle>Assign room {assignRoom?.roomNumber}</DialogTitle>
//         <DialogContent>
//           <Stack spacing={2.5} sx={{ mt: 1 }}>
//             <Box>
//               <Typography variant="body2" fontWeight={600} gutterBottom>
//                 Housekeepers
//               </Typography>
//               <Select
//                 multiple
//                 fullWidth
//                 value={selectedStaff}
//                 onChange={(event) =>
//                   setSelectedStaff(
//                     typeof event.target.value === 'string'
//                       ? event.target.value.split(',')
//                       : (event.target.value as string[])
//                   )
//                 }
//                 renderValue={(selected) =>
//                   housekeepers
//                     .filter((person) => selected.includes(person.id))
//                     .map((person) => person.name)
//                     .join(', ')
//                 }
//                 displayEmpty
//               >
//                 {housekeepers.length === 0 && (
//                   <MenuItem disabled value="">
//                     No housekeeping staff found
//                   </MenuItem>
//                 )}
//                 {housekeepers.map((person) => (
//                   <MenuItem key={person.id} value={person.id}>
//                     {person.name}
//                     <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
//                       ({person.openTasks} open)
//                     </Typography>
//                   </MenuItem>
//                 ))}
//               </Select>
//             </Box>

//             <TextField
//               select
//               label="Priority"
//               value={priority}
//               onChange={(event) => setPriority(event.target.value as HousekeepingPriority)}
//               fullWidth
//             >
//               {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((level) => (
//                 <MenuItem key={level} value={level}>
//                   {level}
//                 </MenuItem>
//               ))}
//             </TextField>

//             <TextField
//               label="Notes (optional)"
//               value={assignNotes}
//               onChange={(event) => setAssignNotes(event.target.value)}
//               fullWidth
//               multiline
//               minRows={2}
//             />
//           </Stack>
//         </DialogContent>
//         <DialogActions sx={{ px: 3, pb: 2 }}>
//           <Button onClick={() => setAssignRoom(null)}>Cancel</Button>
//           <Button
//             variant="contained"
//             onClick={() => void handleAssign()}
//             disabled={selectedStaff.length === 0 || saving}
//           >
//             {saving ? 'Assigning…' : 'Assign'}
//           </Button>
//         </DialogActions>
//       </Dialog>

//       {/* Reject dialog */}
//       <Dialog open={Boolean(rejectTask)} onClose={() => setRejectTask(null)} fullWidth maxWidth="sm">
//         <DialogTitle>Reject room {rejectTask?.room.roomNumber}</DialogTitle>
//         <DialogContent>
//           <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
//             The housekeeper will see this reason and must redo the work. The room stays unavailable
//             until you approve it.
//           </Typography>
//           <TextField
//             label="Reason"
//             value={rejectReason}
//             onChange={(event) => setRejectReason(event.target.value)}
//             fullWidth
//             required
//             multiline
//             minRows={3}
//             autoFocus
//           />
//         </DialogContent>
//         <DialogActions sx={{ px: 3, pb: 2 }}>
//           <Button onClick={() => setRejectTask(null)}>Cancel</Button>
//           <Button
//             color="error"
//             variant="contained"
//             onClick={() => void handleReject()}
//             disabled={!rejectReason.trim()}
//           >
//             Reject
//           </Button>
//         </DialogActions>
//       </Dialog>

//       <Snackbar
//         open={Boolean(toast)}
//         autoHideDuration={3500}
//         onClose={() => setToast('')}
//         message={toast}
//         anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
//       />
//     </Container>
//   );
// };

// const SectionCard = ({
//   title,
//   subtitle,
//   count,
//   icon,
//   children
// }: {
//   title: string;
//   subtitle: string;
//   count: number;
//   icon?: React.ReactNode;
//   children: React.ReactNode;
// }) => (
//   <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
//     <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
//       {icon}
//       <Box sx={{ flexGrow: 1 }}>
//         <Typography variant="subtitle1" fontWeight={700}>
//           {title}
//         </Typography>
//         <Typography variant="caption" color="text.secondary">
//           {subtitle}
//         </Typography>
//       </Box>
//       <Chip size="small" label={count} />
//     </Stack>
//     <Divider sx={{ my: 1.5 }} />
//     {children}
//   </Paper>
// );

// const EmptyNote = ({ text }: { text: string }) => (
//   <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
//     {text}
//   </Typography>
// );

// /**
//  * Wrapped in Layout so this page carries the same sidebar, header, and
//  * page chrome as the rest of the dashboard. Wrapping at the export keeps
//  * the loading and error early-returns inside the shell too.
//  */
// const HousekeepingManagerDashboardWithLayout = () => (
//   <Layout>
//     <HousekeepingManagerDashboard />
//   </Layout>
// );

// export default HousekeepingManagerDashboardWithLayout;


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

import CleaningServicesRoundedIcon from '@mui/icons-material/CleaningServicesRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import HotelRoundedIcon from '@mui/icons-material/HotelRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded';

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

/* -------------------------------------------------------------------------- */
/*                                DESIGN TOKENS                               */
/* -------------------------------------------------------------------------- */

const COLORS = {
  navy: '#123452',
  navyDark: '#0D2942',
  navySoft: '#1B4668',
  gold: '#C8954D',
  goldLight: '#F5E9D7',

  background: '#F4F7FA',
  surface: '#FFFFFF',
  border: '#E2E8EF',

  text: '#172635',
  textMuted: '#647587',

  green: '#2F8F68',
  greenBg: '#E8F6F0',

  amber: '#B97820',
  amberBg: '#FFF5E5',

  red: '#C6463D',
  redBg: '#FDEDEC',

  blue: '#2867A5',
  blueBg: '#EAF2FB',

  purple: '#7258A8',
  purpleBg: '#F1EDFA'
};

/* -------------------------------------------------------------------------- */
/*                              HELPER COMPONENTS                             */
/* -------------------------------------------------------------------------- */

const StatCard = ({
  label,
  value,
  helper,
  icon,
  tone
}: {
  label: string;
  value: number;
  helper: string;
  icon: React.ReactNode;
  tone: 'navy' | 'gold' | 'green' | 'blue';
}) => {
  const toneMap = {
    navy: {
      color: COLORS.navy,
      background: '#EDF3F8'
    },
    gold: {
      color: COLORS.gold,
      background: COLORS.goldLight
    },
    green: {
      color: COLORS.green,
      background: COLORS.greenBg
    },
    blue: {
      color: COLORS.blue,
      background: COLORS.blueBg
    }
  };

  const current = toneMap[tone];

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        p: 2.25,
        minHeight: 126,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 3,
        background: COLORS.surface,
        transition: 'all .2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 12px 28px rgba(20, 48, 73, 0.08)'
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: 4,
          height: '100%',
          background: current.color
        }
      }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        sx={{ height: '100%' }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '.06em'
            }}
          >
            {label}
          </Typography>

          <Typography
            sx={{
              mt: 1,
              fontSize: 31,
              lineHeight: 1,
              fontWeight: 800,
              color: COLORS.text
            }}
          >
            {value}
          </Typography>

          <Typography
            sx={{
              mt: 1,
              fontSize: 12,
              color: COLORS.textMuted
            }}
          >
            {helper}
          </Typography>
        </Box>

        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: current.color,
            background: current.background
          }}
        >
          {icon}
        </Box>
      </Stack>
    </Paper>
  );
};

const SectionHeader = ({
  icon,
  title,
  subtitle,
  count,
  accent = COLORS.navy
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  accent?: string;
}) => (
  <Box
    sx={{
      px: 2.5,
      py: 2,
      borderBottom: `1px solid ${COLORS.border}`
    }}
  >
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Box
        sx={{
          width: 42,
          height: 42,
          flexShrink: 0,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          background: `${accent}14`,
          color: accent
        }}
      >
        {icon}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 15,
            fontWeight: 800,
            color: COLORS.text
          }}
        >
          {title}
        </Typography>

        <Typography
          sx={{
            mt: 0.25,
            fontSize: 12,
            color: COLORS.textMuted
          }}
        >
          {subtitle}
        </Typography>
      </Box>

      <Box
        sx={{
          minWidth: 32,
          height: 28,
          px: 1,
          borderRadius: 1.5,
          display: 'grid',
          placeItems: 'center',
          background: '#F0F3F6',
          color: COLORS.text,
          fontSize: 12,
          fontWeight: 800
        }}
      >
        {count}
      </Box>
    </Stack>
  </Box>
);

const EmptyState = ({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) => (
  <Box
    sx={{
      py: 5,
      px: 3,
      textAlign: 'center'
    }}
  >
    <Box
      sx={{
        width: 52,
        height: 52,
        mx: 'auto',
        mb: 1.5,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: '#F3F6F8',
        color: '#8A99A8'
      }}
    >
      {icon}
    </Box>

    <Typography
      sx={{
        fontSize: 14,
        fontWeight: 700,
        color: COLORS.text
      }}
    >
      {title}
    </Typography>

    <Typography
      sx={{
        mt: 0.5,
        fontSize: 12,
        color: COLORS.textMuted,
        maxWidth: 300,
        mx: 'auto'
      }}
    >
      {description}
    </Typography>
  </Box>
);

const RoomIdentity = ({
  roomNumber,
  floor,
  roomType
}: {
  roomNumber: string;
  floor?: number;
  roomType?: string;
}) => (
  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
    <Box
      sx={{
        width: 42,
        height: 42,
        flexShrink: 0,
        borderRadius: 2,
        display: 'grid',
        placeItems: 'center',
        background: '#EEF3F7',
        color: COLORS.navy
      }}
    >
      <HotelRoundedIcon fontSize="small" />
    </Box>

    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{
          fontSize: 14,
          fontWeight: 800,
          color: COLORS.text
        }}
      >
        Room {roomNumber}
      </Typography>

      <Typography
        sx={{
          fontSize: 12,
          color: COLORS.textMuted,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {roomType || 'Room'} {floor ? ` · Floor ${floor}` : ''}
      </Typography>
    </Box>
  </Stack>
);

/** A person assigned to a task, as returned on HousekeepingTask.assignedTo. */
type TaskAssignee = { id: string; firstName: string; lastName: string };

const StaffAvatars = ({
  staff
}: {
  staff: TaskAssignee[];
}) => (
  <Stack direction="row" alignItems="center">
    {staff.slice(0, 3).map((person, index) => (
      <Box
        key={person.id}
        title={`${person.firstName} ${person.lastName}`.trim()}
        sx={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          ml: index === 0 ? 0 : -0.75,
          border: '2px solid white',
          background: index % 2 === 0 ? COLORS.navy : COLORS.gold,
          color: '#fff',
          fontSize: 11,
          fontWeight: 800,
          zIndex: 5 - index
        }}
      >
        {`${person.firstName?.[0] || ''}${person.lastName?.[0] || ''}`}
      </Box>
    ))}

    {staff.length > 3 && (
      <Box
        sx={{
          width: 30,
          height: 30,
          ml: -0.75,
          borderRadius: '50%',
          border: '2px solid white',
          display: 'grid',
          placeItems: 'center',
          background: '#E8EDF2',
          color: COLORS.textMuted,
          fontSize: 10,
          fontWeight: 800
        }}
      >
        +{staff.length - 3}
      </Box>
    )}
  </Stack>
);

/* -------------------------------------------------------------------------- */
/*                         MAIN HOUSEKEEPING PAGE                             */
/* -------------------------------------------------------------------------- */

const HousekeepingManagerDashboard = () => {
  const { on } = useWebSocket();

  const [dirtyRooms, setDirtyRooms] = useState<DirtyRoom[]>([]);
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [assignRoom, setAssignRoom] = useState<DirtyRoom | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [priority, setPriority] =
    useState<HousekeepingPriority>('MEDIUM');
  const [assignNotes, setAssignNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [rejectTask, setRejectTask] =
    useState<HousekeepingTask | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    }

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
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load housekeeping data'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const events = [
      'housekeeping.room_dirty',
      'housekeeping.task.assigned',
      'housekeeping.task.started',
      'housekeeping.task.completed',
      'housekeeping.task.approved',
      'housekeeping.task.rejected'
    ];

    const unsubscribers = events.map((event) =>
      on(event, () => void load())
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, [on, load]);

  const awaitingApproval = useMemo(
    () => tasks.filter((task) => task.status === 'DONE'),
    [tasks]
  );

  const inFlight = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status === 'PENDING' ||
          task.status === 'IN_PROGRESS'
      ),
    [tasks]
  );

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
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to assign task'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (task: HousekeepingTask) => {
    try {
      await housekeepingService.approveTask(task.id);

      setToast(
        `Room ${task.room.roomNumber} approved and returned to inventory`
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to approve task'
      );
    }
  };

  const handleReject = async () => {
    if (!rejectTask || !rejectReason.trim()) {
      return;
    }

    try {
      await housekeepingService.rejectTask(
        rejectTask.id,
        rejectReason.trim()
      );

      setToast(
        `Room ${rejectTask.room.roomNumber} sent back for redo`
      );

      setRejectTask(null);
      setRejectReason('');

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to reject task'
      );
    }
  };

  if (loading) {
    return (
      <Layout>
        <Box
          sx={{
            minHeight: 'calc(100vh - 90px)',
            display: 'grid',
            placeItems: 'center',
            background: COLORS.background
          }}
        >
          <Stack spacing={2} alignItems="center">
            <CircularProgress
              size={34}
              thickness={4}
              sx={{ color: COLORS.navy }}
            />

            <Typography
              sx={{
                fontSize: 13,
                color: COLORS.textMuted
              }}
            >
              Loading housekeeping operations...
            </Typography>
          </Stack>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box
        sx={{
          minHeight: '100%',
          background: COLORS.background
        }}
      >
        <Container
          maxWidth="xl"
          sx={{
            py: { xs: 2.5, md: 4 },
            px: { xs: 2, md: 3 }
          }}
        >
          {/* ---------------------------------------------------------------- */}
          {/* PAGE HEADER                                                      */}
          {/* ---------------------------------------------------------------- */}

          <Box
            sx={{
              mb: 3,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              gap: 2,
              flexDirection: { xs: 'column', md: 'row' }
            }}
          >
            <Box>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 0.75 }}
              >
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '.12em',
                    color: COLORS.gold,
                    textTransform: 'uppercase'
                  }}
                >
                  OPERATIONS
                </Typography>

                <Box
                  sx={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: COLORS.gold
                  }}
                />

                <Typography
                  sx={{
                    fontSize: 11,
                    color: COLORS.textMuted
                  }}
                >
                  Live
                </Typography>
              </Stack>

              <Typography
                sx={{
                  fontSize: { xs: 27, md: 32 },
                  fontWeight: 800,
                  letterSpacing: '-.03em',
                  color: COLORS.text
                }}
              >
                Housekeeping
              </Typography>

              <Typography
                sx={{
                  mt: 0.5,
                  fontSize: 13,
                  color: COLORS.textMuted
                }}
              >
                Manage room cleaning, assignments and final inspections.
              </Typography>
            </Box>

            <Button
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={() => void load(true)}
              disabled={refreshing}
              sx={{
                minHeight: 42,
                px: 2,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                borderColor: '#D5DEE7',
                color: COLORS.navy,
                background: '#fff',
                '&:hover': {
                  borderColor: COLORS.navy,
                  background: '#F8FAFC'
                }
              }}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                borderRadius: 2,
                border: '1px solid #F1C6C2'
              }}
              onClose={() => setError('')}
            >
              {error}
            </Alert>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* KPI CARDS                                                        */}
          {/* ---------------------------------------------------------------- */}

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} lg={3}>
              <StatCard
                label="Dirty Rooms"
                value={dirtyRooms.length}
                helper="Waiting for assignment"
                tone="gold"
                icon={<CleaningServicesRoundedIcon />}
              />
            </Grid>

            <Grid item xs={12} sm={6} lg={3}>
              <StatCard
                label="In Progress"
                value={inFlight.length}
                helper="Currently being cleaned"
                tone="blue"
                icon={<PendingActionsRoundedIcon />}
              />
            </Grid>

            <Grid item xs={12} sm={6} lg={3}>
              <StatCard
                label="Awaiting Approval"
                value={awaitingApproval.length}
                helper="Ready for inspection"
                tone="green"
                icon={<DoneAllRoundedIcon />}
              />
            </Grid>

            <Grid item xs={12} sm={6} lg={3}>
              <StatCard
                label="Housekeepers"
                value={housekeepers.length}
                helper="Available staff"
                tone="navy"
                icon={<GroupsRoundedIcon />}
              />
            </Grid>
          </Grid>

          {/* ---------------------------------------------------------------- */}
          {/* MAIN OPERATIONS GRID                                             */}
          {/* ---------------------------------------------------------------- */}

          <Grid container spacing={2.5}>
            {/* -------------------------------------------------------------- */}
            {/* DIRTY ROOMS                                                     */}
            {/* -------------------------------------------------------------- */}

            <Grid item xs={12} lg={5}>
              <Paper
                elevation={0}
                sx={{
                  height: '100%',
                  overflow: 'hidden',
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 3,
                  background: COLORS.surface,
                  boxShadow: '0 4px 18px rgba(20, 48, 73, 0.035)'
                }}
              >
                <SectionHeader
                  title="Dirty Rooms"
                  subtitle="Rooms awaiting housekeeping assignment"
                  count={dirtyRooms.length}
                  accent={COLORS.amber}
                  icon={<CleaningServicesRoundedIcon />}
                />

                {dirtyRooms.length === 0 ? (
                  <EmptyState
                    icon={<CheckCircleRoundedIcon />}
                    title="All rooms are assigned"
                    description="There are currently no dirty rooms waiting for housekeeping assignment."
                  />
                ) : (
                  <Stack spacing={0} divider={<Divider />}>
                    {dirtyRooms.map((room) => (
                      <Box
                        key={room.id}
                        sx={{
                          p: 2,
                          transition: 'background .18s ease',
                          '&:hover': {
                            background: '#FAFBFC'
                          }
                        }}
                      >
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          alignItems={{ xs: 'stretch', sm: 'center' }}
                          spacing={2}
                        >
                          <Box sx={{ flex: 1 }}>
                            <RoomIdentity
                              roomNumber={room.roomNumber}
                              floor={room.floor}
                              roomType={room.roomType}
                            />
                          </Box>

                          <Chip
                            size="small"
                            label="DIRTY"
                            sx={{
                              width: 'fit-content',
                              height: 25,
                              fontSize: 10,
                              fontWeight: 800,
                              color: COLORS.amber,
                              background: COLORS.amberBg,
                              border: `1px solid #F0D6A9`
                            }}
                          />

                          <Button
                            variant="contained"
                            endIcon={<ArrowForwardRoundedIcon />}
                            onClick={() => {
                              setAssignRoom(room);
                              setSelectedStaff([]);
                              setPriority('MEDIUM');
                              setAssignNotes('');
                            }}
                            sx={{
                              minWidth: 105,
                              minHeight: 38,
                              borderRadius: 1.75,
                              textTransform: 'none',
                              fontSize: 12,
                              fontWeight: 800,
                              background: COLORS.navy,
                              boxShadow: 'none',
                              '&:hover': {
                                background: COLORS.navyDark,
                                boxShadow:
                                  '0 6px 14px rgba(18, 52, 82, .18)'
                              }
                            }}
                          >
                            Assign
                          </Button>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Grid>

            {/* -------------------------------------------------------------- */}
            {/* RIGHT SIDE                                                       */}
            {/* -------------------------------------------------------------- */}

            <Grid item xs={12} lg={7}>
              <Stack spacing={2.5}>
                {/* ---------------------------------------------------------- */}
                {/* AWAITING APPROVAL                                           */}
                {/* ---------------------------------------------------------- */}

                <Paper
                  elevation={0}
                  sx={{
                    overflow: 'hidden',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 3,
                    background: COLORS.surface,
                    boxShadow:
                      '0 4px 18px rgba(20, 48, 73, 0.035)'
                  }}
                >
                  <SectionHeader
                    title="Awaiting Approval"
                    subtitle="Completed rooms requiring final inspection"
                    count={awaitingApproval.length}
                    accent={COLORS.green}
                    icon={<DoneAllRoundedIcon />}
                  />

                  {awaitingApproval.length === 0 ? (
                    <EmptyState
                      icon={<DoneAllRoundedIcon />}
                      title="Nothing requires approval"
                      description="Completed housekeeping tasks will appear here for final inspection."
                    />
                  ) : (
                    <Stack spacing={0} divider={<Divider />}>
                      {awaitingApproval.map((task) => (
                        <Box
                          key={task.id}
                          sx={{
                            p: 2,
                            transition: 'background .18s ease',
                            '&:hover': {
                              background: '#FAFBFC'
                            }
                          }}
                        >
                          <Stack
                            direction={{
                              xs: 'column',
                              md: 'row'
                            }}
                            spacing={2}
                            alignItems={{
                              xs: 'stretch',
                              md: 'center'
                            }}
                          >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <RoomIdentity
                                roomNumber={task.room.roomNumber}
                                floor={task.room.floor}
                                roomType={task.room.roomType}
                              />

                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                sx={{ mt: 1 }}
                              >
                                <StaffAvatars
                                  staff={task.assignedTo}
                                />

                                <Typography
                                  sx={{
                                    fontSize: 11,
                                    color: COLORS.textMuted
                                  }}
                                >
                                  {task.assignedTo
                                    .map(
                                      (s) =>
                                        `${s.firstName} ${s.lastName}`
                                    )
                                    .join(', ') || 'Unassigned'}
                                </Typography>
                              </Stack>

                              {task.notes && (
                                <Typography
                                  sx={{
                                    mt: 1,
                                    fontSize: 11,
                                    color: COLORS.textMuted,
                                    fontStyle: 'italic'
                                  }}
                                >
                                  “{task.notes}”
                                </Typography>
                              )}
                            </Box>

                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{
                                width: {
                                  xs: '100%',
                                  md: 'auto'
                                }
                              }}
                            >
                              <Button
                                fullWidth
                                variant="contained"
                                color="success"
                                startIcon={
                                  <CheckCircleRoundedIcon />
                                }
                                onClick={() =>
                                  void handleApprove(task)
                                }
                                sx={{
                                  minHeight: 38,
                                  borderRadius: 1.75,
                                  textTransform: 'none',
                                  fontWeight: 800,
                                  boxShadow: 'none'
                                }}
                              >
                                Approve
                              </Button>

                              <Button
                                fullWidth
                                variant="outlined"
                                color="error"
                                startIcon={
                                  <CancelRoundedIcon />
                                }
                                onClick={() => {
                                  setRejectTask(task);
                                  setRejectReason('');
                                }}
                                sx={{
                                  minHeight: 38,
                                  borderRadius: 1.75,
                                  textTransform: 'none',
                                  fontWeight: 800
                                }}
                              >
                                Reject
                              </Button>
                            </Stack>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Paper>

                {/* ---------------------------------------------------------- */}
                {/* IN PROGRESS                                                  */}
                {/* ---------------------------------------------------------- */}

                <Paper
                  elevation={0}
                  sx={{
                    overflow: 'hidden',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 3,
                    background: COLORS.surface,
                    boxShadow:
                      '0 4px 18px rgba(20, 48, 73, 0.035)'
                  }}
                >
                  <SectionHeader
                    title="In Progress"
                    subtitle="Rooms currently assigned and being cleaned"
                    count={inFlight.length}
                    accent={COLORS.blue}
                    icon={<PendingActionsRoundedIcon />}
                  />

                  {inFlight.length === 0 ? (
                    <EmptyState
                      icon={<AssignmentRoundedIcon />}
                      title="No active cleaning tasks"
                      description="Assigned housekeeping work will appear here once cleaning begins."
                    />
                  ) : (
                    <Stack spacing={0} divider={<Divider />}>
                      {inFlight.map((task) => (
                        <Box
                          key={task.id}
                          sx={{
                            p: 2,
                            transition: 'background .18s ease',
                            '&:hover': {
                              background: '#FAFBFC'
                            }
                          }}
                        >
                          <Stack
                            direction={{
                              xs: 'column',
                              md: 'row'
                            }}
                            alignItems={{
                              xs: 'stretch',
                              md: 'center'
                            }}
                            spacing={2}
                          >
                            <Box sx={{ flex: 1 }}>
                              <RoomIdentity
                                roomNumber={task.room.roomNumber}
                                floor={task.room.floor}
                                roomType={task.room.roomType}
                              />
                            </Box>

                            <Stack
                              direction="row"
                              spacing={1}
                              flexWrap="wrap"
                              useFlexGap
                            >
                              <Chip
                                size="small"
                                label={
                                  TASK_STATUS_LABEL[
                                    task.status
                                  ]
                                }
                                color={
                                  TASK_STATUS_COLOR[
                                    task.status
                                  ]
                                }
                                sx={{
                                  fontSize: 10,
                                  fontWeight: 800
                                }}
                              />

                              <Chip
                                size="small"
                                variant="outlined"
                                icon={
                                  task.priority ===
                                    'HIGH' ||
                                  task.priority ===
                                    'URGENT' ? (
                                    <PriorityHighRoundedIcon />
                                  ) : undefined
                                }
                                label={task.priority}
                                color={
                                  PRIORITY_COLOR[
                                    task.priority
                                  ]
                                }
                                sx={{
                                  fontSize: 10,
                                  fontWeight: 800
                                }}
                              />
                            </Stack>

                            <Box
                              sx={{
                                minWidth: {
                                  xs: 'auto',
                                  md: 130
                                }
                              }}
                            >
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                              >
                                <StaffAvatars
                                  staff={task.assignedTo}
                                />

                                <Typography
                                  sx={{
                                    fontSize: 11,
                                    color: COLORS.textMuted
                                  }}
                                >
                                  {task.assignedTo
                                    .map(
                                      (s) =>
                                        s.firstName
                                    )
                                    .join(', ') || '—'}
                                </Typography>
                              </Stack>
                            </Box>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Stack>
            </Grid>
          </Grid>

          {/* ---------------------------------------------------------------- */}
          {/* WORKFLOW FOOTER                                                  */}
          {/* ---------------------------------------------------------------- */}

          <Paper
            elevation={0}
            sx={{
              mt: 2.5,
              p: 2,
              borderRadius: 3,
              border: `1px solid ${COLORS.border}`,
              background: '#FBFCFD'
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'flex-start', md: 'center' }}
            >
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  background: COLORS.navy,
                  color: '#fff'
                }}
              >
                <CleaningServicesRoundedIcon fontSize="small" />
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography
                  sx={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: COLORS.text
                  }}
                >
                  Housekeeping workflow
                </Typography>

                <Typography
                  sx={{
                    mt: 0.25,
                    fontSize: 11,
                    color: COLORS.textMuted
                  }}
                >
                  Dirty rooms are assigned to staff → cleaning is
                  completed → manager inspects → room returns to
                  sellable inventory.
                </Typography>
              </Box>

              <Chip
                label="LIVE UPDATES ENABLED"
                size="small"
                sx={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '.05em',
                  color: COLORS.green,
                  background: COLORS.greenBg,
                  border: `1px solid #C9E9DC`
                }}
              />
            </Stack>
          </Paper>
        </Container>
      </Box>

      {/* ================================================================== */}
      {/* ASSIGN ROOM DIALOG                                                  */}
      {/* ================================================================== */}

      <Dialog
        open={Boolean(assignRoom)}
        onClose={() => setAssignRoom(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden'
          }
        }}
      >
        <Box
          sx={{
            px: 3,
            py: 2.5,
            background: COLORS.navy,
            color: '#fff'
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255,255,255,.12)'
              }}
            >
              <CleaningServicesRoundedIcon />
            </Box>

            <Box>
              <Typography
                sx={{
                  fontSize: 18,
                  fontWeight: 800
                }}
              >
                Assign Room {assignRoom?.roomNumber}
              </Typography>

              <Typography
                sx={{
                  mt: 0.25,
                  fontSize: 12,
                  color: 'rgba(255,255,255,.7)'
                }}
              >
                Assign housekeeping staff and set task priority.
              </Typography>
            </Box>
          </Stack>
        </Box>

        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography
                sx={{
                  mb: 1,
                  fontSize: 12,
                  fontWeight: 800,
                  color: COLORS.text
                }}
              >
                HOUSEKEEPERS
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
                    .filter((person) =>
                      selected.includes(person.id)
                    )
                    .map((person) => person.name)
                    .join(', ')
                }
                displayEmpty
                sx={{
                  borderRadius: 2
                }}
              >
                {housekeepers.length === 0 && (
                  <MenuItem disabled value="">
                    No housekeeping staff found
                  </MenuItem>
                )}

                {housekeepers.map((person) => (
                  <MenuItem
                    key={person.id}
                    value={person.id}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1.5}
                      sx={{ width: '100%' }}
                    >
                      <Box
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          background: COLORS.navy,
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 800
                        }}
                      >
                        {person.name
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join('')
                          .toUpperCase()}
                      </Box>

                      <Box sx={{ flex: 1 }}>
                        <Typography
                          sx={{
                            fontSize: 13,
                            fontWeight: 700
                          }}
                        >
                          {person.name}
                        </Typography>

                        <Typography
                          sx={{
                            fontSize: 11,
                            color: COLORS.textMuted
                          }}
                        >
                          {person.openTasks} open tasks
                        </Typography>
                      </Box>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <TextField
              select
              label="Priority"
              value={priority}
              onChange={(event) =>
                setPriority(
                  event.target.value as HousekeepingPriority
                )
              }
              fullWidth
            >
              {(
                ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
              ).map((level) => (
                <MenuItem key={level} value={level}>
                  {level}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Notes"
              placeholder="Add instructions for the housekeeping team..."
              value={assignNotes}
              onChange={(event) =>
                setAssignNotes(event.target.value)
              }
              fullWidth
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            py: 2,
            borderTop: `1px solid ${COLORS.border}`,
            background: '#FAFBFC'
          }}
        >
          <Button
            onClick={() => setAssignRoom(null)}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              color: COLORS.textMuted
            }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={() => void handleAssign()}
            disabled={selectedStaff.length === 0 || saving}
            sx={{
              minWidth: 110,
              minHeight: 40,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 800,
              background: COLORS.navy,
              boxShadow: 'none'
            }}
          >
            {saving ? 'Assigning...' : 'Assign Room'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ================================================================== */}
      {/* REJECT DIALOG                                                       */}
      {/* ================================================================== */}

      <Dialog
        open={Boolean(rejectTask)}
        onClose={() => setRejectTask(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden'
          }
        }}
      >
        <Box
          sx={{
            px: 3,
            py: 2.5,
            background: COLORS.redBg,
            borderBottom: `1px solid #F2D0CD`
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                color: COLORS.red,
                background: '#fff'
              }}
            >
              <CancelRoundedIcon />
            </Box>

            <Box>
              <Typography
                sx={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: COLORS.text
                }}
              >
                Reject Room {rejectTask?.room.roomNumber}
              </Typography>

              <Typography
                sx={{
                  mt: 0.25,
                  fontSize: 12,
                  color: COLORS.textMuted
                }}
              >
                Provide a reason so the housekeeper can correct
                the issue.
              </Typography>
            </Box>
          </Stack>
        </Box>

        <DialogContent sx={{ p: 3 }}>
          <TextField
            label="Reason for rejection"
            placeholder="Describe what needs to be corrected..."
            value={rejectReason}
            onChange={(event) =>
              setRejectReason(event.target.value)
            }
            fullWidth
            required
            multiline
            minRows={4}
            autoFocus
          />
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            py: 2,
            borderTop: `1px solid ${COLORS.border}`,
            background: '#FAFBFC'
          }}
        >
          <Button
            onClick={() => setRejectTask(null)}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              color: COLORS.textMuted
            }}
          >
            Cancel
          </Button>

          <Button
            color="error"
            variant="contained"
            onClick={() => void handleReject()}
            disabled={!rejectReason.trim()}
            sx={{
              minWidth: 110,
              minHeight: 40,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 800,
              boxShadow: 'none'
            }}
          >
            Send Back
          </Button>
        </DialogActions>
      </Dialog>

      {/* ================================================================== */}
      {/* TOAST                                                               */}
      {/* ================================================================== */}

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3500}
        onClose={() => setToast('')}
        message={toast}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center'
        }}
        sx={{
          '& .MuiSnackbarContent-root': {
            borderRadius: 2,
            background: COLORS.navy,
            fontWeight: 600
          }
        }}
      />
    </Layout>
  );
};

export default HousekeepingManagerDashboard;