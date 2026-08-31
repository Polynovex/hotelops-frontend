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
import {
  BuildOutlined,
  CheckCircleOutline,
  CleaningServicesOutlined,
  ErrorOutline,
  HotelOutlined,
  MeetingRoomOutlined,
  Refresh,
  Search,
  Tune
} from '@mui/icons-material';
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


/** MUI Chip colour for a room status. Used by the list and detail pages. */
const roomStatusColor = (status: string) => {
  if (status === 'AVAILABLE' || status === 'READY') return 'success';
  if (status === 'OCCUPIED') return 'info';
  if (status === 'CLEANING') return 'warning';
  if (status === 'MAINTENANCE') return 'error';
  if (status === 'RESERVED') return 'secondary';
  return 'default';
};

export const RoomStatusBoardPage = () => {
  const { on } = useWebSocket();

  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  const load = async () => {
    try {
      setLoading(true);
      const data = await roomOpsService.listRooms();
      setRooms(data);
    } finally {
      setLoading(false);
    }
  };

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
    try {
      await roomOpsService.updateRoomStatus(roomId, status);
      await load();
    } catch (error) {
      console.error('Failed to update room status', error);
    }
  };

  const counts = useMemo(() => {
    return {
      total: rooms.length,
      available: rooms.filter(
        (room) => room.status === 'AVAILABLE' || room.status === 'READY'
      ).length,
      occupied: rooms.filter((room) => room.status === 'OCCUPIED').length,
      cleaning: rooms.filter((room) => room.status === 'CLEANING').length,
      maintenance: rooms.filter(
        (room) => room.status === 'MAINTENANCE'
      ).length,
      reserved: rooms.filter((room) => room.status === 'RESERVED').length
    };
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rooms.filter((room) => {
      const matchesSearch =
        !query ||
        room.roomNumber.toLowerCase().includes(query) ||
        room.roomType.toLowerCase().includes(query);

      const matchesFilter =
        filter === 'ALL' ||
        (filter === 'AVAILABLE' &&
          (room.status === 'AVAILABLE' || room.status === 'READY')) ||
        room.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [rooms, search, filter]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
      case 'READY':
        return {
          label: status === 'READY' ? 'READY' : 'AVAILABLE',
          color: '#16805c',
          background: '#e8f7f1',
          border: '#b8e5d4',
          icon: <CheckCircleOutline sx={{ fontSize: 18 }} />
        };

      case 'OCCUPIED':
        return {
          label: 'OCCUPIED',
          color: '#2457a6',
          background: '#edf4ff',
          border: '#c8dcff',
          icon: <HotelOutlined sx={{ fontSize: 18 }} />
        };

      case 'CLEANING':
        return {
          label: 'CLEANING',
          color: '#a86600',
          background: '#fff7e6',
          border: '#f3d79e',
          icon: <CleaningServicesOutlined sx={{ fontSize: 18 }} />
        };

      case 'MAINTENANCE':
        return {
          label: 'OUT OF ORDER',
          color: '#c0392b',
          background: '#fff0ef',
          border: '#f0c5c1',
          icon: <BuildOutlined sx={{ fontSize: 18 }} />
        };

      case 'RESERVED':
        return {
          label: 'RESERVED',
          color: '#7154a5',
          background: '#f4effb',
          border: '#d9ccef',
          icon: <MeetingRoomOutlined sx={{ fontSize: 18 }} />
        };

      default:
        return {
          label: status,
          color: '#64748b',
          background: '#f1f5f9',
          border: '#dce3ea',
          icon: <ErrorOutline sx={{ fontSize: 18 }} />
        };
    }
  };

  const statCards = [
    {
      label: 'Total Rooms',
      value: counts.total,
      icon: <MeetingRoomOutlined />,
      accent: '#12304d'
    },
    {
      label: 'Available',
      value: counts.available,
      icon: <CheckCircleOutline />,
      accent: '#16805c'
    },
    {
      label: 'Occupied',
      value: counts.occupied,
      icon: <HotelOutlined />,
      accent: '#2457a6'
    },
    {
      label: 'Cleaning',
      value: counts.cleaning,
      icon: <CleaningServicesOutlined />,
      accent: '#b77714'
    },
    {
      label: 'Maintenance',
      value: counts.maintenance,
      icon: <BuildOutlined />,
      accent: '#c0392b'
    }
  ];

  return (
    <Layout>
      <Box
        sx={{
          minHeight: '100%',
          background: '#f4f7fb',
          py: { xs: 2.5, md: 4 }
        }}
      >
        <Container maxWidth="xl">

          {/* =========================================================
              PAGE HEADER
          ========================================================= */}
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              background:
                'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              p: { xs: 2.5, md: 3.5 },
              mb: 2.5
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', md: 'center' }}
              spacing={2}
            >
              <Box>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ mb: 0.8 }}
                >
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: '#20a66a',
                      boxShadow: '0 0 0 4px rgba(32,166,106,0.12)'
                    }}
                  />

                  <Typography
                    sx={{
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: '#16805c'
                    }}
                  >
                    Live Operations
                  </Typography>
                </Stack>

                <Typography
                  sx={{
                    fontSize: { xs: 26, md: 32 },
                    fontWeight: 800,
                    letterSpacing: '-0.025em',
                    color: '#172330'
                  }}
                >
                  Room Status Board
                </Typography>

                <Typography
                  sx={{
                    mt: 0.6,
                    color: '#64748b',
                    fontSize: 14
                  }}
                >
                  Monitor room readiness and update housekeeping status
                  in real time.
                </Typography>
              </Box>

              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => void load()}
                disabled={loading}
                sx={{
                  minWidth: 120,
                  height: 42,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  borderColor: '#d7dee7',
                  color: '#12304d',
                  backgroundColor: '#fff',
                  '&:hover': {
                    borderColor: '#12304d',
                    backgroundColor: '#f8fafc'
                  }
                }}
              >
                Refresh
              </Button>
            </Stack>
          </Paper>

          {/* =========================================================
              SUMMARY CARDS
          ========================================================= */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                lg: 'repeat(5, 1fr)'
              },
              gap: 1.8,
              mb: 3
            }}
          >
            {statCards.map((stat) => (
              <Paper
                key={stat.label}
                elevation={0}
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  p: 2.2,
                  borderRadius: 2.5,
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  transition: 'all 180ms ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 28px rgba(15, 34, 52, 0.08)',
                    borderColor: '#d4dce5'
                  }
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    background: stat.accent
                  }}
                />

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box>
                    <Typography
                      sx={{
                        fontSize: 12,
                        color: '#64748b',
                        fontWeight: 700,
                        mb: 0.8
                      }}
                    >
                      {stat.label}
                    </Typography>

                    <Typography
                      sx={{
                        fontSize: 28,
                        lineHeight: 1,
                        fontWeight: 800,
                        color: '#172330'
                      }}
                    >
                      {stat.value}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: 1.8,
                      display: 'grid',
                      placeItems: 'center',
                      color: stat.accent,
                      backgroundColor: `${stat.accent}12`
                    }}
                  >
                    {stat.icon}
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Box>

          {/* =========================================================
              ROOM BOARD
          ========================================================= */}
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              overflow: 'hidden'
            }}
          >

            {/* Board toolbar */}
            <Box
              sx={{
                p: { xs: 2, md: 2.5 },
                borderBottom: '1px solid #edf1f5'
              }}
            >
              <Stack
                direction={{ xs: 'column', lg: 'row' }}
                spacing={2}
                justifyContent="space-between"
              >
                <Box>
                  <Typography
                    sx={{
                      fontWeight: 800,
                      color: '#172330',
                      fontSize: 17
                    }}
                  >
                    Room Operations
                  </Typography>

                  <Typography
                    sx={{
                      color: '#718096',
                      fontSize: 13,
                      mt: 0.4
                    }}
                  >
                    Select a room to update its operational status.
                  </Typography>
                </Box>

                <TextField
                  size="small"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search room or room type..."
                  sx={{
                    width: { xs: '100%', lg: 300 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      backgroundColor: '#f8fafc'
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <Search
                        sx={{
                          mr: 1,
                          color: '#94a3b8',
                          fontSize: 20
                        }}
                      />
                    )
                  }}
                />
              </Stack>

              {/* Filters */}
              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                useFlexGap
                sx={{ mt: 2 }}
              >
                <Button
                  size="small"
                  startIcon={<Tune sx={{ fontSize: 17 }} />}
                  onClick={() => setFilter('ALL')}
                  sx={{
                    borderRadius: 1.8,
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 1.5,
                    backgroundColor:
                      filter === 'ALL' ? '#12304d' : '#f1f5f9',
                    color: filter === 'ALL' ? '#fff' : '#526273',
                    '&:hover': {
                      backgroundColor:
                        filter === 'ALL' ? '#0d263d' : '#e8edf3'
                    }
                  }}
                >
                  All Rooms ({counts.total})
                </Button>

                <Button
                  size="small"
                  onClick={() => setFilter('AVAILABLE')}
                  sx={{
                    borderRadius: 1.8,
                    textTransform: 'none',
                    fontWeight: 700,
                    backgroundColor:
                      filter === 'AVAILABLE' ? '#e8f7f1' : '#f8fafc',
                    color:
                      filter === 'AVAILABLE' ? '#16805c' : '#526273'
                  }}
                >
                  Available ({counts.available})
                </Button>

                <Button
                  size="small"
                  onClick={() => setFilter('OCCUPIED')}
                  sx={{
                    borderRadius: 1.8,
                    textTransform: 'none',
                    fontWeight: 700,
                    backgroundColor:
                      filter === 'OCCUPIED' ? '#edf4ff' : '#f8fafc',
                    color:
                      filter === 'OCCUPIED' ? '#2457a6' : '#526273'
                  }}
                >
                  Occupied ({counts.occupied})
                </Button>

                <Button
                  size="small"
                  onClick={() => setFilter('CLEANING')}
                  sx={{
                    borderRadius: 1.8,
                    textTransform: 'none',
                    fontWeight: 700,
                    backgroundColor:
                      filter === 'CLEANING' ? '#fff7e6' : '#f8fafc',
                    color:
                      filter === 'CLEANING' ? '#a86600' : '#526273'
                  }}
                >
                  Cleaning ({counts.cleaning})
                </Button>

                <Button
                  size="small"
                  onClick={() => setFilter('MAINTENANCE')}
                  sx={{
                    borderRadius: 1.8,
                    textTransform: 'none',
                    fontWeight: 700,
                    backgroundColor:
                      filter === 'MAINTENANCE' ? '#fff0ef' : '#f8fafc',
                    color:
                      filter === 'MAINTENANCE' ? '#c0392b' : '#526273'
                  }}
                >
                  Maintenance ({counts.maintenance})
                </Button>
              </Stack>
            </Box>

            {/* Room grid */}
            <Box sx={{ p: { xs: 2, md: 2.5 } }}>
              {loading ? (
                <Box
                  sx={{
                    py: 8,
                    textAlign: 'center',
                    color: '#64748b'
                  }}
                >
                  <Typography fontWeight={700}>
                    Loading room operations...
                  </Typography>
                </Box>
              ) : filteredRooms.length === 0 ? (
                <Box
                  sx={{
                    py: 8,
                    textAlign: 'center'
                  }}
                >
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      mx: 'auto',
                      mb: 1.5,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      backgroundColor: '#f1f5f9',
                      color: '#64748b'
                    }}
                  >
                    <HotelOutlined />
                  </Box>

                  <Typography
                    sx={{
                      fontWeight: 800,
                      color: '#172330'
                    }}
                  >
                    No rooms found
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.5,
                      color: '#718096',
                      fontSize: 13
                    }}
                  >
                    Try changing your search or status filter.
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      md: 'repeat(3, minmax(0, 1fr))',
                      lg: 'repeat(4, minmax(0, 1fr))',
                      xl: 'repeat(5, minmax(0, 1fr))'
                    },
                    gap: 2
                  }}
                >
                  {filteredRooms.map((room) => {
                    const config = getStatusConfig(room.status);

                    return (
                      <Paper
                        key={room.id}
                        elevation={0}
                        sx={{
                          position: 'relative',
                          overflow: 'hidden',
                          borderRadius: 2.5,
                          border: '1px solid #e1e7ee',
                          background: '#fff',
                          transition:
                            'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                          '&:hover': {
                            transform: 'translateY(-3px)',
                            borderColor: '#cdd7e2',
                            boxShadow:
                              '0 14px 32px rgba(15, 34, 52, 0.09)'
                          }
                        }}
                      >
                        {/* Status bar */}
                        <Box
                          sx={{
                            height: 5,
                            background: config.color
                          }}
                        />

                        <Box sx={{ p: 2 }}>
                          {/* Room heading */}
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="flex-start"
                          >
                            <Box>
                              <Typography
                                sx={{
                                  fontSize: 25,
                                  lineHeight: 1,
                                  fontWeight: 850,
                                  color: '#172330',
                                  letterSpacing: '-0.02em'
                                }}
                              >
                                {room.roomNumber}
                              </Typography>

                              <Typography
                                sx={{
                                  mt: 0.7,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: '#64748b'
                                }}
                              >
                                {room.roomType}
                              </Typography>
                            </Box>

                            <Box
                              sx={{
                                width: 38,
                                height: 38,
                                borderRadius: 1.8,
                                display: 'grid',
                                placeItems: 'center',
                                color: config.color,
                                backgroundColor: config.background
                              }}
                            >
                              {config.icon}
                            </Box>
                          </Stack>

                          {/* Room metadata */}
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ mt: 1.7 }}
                          >
                            <Chip
                              label={`Floor ${room.floor}`}
                              size="small"
                              sx={{
                                height: 26,
                                borderRadius: 1.3,
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#526273',
                                backgroundColor: '#f1f5f9'
                              }}
                            />

                            <Chip
                              label={config.label}
                              size="small"
                              icon={config.icon}
                              sx={{
                                height: 26,
                                borderRadius: 1.3,
                                fontSize: 10,
                                fontWeight: 800,
                                color: config.color,
                                backgroundColor: config.background,
                                border: `1px solid ${config.border}`,
                                '& .MuiChip-icon': {
                                  color: config.color
                                }
                              }}
                            />
                          </Stack>

                          {/* Divider */}
                          <Box
                            sx={{
                              height: 1,
                              backgroundColor: '#edf1f5',
                              my: 1.8
                            }}
                          />

                          {/* Room rate */}
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{ mb: 1.5 }}
                          >
                            <Typography
                              sx={{
                                fontSize: 12,
                                color: '#718096'
                              }}
                            >
                              Room rate
                            </Typography>

                            <Typography
                              sx={{
                                fontWeight: 800,
                                fontSize: 14,
                                color: '#172330'
                              }}
                            >
                              ₦{room.rate.toLocaleString()}
                            </Typography>
                          </Stack>

                          {/* Actions */}
                          <Stack spacing={1}>
                            <Button
                              fullWidth
                              size="small"
                              variant="contained"
                              startIcon={<CheckCircleOutline />}
                              onClick={() =>
                                void setStatus(room.id, 'AVAILABLE')
                              }
                              sx={{
                                height: 36,
                                borderRadius: 1.7,
                                textTransform: 'none',
                                fontWeight: 750,
                                backgroundColor: '#12304d',
                                boxShadow: 'none',
                                '&:hover': {
                                  backgroundColor: '#0c263e',
                                  boxShadow: 'none'
                                }
                              }}
                            >
                              Mark Ready
                            </Button>

                            <Stack direction="row" spacing={1}>
                              <Button
                                fullWidth
                                size="small"
                                variant="outlined"
                                startIcon={<CleaningServicesOutlined />}
                                onClick={() =>
                                  void setStatus(room.id, 'CLEANING')
                                }
                                sx={{
                                  height: 34,
                                  minWidth: 0,
                                  px: 1,
                                  borderRadius: 1.6,
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  fontSize: 12,
                                  // "Out of Order" is long enough to wrap at
                                  // half-card width, which pushed the label off
                                  // centre inside the fixed height.
                                  whiteSpace: 'nowrap',
                                  // A smaller, tighter icon leaves room for the
                                  // label instead of squeezing it.
                                  '& .MuiButton-startIcon': {
                                    mr: 0.6,
                                    ml: 0,
                                    '& > *:first-of-type': { fontSize: 16 }
                                  },
                                  color: '#a86600',
                                  borderColor: '#efd49f',
                                  backgroundColor: '#fffaf0',
                                  '&:hover': {
                                    borderColor: '#d9b66f',
                                    backgroundColor: '#fff6df'
                                  }
                                }}
                              >
                                Cleaning
                              </Button>

                              <Button
                                fullWidth
                                size="small"
                                variant="outlined"
                                startIcon={<BuildOutlined />}
                                onClick={() =>
                                  void setStatus(
                                    room.id,
                                    'MAINTENANCE'
                                  )
                                }
                                sx={{
                                  height: 34,
                                  minWidth: 0,
                                  px: 1,
                                  borderRadius: 1.6,
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  fontSize: 12,
                                  // "Out of Order" is long enough to wrap at
                                  // half-card width, which pushed the label off
                                  // centre inside the fixed height.
                                  whiteSpace: 'nowrap',
                                  // A smaller, tighter icon leaves room for the
                                  // label instead of squeezing it.
                                  '& .MuiButton-startIcon': {
                                    mr: 0.6,
                                    ml: 0,
                                    '& > *:first-of-type': { fontSize: 16 }
                                  },
                                  color: '#c0392b',
                                  borderColor: '#efc5c1',
                                  backgroundColor: '#fff8f7',
                                  '&:hover': {
                                    borderColor: '#dca09a',
                                    backgroundColor: '#fff1ef'
                                  }
                                }}
                              >
                                Out of Order
                              </Button>
                            </Stack>
                          </Stack>
                        </Box>
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </Box>

            {/* Footer */}
            {!loading && filteredRooms.length > 0 && (
              <Box
                sx={{
                  px: { xs: 2, md: 2.5 },
                  py: 1.5,
                  borderTop: '1px solid #edf1f5',
                  backgroundColor: '#fafbfd'
                }}
              >
                <Typography
                  sx={{
                    fontSize: 12,
                    color: '#718096'
                  }}
                >
                  Showing{' '}
                  <strong>{filteredRooms.length}</strong> of{' '}
                  <strong>{rooms.length}</strong> rooms
                </Typography>
              </Box>
            )}
          </Paper>
        </Container>
      </Box>
    </Layout>
  );
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
