import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import DataTable from '../../../components/common/DataTable';
import { useWebSocket } from '../../../hooks/useWebSocket';
import {
  ReservationRecord,
  RoomRecord,
  RoomTypeRecord,
  reservationOpsService,
  roomOpsService
} from '../../../services/operations';

const roomStatusColor = (status: string) => {
  if (status === 'AVAILABLE' || status === 'READY') return 'success';
  if (status === 'OCCUPIED') return 'info';
  if (status === 'CLEANING') return 'warning';
  if (status === 'MAINTENANCE') return 'error';
  if (status === 'RESERVED') return 'secondary';
  return 'default';
};

export const RoomListPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [roomNumber, setRoomNumber] = useState('');
  const [roomType, setRoomType] = useState('Standard');
  const [floor, setFloor] = useState(1);
  const [rate, setRate] = useState(0);
  const [status, setStatus] = useState('AVAILABLE');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setRooms(await roomOpsService.listRooms());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await roomOpsService.createRoom({ roomNumber, roomType, floor, rate, status });
      setRoomNumber('');
      setFloor(1);
      setRate(0);
      setStatus('AVAILABLE');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    }
  };

  const updateStatus = async (roomId: string, nextStatus: string) => {
    try {
      await roomOpsService.updateRoomStatus(roomId, nextStatus);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update room status');
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Room List</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Room inventory and status operations wired to room APIs.
        </Typography>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Paper sx={{ p: 2, mb: 2 }}>
          <Box component="form" onSubmit={createRoom}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label="Room Number" value={roomNumber} onChange={(event) => setRoomNumber(event.target.value)} required />
              <TextField label="Room Type" value={roomType} onChange={(event) => setRoomType(event.target.value)} required />
              <TextField label="Floor" type="number" value={floor} onChange={(event) => setFloor(Number(event.target.value))} required />
              <TextField label="Rate" type="number" value={rate} onChange={(event) => setRate(Number(event.target.value))} required />
              <TextField select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <MenuItem value="AVAILABLE">AVAILABLE</MenuItem>
                <MenuItem value="OCCUPIED">OCCUPIED</MenuItem>
                <MenuItem value="CLEANING">CLEANING</MenuItem>
                <MenuItem value="MAINTENANCE">MAINTENANCE</MenuItem>
                <MenuItem value="RESERVED">RESERVED</MenuItem>
              </TextField>
              <Button type="submit" variant="contained">Create Room</Button>
            </Stack>
          </Box>
        </Paper>

        <DataTable
          rows={rooms}
          rowKey={(room) => room.id}
          defaultRowsPerPage={10}
          emptyText={loading ? 'Loading rooms...' : 'No rooms found.'}
          columns={[
            { key: 'roomNumber', label: 'Room', minWidth: 120 },
            { key: 'roomType', label: 'Type', minWidth: 140 },
            { key: 'floor', label: 'Floor', minWidth: 90 },
            {
              key: 'rate',
              label: 'Rate',
              minWidth: 130,
              render: (room) => `₦${room.rate.toLocaleString()}`
            },
            {
              key: 'status',
              label: 'Status',
              minWidth: 140,
              render: (room) => (
                <Chip size="small" label={room.status} color={roomStatusColor(room.status) as 'default'} />
              )
            },
            {
              key: 'actions',
              label: 'Action',
              minWidth: 220,
              render: (room) => (
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => navigate(`/business/rooms/${room.id}`)}>Detail</Button>
                  <Button size="small" onClick={() => void updateStatus(room.id, 'AVAILABLE')}>Ready</Button>
                  <Button size="small" color="warning" onClick={() => void updateStatus(room.id, 'CLEANING')}>Dirty</Button>
                </Stack>
              )
            }
          ]}
        />
      </Container>
    </Layout>
  );
};

