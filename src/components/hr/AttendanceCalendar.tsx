import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, Stack, Typography } from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { hrService } from '../../services/hr.service';
import { getApiErrorMessage } from '../../utils/apiError';

/** On time green, late red, on leave yellow, overtime blue. */
export const ATTENDANCE_COLORS = { onTime: '#16A34A', late: '#DC2626', onLeave: '#D97706', overtime: '#2563EB' } as const;
const LABEL = { onTime: 'On time', late: 'Late', onLeave: 'On leave', overtime: 'Overtime' } as const;
type Counts = { onTime: number; late: number; onLeave: number; overtime: number; rostered: number };

/**
 * The month at a glance: each day's on-time, late, on-leave and overtime
 * counts. Clicking a day gives the numbers and a way into Attendance.
 */
const AttendanceCalendar: React.FC = () => {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [days, setDays] = useState<Record<string, Counts>>({});
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    hrService
      .attendanceCalendar(month)
      .then((r) => { setDays(r.days); setError(''); })
      .catch((err) => setError(getApiErrorMessage(err, 'Could not load the calendar')));
  }, [month]);

  const grid = useMemo(() => {
    const first = new Date(`${month}-01T00:00:00Z`);
    const lead = (first.getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  }, [month]);

  const shift = (n: number) => {
    const d = new Date(`${month}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
  };
  const today = new Date().toISOString().slice(0, 10);
  const pickedCounts = picked ? days[picked] : null;

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <IconButton onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeftRoundedIcon /></IconButton>
        <Typography fontWeight={800}>{new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</Typography>
        <IconButton onClick={() => shift(1)} aria-label="Next month"><ChevronRightRoundedIcon /></IconButton>
      </Stack>
      {error && <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.5 }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <Typography key={d} variant="caption" fontWeight={700} color="text.secondary" textAlign="center">{d}</Typography>)}
        {grid.map((ymd, i) => {
          if (!ymd) return <Box key={`blank-${i}`} />;
          const c = days[ymd];
          const any = c && (c.onTime || c.late || c.onLeave || c.overtime);
          return (
            <Box key={ymd} role="button" tabIndex={0} onClick={() => setPicked(ymd)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setPicked(ymd)}
              sx={{ minHeight: { xs: 56, md: 84 }, p: 0.75, borderRadius: 1.5, border: '1px solid', borderColor: ymd === today ? 'primary.main' : 'divider', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
              <Typography variant="caption" fontWeight={any ? 800 : 500}>{Number(ymd.slice(8))}</Typography>
              {c && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                  {(['onTime', 'late', 'onLeave', 'overtime'] as const).filter((k) => c[k] > 0).map((k) => (
                    <Box key={k} title={LABEL[k]} sx={{ px: 0.6, borderRadius: 1, bgcolor: ATTENDANCE_COLORS[k], color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: '18px' }}>{c[k]}</Box>
                  ))}
                </Stack>
              )}
            </Box>
          );
        })}
      </Box>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
        {(Object.keys(LABEL) as Array<keyof typeof LABEL>).map((k) => (
          <Stack key={k} direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: ATTENDANCE_COLORS[k] }} />
            <Typography variant="caption">{LABEL[k]}</Typography>
          </Stack>
        ))}
      </Stack>

      <Dialog open={Boolean(picked)} onClose={() => setPicked(null)} fullWidth maxWidth="xs">
        <DialogTitle>{picked && new Date(`${picked}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            {(Object.keys(LABEL) as Array<keyof typeof LABEL>).map((k) => (
              <Stack key={k} direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: ATTENDANCE_COLORS[k] }} /><Typography>{LABEL[k]}</Typography></Stack>
                <Typography fontWeight={800}>{pickedCounts?.[k] ?? 0}</Typography>
              </Stack>
            ))}
            <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Rostered</Typography><Typography fontWeight={700}>{pickedCounts?.rostered ?? 0}</Typography></Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPicked(null)}>Close</Button>
          <Button variant="contained" onClick={() => navigate(`/business/hr/attendance?date=${picked}`)}>View in attendance</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default AttendanceCalendar;
