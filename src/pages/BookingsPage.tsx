import React, { useMemo, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
} from '@mui/material';
import Layout from '../components/Layout';
import { generateDummyRooms, generateDummyBookings, mockApiResponse } from '../services/dummyData';
import { useSnackbar } from 'notistack';

const BookingStatusChip = ({ status }: { status: string }) => {
  const colorMap: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
    PENDING: 'warning',
    CHECKED_IN: 'success',
    CHECKED_OUT: 'info',
    CANCELLED: 'error',
  };

  return <Chip label={status.replace('_', ' ')} size="small" color={colorMap[status] || 'default'} />;
};

const statuses = ['ALL', 'PENDING', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];

const BookingsPage: React.FC = () => {
  const rooms = useMemo(() => generateDummyRooms(60), []);
  const bookings = useMemo(() => generateDummyBookings(rooms, 25), [rooms]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const { enqueueSnackbar } = useSnackbar();

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((booking) => statusFilter === 'ALL' || booking.status === statusFilter)
      .filter((booking) => booking.guestName.toLowerCase().includes(search.toLowerCase()));
  }, [bookings, statusFilter, search]);

  const handleAction = async (label: string) => {
    await mockApiResponse(true, 350);
    enqueueSnackbar(`${label} processed`, { variant: 'success' });
  };

  const revenue = filteredBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Bookings & Flow
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Keep every reservation in-sync, from pre-arrival to check-out.
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={() => handleAction('Export Bookings')}>
              Export
            </Button>
            <Button variant="contained" onClick={() => handleAction('Create Offer')}>
              Create Offer
            </Button>
          </Stack>
        </Box>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="textSecondary">
                  Active Reservations
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {filteredBookings.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ₹ Filtered view
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="textSecondary">
                  Projected Revenue
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  ₦{(revenue / 1000000).toFixed(2)}M
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Based on selected bookings
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="textSecondary">
                  Pending Check-ins
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {bookings.filter((booking) => booking.status === 'PENDING').length}
                </Typography>
                <Typography variant="caption" color="success.main">
                  Auto reminders active
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Card sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                placeholder="Search guest, room, or booking ID"
                size="small"
                fullWidth
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {statuses.map((status) => (
                  <Chip
                    key={status}
                    label={status.replace('_', ' ')}
                    color={statusFilter === status ? 'secondary' : 'default'}
                    onClick={() => setStatusFilter(status)}
                    variant={statusFilter === status ? 'filled' : 'outlined'}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Card>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: 700 }}>Guest</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Room</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Check-In</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Check-Out</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBookings.map((booking) => (
                <TableRow key={booking.id} hover>
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {booking.guestName}
                    </Typography>
                    <Typography variant="caption">{booking.guestEmail}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      Room {booking.roomNumber}
                    </Typography>
                    <Typography variant="caption">{booking.roomId.slice(0, 6)}</Typography>
                  </TableCell>
                  <TableCell>{booking.checkInDate}</TableCell>
                  <TableCell>{booking.checkOutDate}</TableCell>
                  <TableCell>
                    <BookingStatusChip status={booking.status} />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 700 }}>₦{booking.totalAmount.toLocaleString()}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {booking.numberOfGuests} guests
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="text" onClick={() => handleAction(`Checked ${booking.guestName}`)}>
                        Sync
                      </Button>
                      <Button size="small" variant="contained" onClick={() => handleAction('Send Invoice')}>
                        Invoice
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
    </Layout>
  );
};

export default BookingsPage;