export const RoomDetailPage = () => {
  const { id } = useParams();
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [roomRows, reservationRows] = await Promise.all([
        roomOpsService.listRooms(),
        reservationOpsService.listReservations()
      ]);

      const selectedRoom = roomRows.find((entry) => entry.id === id) || null;
      setRoom(selectedRoom);
      setReservations(reservationRows.filter((reservation) => reservation.roomNumber === selectedRoom?.roomNumber));
      setLoading(false);
    };

    void load();
  }, [id]);

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {loading && <LogoLoader inline minHeight={160} />}

        {room && (
          <Stack spacing={2}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{`Room ${room.roomNumber}`}</Typography>
              <Stack spacing={1.2} sx={{ mt: 2 }}>
                <Typography><strong>Type:</strong> {room.roomType}</Typography>
                <Typography><strong>Floor:</strong> {room.floor}</Typography>
                <Typography><strong>Rate:</strong> ₦{room.rate.toLocaleString()}</Typography>
                <Typography><strong>Status:</strong> {room.status}</Typography>
              </Stack>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Reservation History</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Booking #</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Guest</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Check In</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Check Out</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reservations.map((reservation) => (
                    <TableRow key={reservation.id}>
                      <TableCell>{reservation.bookingNumber}</TableCell>
                      <TableCell>{reservation.guestName}</TableCell>
                      <TableCell>{new Date(reservation.checkIn).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(reservation.checkOut).toLocaleDateString()}</TableCell>
                      <TableCell>{reservation.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Stack>
        )}
      </Container>
    </Layout>
  );
};

export const RoomTypeListPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RoomTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await roomOpsService.listRoomTypes());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load room types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggle = async (row: RoomTypeRecord) => {
    await roomOpsService.updateRoomType(row.id, { isActive: !row.isActive });
    await load();
  };

  const remove = async (roomTypeId: string) => {
    await roomOpsService.deleteRoomType(roomTypeId);
    await load();
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Room Types</Typography>
            <Typography variant="body2" color="text.secondary">Room configuration catalog for PMS setup.</Typography>
          </Box>
          <Button variant="contained" onClick={() => navigate('/business/rooms/types/create')}>Add Room Type</Button>
        </Stack>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          defaultRowsPerPage={10}
          emptyText="No room types configured."
          columns={[
            { key: 'code', label: 'Code', minWidth: 100 },
            { key: 'name', label: 'Name', minWidth: 180 },
            {
              key: 'occupancy',
              label: 'Occupancy',
              minWidth: 200,
              render: (row) => `${row.maxAdults} adults / ${row.maxChildren} children`
            },
            {
              key: 'baseRate',
              label: 'Base Rate',
              minWidth: 140,
              render: (row) => `₦${row.baseRate.toLocaleString()}`
            },
            {
              key: 'isActive',
              label: 'Active',
              minWidth: 100,
              render: (row) => (row.isActive ? 'Yes' : 'No')
            },
            {
              key: 'actions',
              label: 'Action',
              minWidth: 240,
              render: (row) => (
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => navigate(`/business/rooms/types/${row.id}/edit`)}>Edit</Button>
                  <Button size="small" onClick={() => void toggle(row)}>{row.isActive ? 'Deactivate' : 'Activate'}</Button>
                  <Button size="small" color="error" onClick={() => void remove(row.id)}>Delete</Button>
                </Stack>
              )
            }
          ]}
        />
      </Container>
    </Layout>
  );
};

const RoomTypeForm = ({
  initial,
  onSubmit,
  submitLabel
}: {
  initial?: Partial<RoomTypeRecord>;
  onSubmit: (payload: Omit<RoomTypeRecord, 'id'>) => void | Promise<void>;
  submitLabel: string;
}) => {
  const [code, setCode] = useState(initial?.code || '');
  const [name, setName] = useState(initial?.name || '');
  const [maxAdults, setMaxAdults] = useState(initial?.maxAdults || 2);
  const [maxChildren, setMaxChildren] = useState(initial?.maxChildren || 0);
  const [baseRate, setBaseRate] = useState(initial?.baseRate || 0);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit({
      code,
      name,
      maxAdults,
      maxChildren,
      baseRate,
      isActive
    });
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box component="form" onSubmit={submit}>
        <Stack spacing={2}>
          <TextField label="Code" value={code} onChange={(event) => setCode(event.target.value)} required />
          <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField label="Max Adults" type="number" value={maxAdults} onChange={(event) => setMaxAdults(Number(event.target.value))} fullWidth />
            <TextField label="Max Children" type="number" value={maxChildren} onChange={(event) => setMaxChildren(Number(event.target.value))} fullWidth />
            <TextField label="Base Rate" type="number" value={baseRate} onChange={(event) => setBaseRate(Number(event.target.value))} fullWidth />
          </Stack>
          <TextField select label="Active" value={isActive ? 'YES' : 'NO'} onChange={(event) => setIsActive(event.target.value === 'YES')}>
            <MenuItem value="YES">Yes</MenuItem>
            <MenuItem value="NO">No</MenuItem>
          </TextField>
          <Button type="submit" variant="contained">{submitLabel}</Button>
        </Stack>
      </Box>
    </Paper>
  );
};

