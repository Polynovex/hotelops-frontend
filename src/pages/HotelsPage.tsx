import React, { useMemo } from 'react';
import {
  Container,
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Divider,
} from '@mui/material';
import Layout from '../components/Layout';
import { generateDummyHotels, mockApiResponse } from '../services/dummyData';
import { useSnackbar } from 'notistack';
import { EmptyState } from '../components/premium';
import { ApartmentOutlined } from '@mui/icons-material';

const hotelStatusColor = (status: string) => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'MAINTENANCE') return 'warning';
  return 'default';
};

const HotelsPage: React.FC = () => {
  const hotels = useMemo(() => generateDummyHotels(4), []);
  const { enqueueSnackbar } = useSnackbar();

  const handleAction = async (label: string) => {
    await mockApiResponse(true, 400);
    enqueueSnackbar(`${label} executed`, { variant: 'success' });
  };

  const totalRevenue = hotels.reduce((sum, hotel) => sum + hotel.revenue, 0);
  const avgOccupancy = (hotels.reduce((sum, hotel) => sum + hotel.occupancyRate, 0) / hotels.length).toFixed(1);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Hotel Network
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Centralize onboarding, activation, and monitoring across every property.
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={() => handleAction('Sync Properties')}>
              Sync Properties
            </Button>
            <Button variant="contained" onClick={() => handleAction('Invite Manager')}>
              Invite Manager
            </Button>
          </Stack>
        </Box>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="textSecondary">
                  Total Hotels
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  {hotels.length}
                </Typography>
                <Typography variant="caption" color="success.main">
                  {hotels.filter((hotel) => hotel.status === 'ACTIVE').length} active
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="textSecondary">
                  Total Revenue
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  ₦{(totalRevenue / 1000000).toFixed(2)}M
                </Typography>
                <Typography variant="caption" color="text.primary">
                  Last 30 days
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="textSecondary">
                  Avg Occupancy
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  {avgOccupancy}%
                </Typography>
                <Typography variant="caption" color="text.primary">
                  Real-time tracking
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="textSecondary">
                  Alerts Resolved
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  18
                </Typography>
                <Typography variant="caption" color="success.main">
                  Last 24 hrs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Card sx={{ mb: 4 }}>
          <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Operations Controls
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button onClick={() => handleAction('Night Audit')} variant="contained">
                Run Night Audit
              </Button>
              <Button onClick={() => handleAction('Push Update')} variant="outlined">
                Push OTA Sync
              </Button>
            </Stack>
          </Box>
          <Divider />
          <Box sx={{ p: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {['Enable PMS', 'Enable POS', 'Enable Finance'].map((label) => (
              <Button key={label} variant="text" onClick={() => handleAction(label)}>
                {label}
              </Button>
            ))}
          </Box>
        </Card>

        <TableContainer component={Card}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: 700 }}>Property</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Rooms</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Occupancy</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Modules</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {hotels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState
                      icon={<ApartmentOutlined />}
                      title="No businesses yet"
                      description="Businesses you add will be listed here."
                    />
                  </TableCell>
                </TableRow>
              )}
              {hotels.map((hotel) => (
                <TableRow key={hotel.id} hover>
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {hotel.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Managed by {hotel.managerName}
                    </Typography>
                  </TableCell>
                  <TableCell>{hotel.location}</TableCell>
                  <TableCell>{hotel.totalRooms}</TableCell>
                  <TableCell>
                    <Chip label={`${hotel.occupancyRate}%`} color={hotel.occupancyRate > 80 ? 'error' : hotel.occupancyRate > 50 ? 'warning' : 'success'} size="small" />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      {['PMS', 'POS', 'Finance', 'Housekeeping'].map((module) => (
                        <Chip key={module} label={module} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip label={hotel.status} size="small" color={hotelStatusColor(hotel.status)} />
                  </TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => handleAction(`Viewing ${hotel.name}`)}>
                      View
                    </Button>
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

export default HotelsPage;
