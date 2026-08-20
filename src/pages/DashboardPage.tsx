// import React, { startTransition, useDeferredValue, useEffect, useState } from 'react';
// import {
//   Alert,
//   Box,
//   Button,
//   Card,
//   CardActionArea,
//   CardContent,
//   Chip,
//   Container,
//   Divider,
//   Grid,
//   InputAdornment,

//   List,
//   ListItemButton,
//   ListItemText,
//   MenuItem,
//   Paper,
//   Stack,
//   TextField,
//   Typography,
//   useTheme
// } from '@mui/material';
// import { alpha } from '@mui/material/styles';
// import {
//   BedRounded,
//   BlockRounded,
//   CleaningServicesRounded,
//   EventAvailableRounded,
//   HotelRounded,
//   LoginRounded,
//   LogoutRounded,
//   SearchRounded
// } from '@mui/icons-material';
// import { format } from 'date-fns';
// import { motion } from 'framer-motion';
// import { useSnackbar } from 'notistack';
// import { useNavigate } from 'react-router-dom';
// import Layout from '../components/Layout';
// import LogoLoader from '../components/LogoLoader';
// import {
//   DashboardActivityType,
//   DashboardOverview,
//   DashboardSearchResult,
//   dashboardService
// } from '../services/api';
// import { useAuthStore } from '../store/authStore';
// import PerformanceMetrics from '../components/PerformanceMetrics';

// const defaultOverview: DashboardOverview = {
//   generatedAt: new Date(0).toISOString(),
//   widgets: {
//     arrivalsToday: 0,
//     inHouseGuests: 0,
//     occupancyRate: 0,
//     totalRooms: 0,
//     occupiedRooms: 0
//   },
//   roomStatus: {
//     clean: 0,
//     dirty: 0,
//     occupied: 0,
//     reserved: 0,
//     outOfOrder: 0,
//     vacant: 0,
//     blocked: 0,
//     dueOut: 0,
//     total: 0
//   },
//   revenue: {
//     today: 0,
//     month: 0,
//     posSales: 0
//   },
//   recentActivity: []
// };

// const activityOptions: Array<{ value: 'ALL' | DashboardActivityType; label: string }> = [
//   { value: 'ALL', label: 'All activity' },
//   { value: 'CREATE_RESERVATION', label: 'New bookings' },
//   { value: 'UPDATE_RESERVATION', label: 'Amendments' },
//   { value: 'CANCEL_RESERVATION', label: 'Cancellations' },
//   { value: 'CHECK_IN', label: 'Check-ins' },
//   { value: 'CHECK_OUT', label: 'Check-outs' }
// ];

// const DashboardPage: React.FC = () => {
//   const theme = useTheme();
//   const navigate = useNavigate();
//   const { enqueueSnackbar } = useSnackbar();
//   const user = useAuthStore((state) => state.user);
//   const [overview, setOverview] = useState<DashboardOverview>(defaultOverview);
//   const [loading, setLoading] = useState(true);
//   const [runningAudit, setRunningAudit] = useState(false);
//   const [error, setError] = useState('');
//   const [activityFilter, setActivityFilter] = useState<'ALL' | DashboardActivityType>('ALL');
//   const [searchTerm, setSearchTerm] = useState('');
//   const [searching, setSearching] = useState(false);
//   const [searchResults, setSearchResults] = useState<DashboardSearchResult[]>([]);

//   const deferredSearch = useDeferredValue(searchTerm);
//   const occupancyPercent = Number(overview.widgets.occupancyRate || 0);
//   const canRunNightAudit = user?.role === 'ACCOUNTANT';
//   const isDark = theme.palette.mode === 'dark';

//   const loadDashboard = async (nextFilter: 'ALL' | DashboardActivityType = activityFilter) => {
//     setLoading(true);
//     setError('');

//     try {
//       const response = await dashboardService.getOverview(nextFilter);
//       startTransition(() => setOverview(response));
//     } catch (err: unknown) {
//       const message = err instanceof Error ? err.message : 'Failed to load dashboard overview';
//       setError(message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     void loadDashboard(activityFilter);
//   }, [activityFilter]);

//   useEffect(() => {
//     let active = true;
//     const query = deferredSearch.trim();

//     if (!query) {
//       setSearching(false);
//       setSearchResults([]);
//       return () => {
//         active = false;
//       };
//     }

//     setSearching(true);

//     void dashboardService
//       .searchReservations(query)
//       .then((response) => {
//         if (!active) {
//           return;
//         }

//         startTransition(() => setSearchResults(response.results));
//       })
//       .catch((err: unknown) => {
//         if (!active) {
//           return;
//         }

//         const message = err instanceof Error ? err.message : 'Search failed';
//         enqueueSnackbar(message, { variant: 'error' });
//         setSearchResults([]);
//       })
//       .finally(() => {
//         if (active) {
//           setSearching(false);
//         }
//       });

//     return () => {
//       active = false;
//     };
//   }, [deferredSearch, enqueueSnackbar]);

//   const runNightAudit = async () => {
//     setRunningAudit(true);

//     try {
//       await dashboardService.runNightAudit();
//       enqueueSnackbar('Night audit completed', { variant: 'success' });
//       await loadDashboard(activityFilter);
//     } catch (err: unknown) {
//       const message = err instanceof Error ? err.message : 'Night audit failed';
//       enqueueSnackbar(message, { variant: 'error' });
//     } finally {
//       setRunningAudit(false);
//     }
//   };

//   const summaryCards = [
//     {
//       title: 'Arrivals Today',
//       value: overview.widgets.arrivalsToday,
//       helper: 'Open arrival queue',
//       accent: '#B66A2B',
//       icon: EventAvailableRounded,
//       path: '/business/reservations/arrivals'
//     },
//     {
//       title: 'In-House',
//       value: overview.widgets.inHouseGuests,
//       helper: 'Current occupied stays',
//       accent: '#245C4E',
//       icon: HotelRounded,
//       path: '/business/reservations/in-house'
//     },
//     {
//       title: 'Occupancy',
//       value: `${occupancyPercent.toFixed(1)}%`,
//       helper: `${overview.widgets.occupiedRooms}/${overview.widgets.totalRooms} rooms`,
//       accent: '#2D648B',
//       icon: BedRounded,
//       path: '/business/rooms/status-board'
//     },
//     {
//       title: 'Room Status',
//       value: `${overview.roomStatus.clean} clean / ${overview.roomStatus.dirty} dirty`,
//       helper: `${overview.roomStatus.outOfOrder} out of order`,
//       accent: '#7A4A28',
//       icon: CleaningServicesRounded,
//       path: '/business/rooms/status-board'
//     }
//   ];

