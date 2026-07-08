import React, { useMemo, useState } from 'react';
import {
  Container,
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Stack,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import {
  generateDummyRooms,
  generateDummyBookings,
  generateServiceRequests,
  mockApiResponse,
} from '../services/dummyData';
import { useSnackbar } from 'notistack';

interface Booking {
  id: string;
  guestName: string;
  guestEmail: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  status: 'PENDING' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  totalAmount: number;
}

const ReceptionPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [openBookingDialog, setOpenBookingDialog] = useState(false);
  const [openCheckInDialog, setOpenCheckInDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [searchGuest, setSearchGuest] = useState('');
  const [newBooking, setNewBooking] = useState({
    guestName: '',
    guestEmail: '',
    roomId: '',
    checkInDate: '',
    checkOutDate: '',
  });
  const { enqueueSnackbar } = useSnackbar();

  // Generate dummy data
  const rooms = useMemo(() => generateDummyRooms(50), []);
  const bookings = useMemo(() => generateDummyBookings(rooms, 30), [rooms]);
  const availableRooms = useMemo(() => rooms.filter((r) => r.status === 'AVAILABLE'), [rooms]);
  const serviceRequests = useMemo(() => generateServiceRequests(), []);
  const shiftUtilization = useMemo(() => Math.min(100, Math.round((availableRooms.length / rooms.length) * 100)), [availableRooms.length, rooms.length]);

  // Filter bookings by tab
  const filteredBookings = useMemo(() => {
    const filtered =
      tabValue === 0
        ? bookings
        : tabValue === 1
          ? bookings.filter((b) => b.status === 'PENDING')
          : bookings.filter((b) => b.status === 'CHECKED_IN');

    if (!searchGuest) return filtered;
    return filtered.filter((b) => b.guestName.toLowerCase().includes(searchGuest.toLowerCase()));
  }, [bookings, tabValue, searchGuest]);

  const handleAddBooking = () => {
    setOpenBookingDialog(true);
  };

  const handleSaveBooking = async () => {
    // Simulate API call
    await mockApiResponse(true, 1000);
    setOpenBookingDialog(false);
    setNewBooking({
      guestName: '',
      guestEmail: '',
      roomId: '',
      checkInDate: '',
      checkOutDate: '',
    });
  };

  const handleCheckIn = (booking: Booking) => {
    setSelectedBooking(booking);
    setOpenCheckInDialog(true);
  };

  const handleConfirmCheckIn = async () => {
    // Simulate API call
    await mockApiResponse(true, 1000);
    setOpenCheckInDialog(false);
    setSelectedBooking(null);
  };

  const getBookingStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'CHECKED_IN':
        return 'success';
      case 'CHECKED_OUT':
        return 'default';
      case 'CANCELLED':
        return 'error';
      default:
        return 'default';
    }
  };

  const handleAction = async (label: string) => {
    await mockApiResponse(true, 400);
    enqueueSnackbar(`${label} completed`, { variant: 'success' });
  };

  const getRoomStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'success';
      case 'OCCUPIED':
        return 'error';
      case 'MAINTENANCE':
        return 'warning';
      case 'RESERVED':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
            Reception Management
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Manage bookings, check-ins, and room availability
          </Typography>
        </Box>

        {/* Quick Stats */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Available Rooms
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                  {availableRooms.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Pending Check-ins
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff9800' }}>
                  {bookings.filter((b) => b.status === 'PENDING').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Checked In
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                  {bookings.filter((b) => b.status === 'CHECKED_IN').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Bookings
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#9c27b0' }}>
                  {bookings.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Action Center & Shift */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Front Desk Control
                </Typography>
                <Chip label="Live" size="small" color="success" />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Trigger quick actions across the receptionist workflow.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
                {['Register walk-in', 'Send pre-arrival', 'Prepare folio', 'Publish welcome'].map((label) => (
                  <Button key={label} variant={label === 'Prepare folio' ? 'contained' : 'outlined'} onClick={() => handleAction(label)}>
                    {label}
                  </Button>
                ))}
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Shift utilization
              </Typography>
              <LinearProgress variant="determinate" value={shiftUtilization} sx={{ height: 8, borderRadius: 4, mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Room coverage {shiftUtilization}% •  {availableRooms.length} rooms ready
              </Typography>
              <Alert severity="info" sx={{ mt: 2 }}>
                Balance staffing across breakfast and evening rush.
              </Alert>
            </Paper>
          </Grid>
        </Grid>

        {/* Service Requests */}
        <Paper sx={{ mb: 4 }}>
          <Box sx={{ p: 3, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Service Requests
            </Typography>
            <Button variant="text" onClick={() => handleAction('Refresh requests')}>
              Refresh
            </Button>
          </Box>
          <Box sx={{ px: 3, py: 2 }}>
            <Grid container spacing={2}>
              {serviceRequests.map((request) => (
                <Grid item xs={12} md={6} key={request.id}>
                  <Card variant="outlined" sx={{ borderColor: 'divider' }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {request.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {request.room} • {request.priority} priority
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Assigned to {request.assignedTo}
                      </Typography>
                      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Chip label={request.status} size="small" color={request.status === 'OPEN' ? 'warning' : request.status === 'IN_PROGRESS' ? 'info' : 'success'} />
                        <Button size="small" variant="text" onClick={() => handleAction(`Update ${request.title}`)}>
                          Update
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Paper>

        {/* Bookings Table */}
        <Paper sx={{ mb: 4 }}>
          <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e0e0e0' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Guest Bookings
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddBooking}>
              New Booking
            </Button>
          </Box>

          {/* Search */}
          <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
            <TextField
              placeholder="Search guest name..."
              size="small"
              fullWidth
              value={searchGuest}
              onChange={(e) => setSearchGuest(e.target.value)}
              variant="outlined"
            />
          </Box>

          {/* Tabs */}
          <Tabs value={tabValue} onChange={(_e, newValue) => setTabValue(newValue)}>
            <Tab label={`All Bookings (${bookings.length})`} />
            <Tab label={`Pending (${bookings.filter((b) => b.status === 'PENDING').length})`} />
            <Tab label={`Checked In (${bookings.filter((b) => b.status === 'CHECKED_IN').length})`} />
          </Tabs>

          {/* Table */}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Guest Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Room ID</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Check-in</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Check-out</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredBookings.map((booking) => (
                  <TableRow key={booking.id} hover>
                    <TableCell>{booking.guestName}</TableCell>
                    <TableCell>{booking.guestEmail}</TableCell>
                    <TableCell>
                      <Chip label={booking.roomId} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{new Date(booking.checkInDate).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(booking.checkOutDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Chip
                        label={booking.status.replace('_', ' ')}
                        size="small"
                        color={getBookingStatusColor(booking.status) as any}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      ₦{booking.totalAmount.toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {booking.status === 'PENDING' && (
                        <Tooltip title="Check-in">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleCheckIn(booking)}
                          >
                            <KeyboardArrowRightIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Edit">
                        <IconButton size="small" color="default">
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Available Rooms */}
        <Paper>
          <Box sx={{ p: 3, borderBottom: '1px solid #e0e0e0' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Available Rooms
            </Typography>
          </Box>

          <Grid container spacing={2} sx={{ p: 3 }}>
            {availableRooms.slice(0, 12).map((room) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={room.id}>
                <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 3 } }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Room {room.number}
                      </Typography>
                      <Chip
                        label={room.status}
                        size="small"
                        color={getRoomStatusColor(room.status) as any}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                      {room.type}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      Floor: <strong>{room.floor}</strong> | Capacity: <strong>{room.capacity}</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, color: 'primary' }}>
                      <strong>₦{room.price.toLocaleString()} / night</strong>
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {room.amenities.slice(0, 3).map((amenity, idx) => (
                        <Chip key={idx} label={amenity} size="small" variant="outlined" />
                      ))}
                    </Box>
                    <Button
                      fullWidth
                      variant="outlined"
                      endIcon={<KeyboardArrowRightIcon />}
                      sx={{ mt: 2 }}
                    >
                      Book Room
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      </Container>

      {/* New Booking Dialog */}
      <Dialog open={openBookingDialog} onClose={() => setOpenBookingDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Booking</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Guest Name"
            margin="normal"
            value={newBooking.guestName}
            onChange={(e) => setNewBooking({ ...newBooking, guestName: e.target.value })}
          />
          <TextField
            fullWidth
            label="Guest Email"
            margin="normal"
            type="email"
            value={newBooking.guestEmail}
            onChange={(e) => setNewBooking({ ...newBooking, guestEmail: e.target.value })}
          />
          <TextField
            fullWidth
            label="Room ID"
            margin="normal"
            select
            SelectProps={{ native: true }}
            value={newBooking.roomId}
            onChange={(e) => setNewBooking({ ...newBooking, roomId: e.target.value })}
          >
            <option value="">Select Room</option>
            {availableRooms.map((room) => (
              <option key={room.id} value={room.id}>
                Room {room.number} - ₦{room.price}/night
              </option>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="Check-in Date"
            margin="normal"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={newBooking.checkInDate}
            onChange={(e) => setNewBooking({ ...newBooking, checkInDate: e.target.value })}
          />
          <TextField
            fullWidth
            label="Check-out Date"
            margin="normal"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={newBooking.checkOutDate}
            onChange={(e) => setNewBooking({ ...newBooking, checkOutDate: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBookingDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveBooking} variant="contained">
            Create Booking
          </Button>
        </DialogActions>
      </Dialog>

      {/* Check-in Dialog */}
      <Dialog open={openCheckInDialog} onClose={() => setOpenCheckInDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Check-in Guest</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedBooking && (
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>Guest:</strong> {selectedBooking.guestName}
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>Room:</strong> {selectedBooking.roomId}
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>Check-in Date:</strong> {new Date(selectedBooking.checkInDate).toLocaleDateString()}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>Check-out Date:</strong> {new Date(selectedBooking.checkOutDate).toLocaleDateString()}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Confirm check-in for this guest?
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCheckInDialog(false)}>Cancel</Button>
          <Button onClick={handleConfirmCheckIn} variant="contained" color="success">
            Confirm Check-in
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default ReceptionPage;
