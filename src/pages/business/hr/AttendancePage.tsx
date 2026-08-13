import HrTabs from './HrTabs';
import Layout from '../../../components/Layout';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { hrService, type AttendanceRecord } from '../../../services/hr.service';

const STATUS_COLOR: Record<AttendanceRecord['status'], 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'error',
  HALF_DAY: 'info',
  HOLIDAY: 'default'
};

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

const AttendancePage = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [clocking, setClocking] = useState(false);

  const [range, setRange] = useState({
    from: isoDay(new Date(Date.now() - 6 * 86_400_000)),
    to: isoDay(new Date())
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await hrService.listAttendance({ from: range.from, to: range.to }));
      setError('');
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string; message?: string } } }).response;
      setError(
        response?.data?.error === 'FEATURE_DISABLED'
          ? 'The HR module is not included in your current plan.'
          : response?.data?.message || 'Failed to load attendance'
      );
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Requests GPS if the browser offers it, but never blocks the clock action:
   * a denied or unavailable location falls back to a MANUAL punch.
   */
  const getPosition = () =>
    new Promise<{ lat?: number; lng?: number; method: string }>((resolve) => {
      if (!navigator.geolocation) {
        resolve({ method: 'MANUAL' });
        return;
      }

      const timer = setTimeout(() => resolve({ method: 'MANUAL' }), 5000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timer);
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            method: 'GPS'
          });
        },
        () => {
          clearTimeout(timer);
          resolve({ method: 'MANUAL' });
        },
        { timeout: 5000 }
      );
    });

  const clock = async (direction: 'in' | 'out') => {
    setClocking(true);
    try {
      const position = await getPosition();
      const payload = { method: position.method, lat: position.lat, lng: position.lng };

      if (direction === 'in') {
        await hrService.clockIn(payload);
        setToast(position.method === 'GPS' ? 'Clocked in with location' : 'Clocked in');
      } else {
        await hrService.clockOut(payload);
        setToast('Clocked out');
      }

      await load();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      setError(response?.data?.error || `Failed to clock ${direction}`);
    } finally {
      setClocking(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <HrTabs />
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Attendance
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Daily clock-in and clock-out log.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<LoginIcon />}
            onClick={() => void clock('in')}
            disabled={clocking}
          >
            Clock In
          </Button>
          <Button
            variant="outlined"
            startIcon={<LogoutIcon />}
            onClick={() => void clock('out')}
            disabled={clocking}
          >
            Clock Out
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="From"
          type="date"
          size="small"
          value={range.from}
          onChange={(event) => setRange((r) => ({ ...r, from: event.target.value }))}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="To"
          type="date"
          size="small"
          value={range.to}
          onChange={(event) => setRange((r) => ({ ...r, to: event.target.value }))}
          InputLabelProps={{ shrink: true }}
        />
      </Stack>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Employee</TableCell>
              <TableCell>Clock in</TableCell>
              <TableCell>Clock out</TableCell>
              <TableCell align="right">Hours</TableCell>
              <TableCell align="right">Overtime</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            )}

            {!loading && records.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                  <EventAvailableIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    No attendance records
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Nothing logged for the selected dates.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              records.map((record) => (
                <TableRow key={record.id} hover>
                  <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {record.staff ? `${record.staff.firstName} ${record.staff.lastName}` : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : '—'}
                  </TableCell>
                  <TableCell>
                    {record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : '—'}
                  </TableCell>
                  <TableCell align="right">{record.totalHours.toFixed(2)}</TableCell>
                  <TableCell align="right">
                    {record.overtimeHours > 0 ? (
                      <Typography variant="body2" fontWeight={600} color="warning.main">
                        {record.overtimeHours.toFixed(2)}
                      </Typography>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={record.status.replace('_', ' ')} color={STATUS_COLOR[record.status]} />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3000}
        onClose={() => setToast('')}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
};

/**
 * Wrapped in Layout so this page carries the same sidebar, header, and
 * page chrome as the rest of the dashboard. Wrapping at the export keeps
 * the loading and error early-returns inside the shell too.
 */
const AttendancePageWithLayout = () => (
  <Layout>
    <AttendancePage />
  </Layout>
);

export default AttendancePageWithLayout;