//   const statusTiles = [
//     { label: 'Available clean', count: overview.roomStatus.clean, color: '#2E8B57' },
//     { label: 'Dirty', count: overview.roomStatus.dirty, color: '#C04A3A' },
//     { label: 'Occupied', count: overview.roomStatus.occupied, color: '#2B6CB0' },
//     { label: 'Reserved', count: overview.roomStatus.reserved, color: '#D9A11E' },
//     { label: 'Out of order', count: overview.roomStatus.outOfOrder, color: '#5C4B51' },
//     { label: 'Due out', count: overview.roomStatus.dueOut, color: '#7A5FB2' }
//   ];

//   return (
//     <Layout>
//       <Container maxWidth="xl" sx={{ py: 3 }}>
//         <PerformanceMetrics />
//         <Card
//           component={motion.div}
//           initial={{ opacity: 0, y: 18 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.32, ease: 'easeOut' }}
//           sx={{
//             mb: 3,
//             borderRadius: '10px',
//             overflow: 'hidden',
//             background: isDark
//               ? 'radial-gradient(circle at top right, rgba(219,166,82,0.18), transparent 24%), linear-gradient(135deg, rgba(20,27,31,0.96) 0%, rgba(28,38,44,0.94) 100%)'
//               : 'radial-gradient(circle at top right, rgba(219,166,82,0.24), transparent 24%), linear-gradient(135deg, rgba(36,48,55,0.98) 0%, rgba(49,64,73,0.96) 100%)',
//             color: '#F7F1E7'
//           }}
//         >
//           <CardContent sx={{ p: { xs: 3, md: 4 } }}>
//             <Grid container spacing={3} alignItems="stretch">
//               <Grid item xs={12} lg={7}>
//                 <Typography variant="subtitle2" sx={{ letterSpacing: '0.12em', color: 'rgba(247,241,231,0.7)' }}>
//                   FRONT DESK BOARD
//                 </Typography>
//                 <Typography variant="h3" sx={{ mt: 1 }}>
//                   Arrivals, rooms, and reservation search in one view.
//                 </Typography>
//                 <Typography variant="body1" sx={{ mt: 1.5, maxWidth: 660, color: 'rgba(247,241,231,0.78)' }}>
//                   Modeled on dense PMS operations screens: fast search, status-first widgets, and a live activity ribbon
//                   for booking creation, amendments, cancellations, check-ins, and check-outs.
//                 </Typography>
//                 <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2.5 }}>
//                   <Chip
//                     label={`Occupancy ${occupancyPercent.toFixed(1)}%`}
//                     sx={{ bgcolor: alpha('#FFFFFF', 0.12), color: '#F7F1E7' }}
//                   />
//                   <Chip
//                     label={`${overview.roomStatus.dueOut} due out`}
//                     sx={{ bgcolor: alpha('#FFFFFF', 0.08), color: '#F7F1E7' }}
//                   />
//                   <Chip
//                     label={`Updated ${format(new Date(overview.generatedAt), 'MMM dd, HH:mm')}`}
//                     sx={{ bgcolor: alpha('#FFFFFF', 0.08), color: '#F7F1E7' }}
//                   />
//                 </Stack>
//               </Grid>

//               <Grid item xs={12} lg={5}>
//                 <Paper
//                   sx={{
//                     p: 2.5,
//                     height: '100%',
//                     borderRadius: '10px',
//                     bgcolor: alpha('#FFFFFF', isDark ? 0.05 : 0.08),
//                     border: `1px solid ${alpha('#FFFFFF', 0.08)}`
//                   }}
//                 >
//                   <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
//                     <Box>
//                       <Typography variant="subtitle2" sx={{ color: 'rgba(247,241,231,0.72)' }}>
//                         Universal search
//                       </Typography>
//                       <Typography variant="body2" sx={{ mt: 0.75, color: 'rgba(247,241,231,0.72)' }}>
//                         Search by guest name, confirmation number, or invoice number.
//                       </Typography>
//                     </Box>
//                     <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
//                       <Button
//                         variant="contained"
//                         onClick={() => void loadDashboard(activityFilter)}
//                         disabled={loading || runningAudit}
//                       >
//                         Refresh
//                       </Button>
//                       {canRunNightAudit && (
//                         <Button variant="outlined" onClick={() => void runNightAudit()} disabled={loading || runningAudit}>
//                           Run Night Audit
//                         </Button>
//                       )}
//                     </Stack>
//                   </Stack>

//                   <TextField
//                     fullWidth
//                     size="small"
//                     value={searchTerm}
//                     onChange={(event) => setSearchTerm(event.target.value)}
//                     placeholder="Search reservation, guest, or invoice"
//                     sx={{
//                       mt: 2.5,
//                       '& .MuiOutlinedInput-root': {
//                         bgcolor: alpha('#FFFFFF', 0.08)
//                       }
//                     }}
//                     InputProps={{
//                       startAdornment: (
//                         <InputAdornment position="start">
//                           <SearchRounded sx={{ color: 'rgba(247,241,231,0.68)' }} />
//                         </InputAdornment>
//                       )
//                     }}
//                   />

//                   <Box sx={{ mt: 1.5, minHeight: 172 }}>
//                     {searching && (
//                       <Typography variant="body2" sx={{ color: 'rgba(247,241,231,0.72)' }}>
//                         Searching reservations...
//                       </Typography>
//                     )}

