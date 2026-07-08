import React, { startTransition, useDeferredValue, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  InputAdornment,

  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  BedRounded,
  BlockRounded,
  CleaningServicesRounded,
  EventAvailableRounded,
  HotelRounded,
  LoginRounded,
  LogoutRounded,
  SearchRounded
} from '@mui/icons-material';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import LogoLoader from '../components/LogoLoader';
import {
  DashboardActivityType,
  DashboardOverview,
  DashboardSearchResult,
  dashboardService
} from '../services/api';
import { useAuthStore } from '../store/authStore';

const defaultOverview: DashboardOverview = {
  generatedAt: new Date(0).toISOString(),
  widgets: {
    arrivalsToday: 0,
    inHouseGuests: 0,
    occupancyRate: 0,
    totalRooms: 0,
    occupiedRooms: 0
  },
  roomStatus: {
    clean: 0,
    dirty: 0,
    occupied: 0,
    reserved: 0,
    outOfOrder: 0,
    vacant: 0,
    blocked: 0,
    dueOut: 0,
    total: 0
  },
  revenue: {
    today: 0,
    month: 0,
    posSales: 0
  },
  recentActivity: []
};

const activityOptions: Array<{ value: 'ALL' | DashboardActivityType; label: string }> = [
  { value: 'ALL', label: 'All activity' },
  { value: 'CREATE_RESERVATION', label: 'New bookings' },
  { value: 'UPDATE_RESERVATION', label: 'Amendments' },
  { value: 'CANCEL_RESERVATION', label: 'Cancellations' },
  { value: 'CHECK_IN', label: 'Check-ins' },
  { value: 'CHECK_OUT', label: 'Check-outs' }
];

const DashboardPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const user = useAuthStore((state) => state.user);
  const [overview, setOverview] = useState<DashboardOverview>(defaultOverview);
  const [loading, setLoading] = useState(true);
  const [runningAudit, setRunningAudit] = useState(false);
  const [error, setError] = useState('');
  const [activityFilter, setActivityFilter] = useState<'ALL' | DashboardActivityType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DashboardSearchResult[]>([]);

  const deferredSearch = useDeferredValue(searchTerm);
  const occupancyPercent = Number(overview.widgets.occupancyRate || 0);
  const canRunNightAudit = user?.role === 'ACCOUNTANT';
  const isDark = theme.palette.mode === 'dark';

  const loadDashboard = async (nextFilter: 'ALL' | DashboardActivityType = activityFilter) => {
    setLoading(true);
    setError('');

    try {
      const response = await dashboardService.getOverview(nextFilter);
      startTransition(() => setOverview(response));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard overview';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard(activityFilter);
  }, [activityFilter]);

  useEffect(() => {
    let active = true;
    const query = deferredSearch.trim();

    if (!query) {
      setSearching(false);
      setSearchResults([]);
      return () => {
        active = false;
      };
    }

    setSearching(true);

    void dashboardService
      .searchReservations(query)
      .then((response) => {
        if (!active) {
          return;
        }

        startTransition(() => setSearchResults(response.results));
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }

        const message = err instanceof Error ? err.message : 'Search failed';
        enqueueSnackbar(message, { variant: 'error' });
        setSearchResults([]);
      })
      .finally(() => {
        if (active) {
          setSearching(false);
        }
      });

    return () => {
      active = false;
    };
  }, [deferredSearch, enqueueSnackbar]);

  const runNightAudit = async () => {
    setRunningAudit(true);

    try {
      await dashboardService.runNightAudit();
      enqueueSnackbar('Night audit completed', { variant: 'success' });
      await loadDashboard(activityFilter);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Night audit failed';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setRunningAudit(false);
    }
  };

  const summaryCards = [
    {
      title: 'Arrivals Today',
      value: overview.widgets.arrivalsToday,
      helper: 'Open arrival queue',
      accent: '#B66A2B',
      icon: EventAvailableRounded,
      path: '/business/reservations/arrivals'
    },
    {
      title: 'In-House',
      value: overview.widgets.inHouseGuests,
      helper: 'Current occupied stays',
      accent: '#245C4E',
      icon: HotelRounded,
      path: '/business/reservations/in-house'
    },
    {
      title: 'Occupancy',
      value: `${occupancyPercent.toFixed(1)}%`,
      helper: `${overview.widgets.occupiedRooms}/${overview.widgets.totalRooms} rooms`,
      accent: '#2D648B',
      icon: BedRounded,
      path: '/business/rooms/status-board'
    },
    {
      title: 'Room Status',
      value: `${overview.roomStatus.clean} clean / ${overview.roomStatus.dirty} dirty`,
      helper: `${overview.roomStatus.outOfOrder} out of order`,
      accent: '#7A4A28',
      icon: CleaningServicesRounded,
      path: '/business/rooms/status-board'
    }
  ];

  const statusTiles = [
    { label: 'Available clean', count: overview.roomStatus.clean, color: '#2E8B57' },
    { label: 'Dirty', count: overview.roomStatus.dirty, color: '#C04A3A' },
    { label: 'Occupied', count: overview.roomStatus.occupied, color: '#2B6CB0' },
    { label: 'Reserved', count: overview.roomStatus.reserved, color: '#D9A11E' },
    { label: 'Out of order', count: overview.roomStatus.outOfOrder, color: '#5C4B51' },
    { label: 'Due out', count: overview.roomStatus.dueOut, color: '#7A5FB2' }
  ];

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Card
          component={motion.div}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          sx={{
            mb: 3,
            borderRadius: '10px',
            overflow: 'hidden',
            background: isDark
              ? 'radial-gradient(circle at top right, rgba(219,166,82,0.18), transparent 24%), linear-gradient(135deg, rgba(20,27,31,0.96) 0%, rgba(28,38,44,0.94) 100%)'
              : 'radial-gradient(circle at top right, rgba(219,166,82,0.24), transparent 24%), linear-gradient(135deg, rgba(36,48,55,0.98) 0%, rgba(49,64,73,0.96) 100%)',
            color: '#F7F1E7'
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Grid container spacing={3} alignItems="stretch">
              <Grid item xs={12} lg={7}>
                <Typography variant="subtitle2" sx={{ letterSpacing: '0.12em', color: 'rgba(247,241,231,0.7)' }}>
                  FRONT DESK BOARD
                </Typography>
                <Typography variant="h3" sx={{ mt: 1 }}>
                  Arrivals, rooms, and reservation search in one view.
                </Typography>
                <Typography variant="body1" sx={{ mt: 1.5, maxWidth: 660, color: 'rgba(247,241,231,0.78)' }}>
                  Modeled on dense PMS operations screens: fast search, status-first widgets, and a live activity ribbon
                  for booking creation, amendments, cancellations, check-ins, and check-outs.
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2.5 }}>
                  <Chip
                    label={`Occupancy ${occupancyPercent.toFixed(1)}%`}
                    sx={{ bgcolor: alpha('#FFFFFF', 0.12), color: '#F7F1E7' }}
                  />
                  <Chip
                    label={`${overview.roomStatus.dueOut} due out`}
                    sx={{ bgcolor: alpha('#FFFFFF', 0.08), color: '#F7F1E7' }}
                  />
                  <Chip
                    label={`Updated ${format(new Date(overview.generatedAt), 'MMM dd, HH:mm')}`}
                    sx={{ bgcolor: alpha('#FFFFFF', 0.08), color: '#F7F1E7' }}
                  />
                </Stack>
              </Grid>

              <Grid item xs={12} lg={5}>
                <Paper
                  sx={{
                    p: 2.5,
                    height: '100%',
                    borderRadius: '10px',
                    bgcolor: alpha('#FFFFFF', isDark ? 0.05 : 0.08),
                    border: `1px solid ${alpha('#FFFFFF', 0.08)}`
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: 'rgba(247,241,231,0.72)' }}>
                        Universal search
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.75, color: 'rgba(247,241,231,0.72)' }}>
                        Search by guest name, confirmation number, or invoice number.
                      </Typography>
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button
                        variant="contained"
                        onClick={() => void loadDashboard(activityFilter)}
                        disabled={loading || runningAudit}
                      >
                        Refresh
                      </Button>
                      {canRunNightAudit && (
                        <Button variant="outlined" onClick={() => void runNightAudit()} disabled={loading || runningAudit}>
                          Run Night Audit
                        </Button>
                      )}
                    </Stack>
                  </Stack>

                  <TextField
                    fullWidth
                    size="small"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search reservation, guest, or invoice"
                    sx={{
                      mt: 2.5,
                      '& .MuiOutlinedInput-root': {
                        bgcolor: alpha('#FFFFFF', 0.08)
                      }
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchRounded sx={{ color: 'rgba(247,241,231,0.68)' }} />
                        </InputAdornment>
                      )
                    }}
                  />

                  <Box sx={{ mt: 1.5, minHeight: 172 }}>
                    {searching && (
                      <Typography variant="body2" sx={{ color: 'rgba(247,241,231,0.72)' }}>
                        Searching reservations...
                      </Typography>
                    )}

                    {!searching && searchTerm.trim() && searchResults.length === 0 && (
                      <Typography variant="body2" sx={{ color: 'rgba(247,241,231,0.72)' }}>
                        No reservation matched that search.
                      </Typography>
                    )}

                    {!searching && searchResults.length > 0 && (
                      <List dense disablePadding sx={{ borderRadius: '8px', overflow: 'hidden' }}>
                        {searchResults.slice(0, 8).map((result, index) => (
                          <Box key={result.id}>
                            {index > 0 && <Divider sx={{ borderColor: alpha('#FFFFFF', 0.08) }} />}
                            <ListItemButton onClick={() => navigate(`/business/reservations/${result.reservationId}`)}>
                              <ListItemText
                                primary={
                                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                                    <Typography variant="subtitle2" sx={{ color: '#F7F1E7' }}>
                                      {result.guestName}
                                    </Typography>
                                    <Chip
                                      size="small"
                                      label={result.bookingNumber}
                                      sx={{ width: 'fit-content', bgcolor: alpha('#FFFFFF', 0.12), color: '#F7F1E7' }}
                                    />
                                  </Stack>
                                }
                                secondary={
                                  <Typography variant="body2" sx={{ color: 'rgba(247,241,231,0.7)', mt: 0.5 }}>
                                    {result.roomNumber ? `Room ${result.roomNumber}` : 'Unassigned'} | {result.status} |{' '}
                                    Match: {result.matchedOn.replace('_', ' ')}
                                  </Typography>
                                }
                              />
                            </ListItemButton>
                          </Box>
                        ))}
                      </List>
                    )}
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {(loading || runningAudit) && (
          <LogoLoader inline minHeight={160} label={runningAudit ? 'Running night audit' : 'Refreshing dashboard'} />
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {summaryCards.map((card, index) => (
            <Grid item xs={12} sm={6} xl={3} key={card.title}>
              <Card
                component={motion.div}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: index * 0.04 }}
                sx={{ borderRadius: '10px', height: '100%' }}
              >
                <CardActionArea sx={{ height: '100%' }} onClick={() => navigate(card.path)}>
                  <CardContent
                    sx={{
                      height: '100%',
                      background: isDark
                        ? `linear-gradient(180deg, ${alpha(card.accent, 0.18)} 0%, ${alpha('#10161A', 0.96)} 100%)`
                        : `linear-gradient(180deg, ${alpha(card.accent, 0.14)} 0%, rgba(255,251,245,0.98) 100%)`
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="caption" sx={{ color: alpha(card.accent, 0.96), letterSpacing: '0.12em' }}>
                          FRONT OFFICE
                        </Typography>
                        <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 700 }}>
                          {card.title}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: '12px',
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: alpha(card.accent, 0.12),
                          color: card.accent
                        }}
                      >
                        <card.icon />
                      </Box>
                    </Stack>
                    <Typography variant="h4" sx={{ mt: 2.5 }}>
                      {card.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {card.helper}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} lg={5}>
            <Paper sx={{ p: 3, borderRadius: '10px', height: '100%' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Room Status Overview
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Quick glance across vacant, dirty, occupied, and blocked inventory.
                  </Typography>
                </Box>
                <Button size="small" onClick={() => navigate('/business/rooms/status-board')}>
                  Open board
                </Button>
              </Stack>

              <Grid container spacing={1.5}>
                {statusTiles.map((tile) => (
                  <Grid item xs={12} sm={6} key={tile.label}>
                    <Box
                      sx={{
                        p: 1.75,
                        borderRadius: '10px',
                        bgcolor: alpha(tile.color, isDark ? 0.16 : 0.08),
                        border: `1px solid ${alpha(tile.color, isDark ? 0.26 : 0.16)}`
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {tile.label}
                      </Typography>
                      <Typography variant="h5" sx={{ mt: 0.75 }}>
                        {tile.count}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              <Divider sx={{ my: 2.5 }} />

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={`Vacant ${overview.roomStatus.vacant}`} color="success" variant="outlined" />
                <Chip label={`Blocked ${overview.roomStatus.blocked}`} color="default" variant="outlined" />
                <Chip label={`Today revenue NGN ${overview.revenue.today.toLocaleString()}`} variant="outlined" />
                <Chip label={`POS NGN ${overview.revenue.posSales.toLocaleString()}`} variant="outlined" />
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} lg={7}>
            <Paper sx={{ p: 3, borderRadius: '10px', height: '100%' }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                alignItems={{ md: 'center' }}
                spacing={2}
                sx={{ mb: 2.5 }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Recent Reservation Activity
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last 20 booking actions recorded by the front office and reservation team.
                  </Typography>
                </Box>
                <TextField
                  select
                  size="small"
                  value={activityFilter}
                  onChange={(event) => setActivityFilter(event.target.value as 'ALL' | DashboardActivityType)}
                  sx={{ minWidth: 190 }}
                >
                  {activityOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              {overview.recentActivity.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No activity matched the current filter.
                </Typography>
              ) : (
                <List disablePadding>
                  {overview.recentActivity.map((item, index) => {
                    const icon =
                      item.type === 'CHECK_IN'
                        ? <LoginRounded fontSize="small" />
                        : item.type === 'CHECK_OUT'
                          ? <LogoutRounded fontSize="small" />
                          : item.type === 'CANCEL_RESERVATION'
                            ? <BlockRounded fontSize="small" />
                            : <HotelRounded fontSize="small" />;

                    return (
                      <Box key={item.id}>
                        {index > 0 && <Divider />}
                        <ListItemButton
                          onClick={() => {
                            if (item.entityId) {
                              navigate(`/business/reservations/${item.entityId}`);
                            }
                          }}
                          sx={{ px: 0.5, py: 1.25 }}
                        >
                          <ListItemText
                            primary={
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ sm: 'center' }}>
                                <Chip
                                  icon={icon}
                                  label={item.label}
                                  size="small"
                                  sx={{ width: 'fit-content' }}
                                />
                                {item.details && (
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    {item.details}
                                  </Typography>
                                )}
                              </Stack>
                            }
                            secondary={
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                {item.actorName} | {format(new Date(item.createdAt), 'MMM dd, yyyy HH:mm')}
                              </Typography>
                            }
                          />
                        </ListItemButton>
                      </Box>
                    );
                  })}
                </List>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Layout>
  );
};

export default DashboardPage;