export const CreateRoomTypePage = () => {
  const navigate = useNavigate();

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>Create Room Type</Typography>
        <RoomTypeForm
          submitLabel="Create"
          onSubmit={async (payload) => {
            await roomOpsService.createRoomType(payload);
            navigate('/business/rooms/types');
          }}
        />
      </Container>
    </Layout>
  );
};

export const EditRoomTypePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [roomType, setRoomType] = useState<RoomTypeRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const rows = await roomOpsService.listRoomTypes();
      setRoomType(rows.find((entry) => entry.id === id) || null);
      setLoading(false);
    };

    void load();
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <LogoLoader label="Loading room type" />
        </Container>
      </Layout>
    );
  }

  if (!roomType) {
    return (
      <Layout>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Alert severity="error">Room type not found.</Alert>
        </Container>
      </Layout>
    );
  }

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>Edit Room Type</Typography>
        <RoomTypeForm
          initial={roomType}
          submitLabel="Save Changes"
          onSubmit={async (payload) => {
            await roomOpsService.updateRoomType(roomType.id, payload);
            navigate('/business/rooms/types');
          }}
        />
      </Container>
    </Layout>
  );
};

export const RoomStatusBoardPage = () => {
  const { on } = useWebSocket();
  const [rooms, setRooms] = useState<RoomRecord[]>([]);

  const load = async () => setRooms(await roomOpsService.listRooms());

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const unsubscribers = [
      on('hotel.room.updated', () => void load()),
      on('hotel.stay_view.updated', () => void load())
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  const setStatus = async (roomId: string, status: string) => {
    await roomOpsService.updateRoomStatus(roomId, status);
    await load();
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Room Status Board</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Housekeeping/reception board for rapid room status transitions.
        </Typography>

        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {rooms.map((room) => (
            <Paper key={room.id} sx={{ p: 2, width: 230 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{room.roomNumber}</Typography>
              <Typography variant="body2" color="text.secondary">{room.roomType}</Typography>
              <Chip sx={{ mt: 1.2 }} label={room.status} color={roomStatusColor(room.status) as 'default'} />
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                <Button size="small" onClick={() => void setStatus(room.id, 'CLEANING')}>Mark Dirty</Button>
                <Button size="small" onClick={() => void setStatus(room.id, 'CLEANING')}>Cleaning</Button>
                <Button size="small" onClick={() => void setStatus(room.id, 'AVAILABLE')}>Mark Ready</Button>
                <Button size="small" color="error" onClick={() => void setStatus(room.id, 'MAINTENANCE')}>Out Of Order</Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Container>
    </Layout>
  );
};

export const RoomCalendarPage = () => {
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const load = async () => {
      const [roomRows, reservationRows] = await Promise.all([
        roomOpsService.listRooms(),
        reservationOpsService.listReservations()
      ]);
      setRooms(roomRows);
      setReservations(reservationRows);
    };

    void load();
  }, []);

  const dates = useMemo(() => {
    const base = new Date(startDate);
    return Array.from({ length: 14 }).map((_, index) => {
      const day = new Date(base);
      day.setDate(base.getDate() + index);
      return day.toISOString().slice(0, 10);
    });
  }, [startDate]);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Room Calendar</Typography>
            <Typography variant="body2" color="text.secondary">14-day occupancy timeline by room.</Typography>
          </Box>
          <TextField type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} size="small" />
        </Stack>

        <Paper sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f7fa' }}>
                <TableCell sx={{ fontWeight: 700, minWidth: 140 }}>Room</TableCell>
                {dates.map((date) => (
                  <TableCell key={date} sx={{ fontWeight: 700 }}>{date.slice(5)}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell sx={{ fontWeight: 700 }}>{room.roomNumber}</TableCell>
                  {dates.map((date) => {
                    const match = reservations.find((reservation) => {
                      const checkIn = reservation.checkIn.slice(0, 10);
                      const checkOut = reservation.checkOut.slice(0, 10);
                      return reservation.roomNumber === room.roomNumber && date >= checkIn && date <= checkOut;
                    });

                    return (
                      <TableCell key={date}>
                        {match ? <Chip size="small" label={match.guestName.split(' ')[0]} color={statusColor(match.status) as 'default'} /> : '—'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Container>
    </Layout>
  );
};

const statusColor = (status: string) => {
  if (status === 'CHECKED_IN') return 'success';
  if (status === 'CHECKED_OUT') return 'default';
  return 'info';
};