//                     {!searching && searchTerm.trim() && searchResults.length === 0 && (
//                       <Typography variant="body2" sx={{ color: 'rgba(247,241,231,0.72)' }}>
//                         No reservation matched that search.
//                       </Typography>
//                     )}

//                     {!searching && searchResults.length > 0 && (
//                       <List dense disablePadding sx={{ borderRadius: '8px', overflow: 'hidden' }}>
//                         {searchResults.slice(0, 8).map((result, index) => (
//                           <Box key={result.id}>
//                             {index > 0 && <Divider sx={{ borderColor: alpha('#FFFFFF', 0.08) }} />}
//                             <ListItemButton onClick={() => navigate(`/business/reservations/${result.reservationId}`)}>
//                               <ListItemText
//                                 primary={
//                                   <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
//                                     <Typography variant="subtitle2" sx={{ color: '#F7F1E7' }}>
//                                       {result.guestName}
//                                     </Typography>
//                                     <Chip
//                                       size="small"
//                                       label={result.bookingNumber}
//                                       sx={{ width: 'fit-content', bgcolor: alpha('#FFFFFF', 0.12), color: '#F7F1E7' }}
//                                     />
//                                   </Stack>
//                                 }
//                                 secondary={
//                                   <Typography variant="body2" sx={{ color: 'rgba(247,241,231,0.7)', mt: 0.5 }}>
//                                     {result.roomNumber ? `Room ${result.roomNumber}` : 'Unassigned'} | {result.status} |{' '}
//                                     Match: {result.matchedOn.replace('_', ' ')}
//                                   </Typography>
//                                 }
//                               />
//                             </ListItemButton>
//                           </Box>
//                         ))}
//                       </List>
//                     )}
//                   </Box>
//                 </Paper>
//               </Grid>
//             </Grid>
//           </CardContent>
//         </Card>

//         {(loading || runningAudit) && (
//           <LogoLoader inline minHeight={160} label={runningAudit ? 'Running night audit' : 'Refreshing dashboard'} />
//         )}

//         {error && (
//           <Alert severity="error" sx={{ mb: 3 }}>
//             {error}
//           </Alert>
//         )}

//         <Grid container spacing={2} sx={{ mb: 3 }}>
//           {summaryCards.map((card, index) => (
//             <Grid item xs={12} sm={6} xl={3} key={card.title}>
//               <Card
//                 component={motion.div}
//                 initial={{ opacity: 0, y: 16 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 transition={{ duration: 0.24, delay: index * 0.04 }}
//                 sx={{ borderRadius: '10px', height: '100%' }}
//               >
//                 <CardActionArea sx={{ height: '100%' }} onClick={() => navigate(card.path)}>
//                   <CardContent
//                     sx={{
//                       height: '100%',
//                       background: isDark
//                         ? `linear-gradient(180deg, ${alpha(card.accent, 0.18)} 0%, ${alpha('#10161A', 0.96)} 100%)`
//                         : `linear-gradient(180deg, ${alpha(card.accent, 0.14)} 0%, rgba(255,251,245,0.98) 100%)`
//                     }}
//                   >
//                     <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
//                       <Box>
//                         <Typography variant="caption" sx={{ color: alpha(card.accent, 0.96), letterSpacing: '0.12em' }}>
//                           FRONT OFFICE
//                         </Typography>
//                         <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 700 }}>
//                           {card.title}
//                         </Typography>
//                       </Box>
//                       <Box
//                         sx={{
//                           width: 48,
//                           height: 48,
//                           borderRadius: '12px',
//                           display: 'grid',
//                           placeItems: 'center',
//                           bgcolor: alpha(card.accent, 0.12),
//                           color: card.accent
//                         }}
//                       >
//                         <card.icon />
//                       </Box>
//                     </Stack>
//                     <Typography variant="h4" sx={{ mt: 2.5 }}>
//                       {card.value}
//                     </Typography>
//                     <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
//                       {card.helper}
//                     </Typography>
//                   </CardContent>
//                 </CardActionArea>
//               </Card>
//             </Grid>
//           ))}
//         </Grid>

//         <Grid container spacing={3}>
//           <Grid item xs={12} lg={5}>
//             <Paper sx={{ p: 3, borderRadius: '10px', height: '100%' }}>
//               <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
//                 <Box>
//                   <Typography variant="h6" sx={{ fontWeight: 700 }}>
//                     Room Status Overview
//                   </Typography>
//                   <Typography variant="body2" color="text.secondary">
//                     Quick glance across vacant, dirty, occupied, and blocked inventory.
//                   </Typography>
//                 </Box>
//                 <Button size="small" onClick={() => navigate('/business/rooms/status-board')}>
//                   Open board
//                 </Button>
//               </Stack>

//               <Grid container spacing={1.5}>
//                 {statusTiles.map((tile) => (
//                   <Grid item xs={12} sm={6} key={tile.label}>
//                     <Box
//                       sx={{
//                         p: 1.75,
//                         borderRadius: '10px',
//                         bgcolor: alpha(tile.color, isDark ? 0.16 : 0.08),
//                         border: `1px solid ${alpha(tile.color, isDark ? 0.26 : 0.16)}`
//                       }}
//                     >
//                       <Typography variant="body2" color="text.secondary">
//                         {tile.label}
//                       </Typography>
//                       <Typography variant="h5" sx={{ mt: 0.75 }}>
//                         {tile.count}
//                       </Typography>
//                     </Box>
//                   </Grid>
//                 ))}
//               </Grid>

//               <Divider sx={{ my: 2.5 }} />

//               <Stack direction="row" spacing={1} flexWrap="wrap">
//                 <Chip label={`Vacant ${overview.roomStatus.vacant}`} color="success" variant="outlined" />
//                 <Chip label={`Blocked ${overview.roomStatus.blocked}`} color="default" variant="outlined" />
//                 <Chip label={`Today revenue NGN ${overview.revenue.today.toLocaleString()}`} variant="outlined" />
//                 <Chip label={`POS NGN ${overview.revenue.posSales.toLocaleString()}`} variant="outlined" />
//               </Stack>
//             </Paper>
//           </Grid>

