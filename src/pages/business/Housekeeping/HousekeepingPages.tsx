import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Container,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import Layout from '../../../components/Layout';
import {
  HousekeepingTaskRecord,
  LostFoundRecord,
  RoomRecord,
  housekeepingOpsService,
  roomOpsService
} from '../../../services/operations';

const priorityColor = (priority: HousekeepingTaskRecord['priority']) => {
  if (priority === 'HIGH') return 'error';
  if (priority === 'MEDIUM') return 'warning';
  return 'info';
};

const statusColor = (status: string) => {
  if (status === 'DONE' || status === 'INSPECTED' || status === 'READY') return 'success';
  if (status === 'IN_PROGRESS' || status === 'CLEANING') return 'warning';
  if (status === 'DIRTY' || status === 'OUT_OF_ORDER') return 'error';
  return 'info';
};

export const HousekeepingTaskBoardPage = () => {
  const [tasks, setTasks] = useState<HousekeepingTaskRecord[]>([]);
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [roomId, setRoomId] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<HousekeepingTaskRecord['priority']>('MEDIUM');

  const load = async () => {
    const [taskRows, roomRows] = await Promise.all([
      housekeepingOpsService.listTasks(),
      roomOpsService.listRooms()
    ]);

    setTasks(taskRows);
    setRooms(roomRows);

    if (!roomId && roomRows[0]) {
      setRoomId(roomRows[0].id);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    return {
      TODO: tasks.filter((task) => task.status === 'TODO'),
      IN_PROGRESS: tasks.filter((task) => task.status === 'IN_PROGRESS'),
      DONE: tasks.filter((task) => task.status === 'DONE')
    };
  }, [tasks]);

  const addTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const room = rooms.find((entry) => entry.id === roomId);
    if (!room || !title.trim()) {
      return;
    }

    housekeepingOpsService.addTask({
      roomId: room.id,
      roomNumber: room.roomNumber,
      title: title.trim(),
      priority
    });

    setTitle('');
    void load();
  };

  const moveTask = (taskId: string, nextStatus: HousekeepingTaskRecord['status']) => {
    housekeepingOpsService.updateTask(taskId, { status: nextStatus });
    void load();
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Housekeeping Task Board</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Kanban workflow for room operations tasks.
        </Typography>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Box component="form" onSubmit={addTask}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                select
                label="Room"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                sx={{ minWidth: 200 }}
              >
                {rooms.map((room) => (
                  <MenuItem key={room.id} value={room.id}>{room.roomNumber}</MenuItem>
                ))}
              </TextField>
              <TextField label="Task" value={title} onChange={(event) => setTitle(event.target.value)} fullWidth />
              <TextField
                select
                label="Priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as HousekeepingTaskRecord['priority'])}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="LOW">LOW</MenuItem>
                <MenuItem value="MEDIUM">MEDIUM</MenuItem>
                <MenuItem value="HIGH">HIGH</MenuItem>
              </TextField>
              <Button type="submit" variant="contained">Add Task</Button>
            </Stack>
          </Box>
        </Paper>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          {(['TODO', 'IN_PROGRESS', 'DONE'] as const).map((column) => (
            <Paper key={column} sx={{ flex: 1, p: 2, minHeight: 300 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>{column.replace('_', ' ')}</Typography>

              <Stack spacing={1.5}>
                {grouped[column].map((task) => (
                  <Paper key={task.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography sx={{ fontWeight: 700 }}>{task.roomNumber}</Typography>
                    <Typography variant="body2" color="text.secondary">{task.title}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Chip size="small" label={task.priority} color={priorityColor(task.priority) as 'default'} />
                      <Chip size="small" label={task.status} color={statusColor(task.status) as 'default'} />
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
                      {task.status !== 'TODO' && (
                        <Button size="small" onClick={() => moveTask(task.id, 'TODO')}>To Do</Button>
                      )}
                      {task.status !== 'IN_PROGRESS' && (
                        <Button size="small" onClick={() => moveTask(task.id, 'IN_PROGRESS')}>Start</Button>
                      )}
                      {task.status !== 'DONE' && (
                        <Button size="small" color="success" onClick={() => moveTask(task.id, 'DONE')}>Done</Button>
                      )}
                    </Stack>
                  </Paper>
                ))}
                {grouped[column].length === 0 && (
                  <Typography variant="body2" color="text.secondary">No tasks</Typography>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Container>
    </Layout>
  );
};

export const RoomStatusUpdatePage = () => {
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [filter, setFilter] = useState('ALL');

  const load = async () => setRooms(await roomOpsService.listRooms());

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    if (filter === 'ALL') {
      return rooms;
    }
    return rooms.filter((room) => room.status === filter);
  }, [rooms, filter]);

  const setStatus = async (roomId: string, status: string) => {
    await roomOpsService.updateRoomStatus(roomId, status);
    await load();
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Room Status Update</Typography>
            <Typography variant="body2" color="text.secondary">Tap room cards to push housekeeping status updates.</Typography>
          </Box>
          <TextField select size="small" label="Filter" value={filter} onChange={(event) => setFilter(event.target.value)} sx={{ minWidth: 190 }}>
            <MenuItem value="ALL">All</MenuItem>
            <MenuItem value="DIRTY">Dirty</MenuItem>
            <MenuItem value="CLEANING">Cleaning</MenuItem>
            <MenuItem value="AVAILABLE">Available</MenuItem>
            <MenuItem value="OUT_OF_ORDER">Out Of Order</MenuItem>
          </TextField>
        </Stack>

        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {visible.map((room) => (
            <Paper key={room.id} sx={{ p: 2, width: 220 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{room.roomNumber}</Typography>
              <Typography variant="body2" color="text.secondary">{room.roomType}</Typography>
              <Chip sx={{ mt: 1.2 }} label={room.status} color={statusColor(room.status) as 'default'} />
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                <Button size="small" onClick={() => void setStatus(room.id, 'DIRTY')}>Dirty</Button>
                <Button size="small" onClick={() => void setStatus(room.id, 'CLEANING')}>Cleaning</Button>
                <Button size="small" onClick={() => void setStatus(room.id, 'AVAILABLE')}>Inspected/Ready</Button>
                <Button size="small" color="error" onClick={() => void setStatus(room.id, 'OUT_OF_ORDER')}>Out of Order</Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Container>
    </Layout>
  );
};

export const InspectionViewPage = () => {
  const [rooms, setRooms] = useState<RoomRecord[]>([]);

  const load = async () => setRooms(await roomOpsService.listRooms());

  useEffect(() => {
    void load();
  }, []);

  const inspectionQueue = rooms.filter((room) => room.status === 'CLEANING' || room.status === 'DIRTY');

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Inspection View</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Supervisor inspection queue for room release readiness.
        </Typography>

        <Paper>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f7fa' }}>
                <TableCell sx={{ fontWeight: 700 }}>Room</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inspectionQueue.map((room) => (
                <TableRow key={room.id}>
                  <TableCell>{room.roomNumber}</TableCell>
                  <TableCell>{room.roomType}</TableCell>
                  <TableCell>
                    <Chip size="small" label={room.status} color={statusColor(room.status) as 'default'} />
                  </TableCell>
                  <TableCell>
                    <Button size="small" variant="contained" onClick={() => void roomOpsService.updateRoomStatus(room.id, 'AVAILABLE').then(() => void load())}>
                      Mark Inspected
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {inspectionQueue.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                      No rooms pending inspection.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      </Container>
    </Layout>
  );
};

export const LostAndFoundPage = () => {
  const [rows, setRows] = useState<LostFoundRecord[]>([]);
  const [roomNumber, setRoomNumber] = useState('');
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');

  const load = () => setRows(housekeepingOpsService.listLostFound());

  useEffect(() => {
    load();
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!roomNumber.trim() || !itemName.trim()) {
      return;
    }

    housekeepingOpsService.addLostFound({
      roomNumber: roomNumber.trim(),
      itemName: itemName.trim(),
      description: description.trim() || undefined
    });

    setRoomNumber('');
    setItemName('');
    setDescription('');
    load();
  };

  const updateStatus = (recordId: string, status: LostFoundRecord['status']) => {
    housekeepingOpsService.updateLostFoundStatus(recordId, status);
    load();
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Lost & Found</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Record, track and close lost-and-found cases.
        </Typography>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Box component="form" onSubmit={submit}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label="Room Number" value={roomNumber} onChange={(event) => setRoomNumber(event.target.value)} required />
              <TextField label="Item" value={itemName} onChange={(event) => setItemName(event.target.value)} required />
              <TextField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} fullWidth />
              <Button type="submit" variant="contained">Record Item</Button>
            </Stack>
          </Box>
        </Paper>

        <Paper>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f7fa' }}>
                <TableCell sx={{ fontWeight: 700 }}>Room</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.roomNumber}</TableCell>
                  <TableCell>{row.itemName}</TableCell>
                  <TableCell>{row.description || '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={row.status} color={statusColor(row.status) as 'default'} />
                  </TableCell>
                  <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => updateStatus(row.id, 'RETURNED')}>Returned</Button>
                      <Button size="small" color="warning" onClick={() => updateStatus(row.id, 'DISPOSED')}>Disposed</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                      No lost-and-found records yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      </Container>
    </Layout>
  );
};