//           <Grid item xs={12} lg={7}>
//             <Paper sx={{ p: 3, borderRadius: '10px', height: '100%' }}>
//               <Stack
//                 direction={{ xs: 'column', md: 'row' }}
//                 justifyContent="space-between"
//                 alignItems={{ md: 'center' }}
//                 spacing={2}
//                 sx={{ mb: 2.5 }}
//               >
//                 <Box>
//                   <Typography variant="h6" sx={{ fontWeight: 700 }}>
//                     Recent Reservation Activity
//                   </Typography>
//                   <Typography variant="body2" color="text.secondary">
//                     Last 20 booking actions recorded by the front office and reservation team.
//                   </Typography>
//                 </Box>
//                 <TextField
//                   select
//                   size="small"
//                   value={activityFilter}
//                   onChange={(event) => setActivityFilter(event.target.value as 'ALL' | DashboardActivityType)}
//                   sx={{ minWidth: 190 }}
//                 >
//                   {activityOptions.map((option) => (
//                     <MenuItem key={option.value} value={option.value}>
//                       {option.label}
//                     </MenuItem>
//                   ))}
//                 </TextField>
//               </Stack>

//               {overview.recentActivity.length === 0 ? (
//                 <Typography variant="body2" color="text.secondary">
//                   No activity matched the current filter.
//                 </Typography>
//               ) : (
//                 <List disablePadding>
//                   {overview.recentActivity.map((item, index) => {
//                     const icon =
//                       item.type === 'CHECK_IN'
//                         ? <LoginRounded fontSize="small" />
//                         : item.type === 'CHECK_OUT'
//                           ? <LogoutRounded fontSize="small" />
//                           : item.type === 'CANCEL_RESERVATION'
//                             ? <BlockRounded fontSize="small" />
//                             : <HotelRounded fontSize="small" />;

//                     return (
//                       <Box key={item.id}>
//                         {index > 0 && <Divider />}
//                         <ListItemButton
//                           onClick={() => {
//                             if (item.entityId) {
//                               navigate(`/business/reservations/${item.entityId}`);
//                             }
//                           }}
//                           sx={{ px: 0.5, py: 1.25 }}
//                         >
//                           <ListItemText
//                             primary={
//                               <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ sm: 'center' }}>
//                                 <Chip
//                                   icon={icon}
//                                   label={item.label}
//                                   size="small"
//                                   sx={{ width: 'fit-content' }}
//                                 />
//                                 {item.details && (
//                                   <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
//                                     {item.details}
//                                   </Typography>
//                                 )}
//                               </Stack>
//                             }
//                             secondary={
//                               <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
//                                 {item.actorName} | {format(new Date(item.createdAt), 'MMM dd, yyyy HH:mm')}
//                               </Typography>
//                             }
//                           />
//                         </ListItemButton>
//                       </Box>
//                     );
//                   })}
//                 </List>
//               )}
//             </Paper>
//           </Grid>
//         </Grid>
//       </Container>
//     </Layout>
//   );
// };

// export default DashboardPage;

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
  ArrowForwardRounded,
  BedRounded,
  BlockRounded,
  CleaningServicesRounded,
  EventAvailableRounded,
  HotelRounded,
  LoginRounded,
  LogoutRounded,
  RefreshRounded,
  SearchRounded,
  TrendingUpRounded,
  WarningAmberRounded
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
import PerformanceMetrics from '../components/PerformanceMetrics';

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

const activityOptions: Array<{
  value: 'ALL' | DashboardActivityType;
  label: string;
}> = [
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

  const [overview, setOverview] =
    useState<DashboardOverview>(defaultOverview);

  const [loading, setLoading] = useState(true);
  const [runningAudit, setRunningAudit] = useState(false);
  const [error, setError] = useState('');

  const [activityFilter, setActivityFilter] =
    useState<'ALL' | DashboardActivityType>('ALL');

  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    DashboardSearchResult[]
  >([]);

  const deferredSearch = useDeferredValue(searchTerm);

  const occupancyPercent = Number(
    overview.widgets.occupancyRate || 0
  );

  const canRunNightAudit = user?.role === 'ACCOUNTANT';
  const isDark = theme.palette.mode === 'dark';

  const loadDashboard = async (
    nextFilter: 'ALL' | DashboardActivityType = activityFilter
  ) => {
    setLoading(true);
    setError('');

    try {
      const response =
        await dashboardService.getOverview(nextFilter);

      startTransition(() => setOverview(response));
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load dashboard overview';

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

        startTransition(() =>
          setSearchResults(response.results)
        );
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }

        const message =
          err instanceof Error
            ? err.message
            : 'Search failed';

        enqueueSnackbar(message, {
          variant: 'error'
        });

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

      enqueueSnackbar('Night audit completed', {
        variant: 'success'
      });

      await loadDashboard(activityFilter);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Night audit failed';

      enqueueSnackbar(message, {
        variant: 'error'
      });
    } finally {
      setRunningAudit(false);
    }
  };

  const summaryCards = [
    {
      title: 'Arrivals Today',
      value: overview.widgets.arrivalsToday,
      helper: 'Guests expected today',
      accent: '#B66A2B',
      icon: EventAvailableRounded,
      path: '/business/reservations/arrivals'
    },
    {
      title: 'In-House Guests',
      value: overview.widgets.inHouseGuests,
      helper: 'Currently staying',
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
      title: 'Due Out',
      value: overview.roomStatus.dueOut,
      helper: 'Departures requiring attention',
      accent: '#9A6A19',
      icon: LogoutRounded,
      path: '/business/rooms/status-board'
    }
  ];

  const statusTiles = [
    {
      label: 'Available clean',
      count: overview.roomStatus.clean,
      color: '#2E8B57',
      icon: CleaningServicesRounded
    },
    {
      label: 'Dirty',
      count: overview.roomStatus.dirty,
      color: '#C04A3A',
      icon: CleaningServicesRounded
    },
    {
      label: 'Occupied',
      count: overview.roomStatus.occupied,
      color: '#2B6CB0',
      icon: HotelRounded
    },
    {
      label: 'Reserved',
      count: overview.roomStatus.reserved,
      color: '#D9A11E',
      icon: EventAvailableRounded
    },
    {
      label: 'Out of order',
      count: overview.roomStatus.outOfOrder,
      color: '#5C4B51',
      icon: WarningAmberRounded
    },
    {
      label: 'Due out',
      count: overview.roomStatus.dueOut,
      color: '#7A5FB2',
      icon: LogoutRounded
    }
  ];

  const dashboardSurface = {
    bgcolor: isDark
      ? '#101A24'
      : '#FFFFFF',
    border: `1px solid ${
      isDark
        ? alpha('#FFFFFF', 0.07)
        : '#E2E8F0'
    }`,
    borderRadius: '16px',
    boxShadow: isDark
      ? '0 10px 30px rgba(0,0,0,0.16)'
      : '0 8px 30px rgba(15, 34, 57, 0.055)'
  };

  return (
    <Layout>
      <Box
        sx={{
          minHeight: '100%',
          bgcolor: isDark
            ? '#08131F'
            : '#F5F7FA',
          py: { xs: 2, md: 3 }
        }}
      >
        <Container maxWidth="xl">

          {/* ======================================================
              PERFORMANCE
          ====================================================== */}

          <Box sx={{ mb: 2.5 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1.5 }}
            >
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    letterSpacing: '-0.02em'
                  }}
                >
                  Performance this month
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.25 }}
                >
                  A quick view of your hotel's current performance.
                </Typography>
              </Box>
            </Stack>

            <PerformanceMetrics />
          </Box>

          {/* ======================================================
              FRONT DESK COMMAND CENTER
          ====================================================== */}

          <Card
            component={motion.div}
            initial={{
              opacity: 0,
              y: 14
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              duration: 0.35,
              ease: 'easeOut'
            }}
            sx={{
              mb: 2.5,
              overflow: 'hidden',
              borderRadius: '18px',
              border: 'none',
              color: '#F8FAFC',
              background: isDark
                ? 'linear-gradient(135deg, #102335 0%, #153652 58%, #1B3E5B 100%)'
                : 'linear-gradient(135deg, #102A43 0%, #163B5A 58%, #1E4B6B 100%)',
              boxShadow:
                '0 16px 38px rgba(15, 34, 57, 0.15)',
              position: 'relative'
            }}
          >
            {/* Decorative glow */}
            <Box
              sx={{
                position: 'absolute',
                width: 300,
                height: 300,
                right: -120,
                top: -180,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(217,164,65,0.22), transparent 68%)',
                pointerEvents: 'none'
              }}
            />

            <CardContent
              sx={{
                p: {
                  xs: 2.5,
                  md: 3.25
                },
                position: 'relative'
              }}
            >
              <Grid
                container
                spacing={{
                  xs: 3,
                  lg: 4
                }}
                alignItems="stretch"
              >

                {/* LEFT */}
                <Grid item xs={12} lg={7}>
                  <Stack
                    sx={{
                      height: '100%',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Box>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        sx={{ mb: 1.25 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: '#D9A441',
                            boxShadow:
                              '0 0 0 5px rgba(217,164,65,0.12)'
                          }}
                        />

                        <Typography
                          variant="caption"
                          sx={{
                            letterSpacing: '0.16em',
                            fontWeight: 800,
                            color: 'rgba(255,255,255,0.68)'
                          }}
                        >
                          FRONT DESK · TODAY
                        </Typography>
                      </Stack>

                      <Typography
                        sx={{
                          fontFamily:
                            '"Playfair Display", Georgia, serif',
                          fontSize: {
                            xs: '1.75rem',
                            md: '2.15rem'
                          },
                          lineHeight: 1.15,
                          fontWeight: 500,
                          letterSpacing: '-0.025em',
                          maxWidth: 650
                        }}
                      >
                        Everything your front desk needs,
                        in one place.
                      </Typography>

                      <Typography
                        variant="body2"
                        sx={{
                          mt: 1.5,
                          maxWidth: 650,
                          lineHeight: 1.75,
                          color: 'rgba(255,255,255,0.68)'
                        }}
                      >
                        Monitor arrivals, departures, room availability,
                        reservations and today's operational activity
                        without leaving the command center.
                      </Typography>
                    </Box>

                    {/* Operational snapshot */}
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                      sx={{ mt: 2.5 }}
                    >
                      <Chip
                        icon={
                          <EventAvailableRounded
                            sx={{
                              color: 'inherit !important'
                            }}
                          />
                        }
                        label={`${overview.widgets.arrivalsToday} arrivals`}
                        sx={{
                          bgcolor:
                            'rgba(255,255,255,0.09)',
                          color: '#FFFFFF',
                          border:
                            '1px solid rgba(255,255,255,0.08)',
                          fontWeight: 600
                        }}
                      />

                      <Chip
                        icon={
                          <LogoutRounded
                            sx={{
                              color: 'inherit !important'
                            }}
                          />
                        }
                        label={`${overview.roomStatus.dueOut} due out`}
                        sx={{
                          bgcolor:
                            'rgba(255,255,255,0.09)',
                          color: '#FFFFFF',
                          border:
                            '1px solid rgba(255,255,255,0.08)',
                          fontWeight: 600
                        }}
                      />

                      <Chip
                        icon={
                          <TrendingUpRounded
                            sx={{
                              color: 'inherit !important'
                            }}
                          />
                        }
                        label={`${occupancyPercent.toFixed(1)}% occupancy`}
                        sx={{
                          bgcolor:
                            'rgba(217,164,65,0.16)',
                          color: '#F3D58E',
                          border:
                            '1px solid rgba(217,164,65,0.2)',
                          fontWeight: 700
                        }}
                      />

                      <Typography
                        variant="caption"
                        sx={{
                          alignSelf: 'center',
                          ml: 0.5,
                          color:
                            'rgba(255,255,255,0.48)'
                        }}
                      >
                        Updated{' '}
                        {format(
                          new Date(
                            overview.generatedAt
                          ),
                          'MMM dd, HH:mm'
                        )}
                      </Typography>
                    </Stack>
                  </Stack>
                </Grid>

                {/* RIGHT — SEARCH */}
                <Grid item xs={12} lg={5}>
                  <Paper
                    elevation={0}
                    sx={{
                      height: '100%',
                      minHeight: {
                        xs: 'auto',
                        lg: 205
                      },
                      p: {
                        xs: 2,
                        md: 2.5
                      },
                      borderRadius: '14px',
                      bgcolor:
                        'rgba(255,255,255,0.075)',
                      border:
                        '1px solid rgba(255,255,255,0.10)',
                      backdropFilter: 'blur(10px)'
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      spacing={2}
                    >
                      <Box>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 800,
                            letterSpacing: '0.04em'
                          }}
                        >
                          Universal Search
                        </Typography>

                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            mt: 0.5,
                            lineHeight: 1.5,
                            color:
                              'rgba(255,255,255,0.60)'
                          }}
                        >
                          Find guests, reservations,
                          confirmations or invoices.
                        </Typography>
                      </Box>

                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<RefreshRounded />}
                        onClick={() =>
                          void loadDashboard(activityFilter)
                        }
                        disabled={
                          loading || runningAudit
                        }
                        sx={{
                          flexShrink: 0,
                          minWidth: 108,
                          borderRadius: '9px',
                          textTransform: 'none',
                          fontWeight: 700,
                          bgcolor: '#D9A441',
                          color: '#17212B',
                          '&:hover': {
                            bgcolor: '#E6B95B'
                          }
                        }}
                      >
                        Refresh
                      </Button>
                    </Stack>

                    <TextField
                      fullWidth
                      size="small"
                      value={searchTerm}
                      onChange={(event) =>
                        setSearchTerm(
                          event.target.value
                        )
                      }
                      placeholder="Search guest, reservation or invoice..."
                      sx={{
                        mt: 2,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          color: '#FFFFFF',
                          bgcolor:
                            'rgba(255,255,255,0.08)',
                          '& fieldset': {
                            borderColor:
                              'rgba(255,255,255,0.10)'
                          },
                          '&:hover fieldset': {
                            borderColor:
                              'rgba(255,255,255,0.20)'
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#D9A441'
                          }
                        },
                        '& input::placeholder': {
                          color:
                            'rgba(255,255,255,0.42)',
                          opacity: 1
                        }
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchRounded
                              sx={{
                                color:
                                  'rgba(255,255,255,0.55)'
                              }}
                            />
                          </InputAdornment>
                        )
                      }}
                    />

                    <Box
                      sx={{
                        mt: 1.5,
                        maxHeight: 110,
                        overflowY: 'auto'
                      }}
                    >
                      {searching && (
                        <Typography
                          variant="caption"
                          sx={{
                            color:
                              'rgba(255,255,255,0.62)'
                          }}
                        >
                          Searching reservations...
                        </Typography>
                      )}

                      {!searching &&
                        searchTerm.trim() &&
                        searchResults.length === 0 && (
                          <Typography
                            variant="caption"
                            sx={{
                              color:
                                'rgba(255,255,255,0.58)'
                            }}
                          >
                            No reservation matched
                            that search.
                          </Typography>
                        )}

                      {!searching &&
                        searchResults.length > 0 && (
                          <List
                            dense
                            disablePadding
                            sx={{
                              borderRadius: '8px',
                              overflow: 'hidden'
                            }}
                          >
                            {searchResults
                              .slice(0, 5)
                              .map(
                                (
                                  result,
                                  index
                                ) => (
                                  <Box
                                    key={
                                      result.id
                                    }
                                  >
                                    {index > 0 && (
                                      <Divider
                                        sx={{
                                          borderColor:
                                            'rgba(255,255,255,0.08)'
                                        }}
                                      />
                                    )}

                                    <ListItemButton
                                      onClick={() =>
                                        navigate(
                                          `/business/reservations/${result.reservationId}`
                                        )
                                      }
                                      sx={{
                                        px: 0.75,
                                        py: 0.65,
                                        borderRadius:
                                          '7px'
                                      }}
                                    >
                                      <ListItemText
                                        primary={
                                          <Stack
                                            direction="row"
                                            spacing={1}
                                            alignItems="center"
                                          >
                                            <Typography
                                              variant="caption"
                                              sx={{
                                                color:
                                                  '#FFFFFF',
                                                fontWeight: 700
                                              }}
                                            >
                                              {
                                                result.guestName
                                              }
                                            </Typography>

                                            <Chip
                                              size="small"
                                              label={
                                                result.bookingNumber
                                              }
                                              sx={{
                                                height: 20,
                                                bgcolor:
                                                  'rgba(255,255,255,0.10)',
                                                color:
                                                  '#FFFFFF'
                                              }}
                                            />
                                          </Stack>
                                        }
                                        secondary={
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              color:
                                                'rgba(255,255,255,0.52)'
                                            }}
                                          >
                                            {result.roomNumber
                                              ? `Room ${result.roomNumber}`
                                              : 'Unassigned'}{' '}
                                            ·{' '}
                                            {
                                              result.status
                                            }
                                          </Typography>
                                        }
                                      />
                                    </ListItemButton>
                                  </Box>
                                )
                              )}
                          </List>
                        )}
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* ======================================================
              QUICK OPERATIONAL METRICS
          ====================================================== */}

          <Grid
            container
            spacing={2}
            sx={{ mb: 2.5 }}
          >
            {summaryCards.map(
              (card, index) => (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  xl={3}
                  key={card.title}
                >
                  <Card
                    component={motion.div}
                    initial={{
                      opacity: 0,
                      y: 12
                    }}
                    animate={{
                      opacity: 1,
                      y: 0
                    }}
                    transition={{
                      duration: 0.25,
                      delay:
                        index * 0.04
                    }}
                    sx={{
                      height: '100%',
                      ...dashboardSurface,
                      transition:
                        'transform .2s ease, box-shadow .2s ease',
                      '&:hover': {
                        transform:
                          'translateY(-2px)',
                        boxShadow: isDark
                          ? '0 14px 32px rgba(0,0,0,.22)'
                          : '0 12px 32px rgba(15,34,57,.09)'
                      }
                    }}
                  >
                    <CardActionArea
                      sx={{
                        height: '100%'
                      }}
                      onClick={() =>
                        navigate(card.path)
                      }
                    >
                      <CardContent
                        sx={{
                          p: 2.25
                        }}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color:
                                  'text.secondary',
                                fontWeight: 700,
                                letterSpacing:
                                  '0.08em',
                                textTransform:
                                  'uppercase'
                              }}
                            >
                              {card.title}
                            </Typography>

                            <Typography
                              sx={{
                                mt: 0.75,
                                fontSize:
                                  '1.8rem',
                                fontWeight: 800,
                                lineHeight: 1.1,
                                letterSpacing:
                                  '-0.03em'
                              }}
                            >
                              {card.value}
                            </Typography>
                          </Box>

                          <Box
                            sx={{
                              width: 44,
                              height: 44,
                              borderRadius:
                                '12px',
                              display: 'grid',
                              placeItems:
                                'center',
                              bgcolor:
                                alpha(
                                  card.accent,
                                  isDark
                                    ? 0.18
                                    : 0.10
                                ),
                              color:
                                card.accent
                            }}
                          >
                            <card.icon />
                          </Box>
                        </Stack>

                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={{ mt: 1.5 }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {card.helper}
                          </Typography>

                          <ArrowForwardRounded
                            sx={{
                              fontSize: 17,
                              color:
                                'text.disabled'
                            }}
                          />
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              )
            )}
          </Grid>

          {/* ======================================================
              LOADING / ERROR
          ====================================================== */}

          {(loading || runningAudit) && (
            <LogoLoader
              inline
              minHeight={120}
              label={
                runningAudit
                  ? 'Running night audit'
                  : 'Refreshing dashboard'
              }
            />
          )}

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2.5,
                borderRadius: '12px'
              }}
            >
              {error}
            </Alert>
          )}

          {/* ======================================================
              ROOM STATUS + ACTIVITY
          ====================================================== */}

          <Grid container spacing={2.5}>

            {/* ROOM STATUS */}
            <Grid item xs={12} lg={5}>
              <Paper
                sx={{
                  p: {
                    xs: 2,
                    md: 2.75
                  },
                  height: '100%',
                  ...dashboardSurface
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  sx={{ mb: 2.25 }}
                >
                  <Box>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 800,
                        letterSpacing:
                          '-0.02em'
                      }}
                    >
                      Room Status
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mt: 0.4
                      }}
                    >
                      Live inventory overview.
                    </Typography>
                  </Box>

                  <Button
                    size="small"
                    endIcon={
                      <ArrowForwardRounded />
                    }
                    onClick={() =>
                      navigate(
                        '/business/rooms/status-board'
                      )
                    }
                    sx={{
                      textTransform:
                        'none',
                      fontWeight: 700
                    }}
                  >
                    Open board
                  </Button>
                </Stack>

                <Grid
                  container
                  spacing={1.25}
                >
                  {statusTiles.map(
                    (tile) => {
                      const TileIcon =
                        tile.icon;

                      return (
                        <Grid
                          item
                          xs={6}
                          key={tile.label}
                        >
                          <Box
                            sx={{
                              p: 1.5,
                              minHeight: 86,
                              borderRadius:
                                '12px',
                              bgcolor:
                                alpha(
                                  tile.color,
                                  isDark
                                    ? 0.12
                                    : 0.055
                                ),
                              border:
                                `1px solid ${alpha(
                                  tile.color,
                                  isDark
                                    ? 0.20
                                    : 0.12
                                )}`
                            }}
                          >
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="flex-start"
                            >
                              <Box>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {
                                    tile.label
                                  }
                                </Typography>

                                <Typography
                                  sx={{
                                    mt: 0.5,
                                    fontSize:
                                      '1.4rem',
                                    fontWeight: 800
                                  }}
                                >
                                  {
                                    tile.count
                                  }
                                </Typography>
                              </Box>

                              <TileIcon
                                sx={{
                                  fontSize: 19,
                                  color:
                                    tile.color,
                                  opacity:
                                    0.9
                                }}
                              />
                            </Stack>
                          </Box>
                        </Grid>
                      );
                    }
                  )}
                </Grid>

                <Divider
                  sx={{
                    my: 2
                  }}
                />

                <Stack
                  direction="row"
                  spacing={1}
                  flexWrap="wrap"
                  useFlexGap
                >
                  <Chip
                    size="small"
                    label={`Vacant ${overview.roomStatus.vacant}`}
                    color="success"
                    variant="outlined"
                  />

                  <Chip
                    size="small"
                    label={`Blocked ${overview.roomStatus.blocked}`}
                    variant="outlined"
                  />

                  <Chip
                    size="small"
                    label={`Today ₦${overview.revenue.today.toLocaleString()}`}
                    variant="outlined"
                  />

                  <Chip
                    size="small"
                    label={`POS ₦${overview.revenue.posSales.toLocaleString()}`}
                    variant="outlined"
                  />
                </Stack>
              </Paper>
            </Grid>

            {/* RECENT ACTIVITY */}
            <Grid item xs={12} lg={7}>
              <Paper
                sx={{
                  p: {
                    xs: 2,
                    md: 2.75
                  },
                  height: '100%',
                  ...dashboardSurface
                }}
              >
                <Stack
                  direction={{
                    xs: 'column',
                    md: 'row'
                  }}
                  justifyContent="space-between"
                  alignItems={{
                    xs: 'flex-start',
                    md: 'center'
                  }}
                  spacing={1.5}
                  sx={{
                    mb: 1.5
                  }}
                >
                  <Box>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 800,
                        letterSpacing:
                          '-0.02em'
                      }}
                    >
                      Recent Activity
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mt: 0.4
                      }}
                    >
                      Latest front-office
                      reservation activity.
                    </Typography>
                  </Box>

                  <TextField
                    select
                    size="small"
                    value={activityFilter}
                    onChange={(event) =>
                      setActivityFilter(
                        event.target
                          .value as
                          | 'ALL'
                          | DashboardActivityType
                      )
                    }
                    sx={{
                      minWidth: 180,
                      '& .MuiOutlinedInput-root':
                        {
                          borderRadius:
                            '9px'
                        }
                    }}
                  >
                    {activityOptions.map(
                      (option) => (
                        <MenuItem
                          key={
                            option.value
                          }
                          value={
                            option.value
                          }
                        >
                          {option.label}
                        </MenuItem>
                      )
                    )}
                  </TextField>
                </Stack>

                {overview.recentActivity
                  .length === 0 ? (
                  <Box
                    sx={{
                      minHeight: 220,
                      display: 'flex',
                      flexDirection:
                        'column',
                      alignItems:
                        'center',
                      justifyContent:
                        'center',
                      textAlign: 'center',
                      color:
                        'text.secondary'
                    }}
                  >
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius:
                          '14px',
                        display: 'grid',
                        placeItems:
                          'center',
                        bgcolor: isDark
                          ? alpha(
                              '#FFFFFF',
                              0.05
                            )
                          : '#F1F5F9',
                        mb: 1.25
                      }}
                    >
                      <HotelRounded
                        sx={{
                          color:
                            'text.disabled'
                        }}
                      />
                    </Box>

                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 700,
                        color:
                          'text.primary'
                      }}
                    >
                      No recent activity
                    </Typography>

                    <Typography
                      variant="caption"
                      sx={{
                        mt: 0.5
                      }}
                    >
                      No activity matched
                      the current filter.
                    </Typography>
                  </Box>
                ) : (
                  <List
                    disablePadding
                    sx={{
                      mt: 0.5
                    }}
                  >
                    {overview.recentActivity.map(
                      (
                        item,
                        index
                      ) => {
                        const icon =
                          item.type ===
                          'CHECK_IN' ? (
                            <LoginRounded fontSize="small" />
                          ) : item.type ===
                            'CHECK_OUT' ? (
                            <LogoutRounded fontSize="small" />
                          ) : item.type ===
                            'CANCEL_RESERVATION' ? (
                            <BlockRounded fontSize="small" />
                          ) : (
                            <HotelRounded fontSize="small" />
                          );

                        return (
                          <Box
                            key={
                              item.id
                            }
                          >
                            {index > 0 && (
                              <Divider />
                            )}

                            <ListItemButton
                              onClick={() => {
                                if (
                                  item.entityId
                                ) {
                                  navigate(
                                    `/business/reservations/${item.entityId}`
                                  );
                                }
                              }}
                              sx={{
                                px: 0.5,
                                py: 1.35,
                                borderRadius:
                                  '8px',
                                '&:hover':
                                  {
                                    bgcolor:
                                      isDark
                                        ? alpha(
                                            '#FFFFFF',
                                            0.04
                                          )
                                        : '#F8FAFC'
                                  }
                              }}
                            >
                              <Box
                                sx={{
                                  width: 36,
                                  height: 36,
                                  borderRadius:
                                    '10px',
                                  display:
                                    'grid',
                                  placeItems:
                                    'center',
                                  mr: 1.5,
                                  bgcolor:
                                    isDark
                                      ? alpha(
                                          '#2D648B',
                                          0.18
                                        )
                                      : '#EFF6FA',
                                  color:
                                    '#2D648B',
                                  flexShrink: 0
                                }}
                              >
                                {icon}
                              </Box>

                              <ListItemText
                                primary={
                                  <Stack
                                    direction={{
                                      xs: 'column',
                                      sm: 'row'
                                    }}
                                    spacing={
                                      1
                                    }
                                    alignItems={{
                                      sm: 'center'
                                    }}
                                  >
                                    <Typography
                                      variant="subtitle2"
                                      sx={{
                                        fontWeight:
                                          700
                                      }}
                                    >
                                      {
                                        item.label
                                      }
                                    </Typography>

                                    {item.details && (
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                      >
                                        {
                                          item.details
                                        }
                                      </Typography>
                                    )}
                                  </Stack>
                                }
                                secondary={
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                      display:
                                        'block',
                                      mt: 0.5
                                    }}
                                  >
                                    {
                                      item.actorName
                                    }{' '}
                                    ·{' '}
                                    {format(
                                      new Date(
                                        item.createdAt
                                      ),
                                      'MMM dd, yyyy HH:mm'
                                    )}
                                  </Typography>
                                }
                              />
                            </ListItemButton>
                          </Box>
                        );
                      }
                    )}
                  </List>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* ======================================================
              NIGHT AUDIT
          ====================================================== */}

          {canRunNightAudit && (
            <Paper
              sx={{
                mt: 2.5,
                px: 2,
                py: 1.5,
                borderRadius: '12px',
                bgcolor: isDark
                  ? alpha(
                      '#D9A441',
                      0.08
                    )
                  : '#FFF9EC',
                border: `1px solid ${
                  isDark
                    ? alpha(
                        '#D9A441',
                        0.18
                      )
                    : '#F1DEB0'
                }`,
              }}
            >
              <Stack
                direction={{
                  xs: 'column',
                  sm: 'row'
                }}
                justifyContent="space-between"
                alignItems={{
                  xs: 'flex-start',
                  sm: 'center'
                }}
                spacing={1.5}
              >
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 800
                    }}
                  >
                    Accounting Operations
                  </Typography>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    Run the nightly audit when
                    the day's front-office
                    operations are complete.
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  disabled={
                    loading || runningAudit
                  }
                  onClick={() =>
                    void runNightAudit()
                  }
                  sx={{
                    borderRadius: '9px',
                    textTransform:
                      'none',
                    fontWeight: 700,
                    bgcolor: '#B66A2B',
                    '&:hover': {
                      bgcolor: '#9C5921'
                    }
                  }}
                >
                  {runningAudit
                    ? 'Running...'
                    : 'Run Night Audit'}
                </Button>
              </Stack>
            </Paper>
          )}

        </Container>
      </Box>
    </Layout>
  );
};

export default DashboardPage;
