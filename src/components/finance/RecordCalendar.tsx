import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { STATUS_LABEL, type CalendarDay } from '../../services/dailyRecords';

/**
 * Colour-coded month of daily records:
 *   green  — approved
 *   red    — not approved (submitted or rejected)
 *   yellow — edit requested
 *   none   — no record
 * Days outside the viewer's window are greyed out.
 */
const COLOURS = {
  GREEN: { bg: '#e3f5ea', border: '#5bb37f', text: '#1d6b3c' },
  RED: { bg: '#fde8e6', border: '#d9534f', text: '#9b2420' },
  YELLOW: { bg: '#fff5d6', border: '#e0b024', text: '#8a6500' },
  NONE: { bg: 'transparent', border: 'transparent', text: 'inherit' }
} as const;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function RecordCalendar({
  month,
  days,
  selected,
  onMonthChange,
  onSelect
}: {
  month: string;
  days: CalendarDay[];
  selected?: string | null;
  onMonthChange: (month: string) => void;
  onSelect: (day: CalendarDay) => void;
}) {
  const first = new Date(`${month}-01T00:00:00Z`);
  const leading = (first.getUTCDay() + 6) % 7; // Monday-first grid
  const shift = (delta: number) => {
    const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1));
    onMonthChange(next.toISOString().slice(0, 7));
  };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <IconButton onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeftRounded /></IconButton>
        <Typography fontWeight={800}>
          {first.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </Typography>
        <IconButton onClick={() => shift(1)} aria-label="Next month"><ChevronRightRounded /></IconButton>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
        {WEEKDAYS.map((day) => (
          <Typography key={day} variant="caption" color="text.secondary" align="center">{day}</Typography>
        ))}
        {Array.from({ length: leading }).map((_, index) => <Box key={`pad-${index}`} />)}
        {days.map((day) => {
          const colour = COLOURS[day.colour];
          const future = day.date > today;
          return (
            <Tooltip key={day.date} title={day.hidden ? 'Outside your view' : day.status ? STATUS_LABEL[day.status] : future ? '' : 'No record'}>
              <Box
                component="button"
                type="button"
                disabled={day.hidden || future}
                onClick={() => onSelect(day)}
                sx={{
                  aspectRatio: '1 / 1',
                  minHeight: 36,
                  borderRadius: 1.5,
                  border: '2px solid',
                  borderColor: selected === day.date ? 'primary.main' : colour.border,
                  bgcolor: colour.bg,
                  color: day.hidden || future ? 'text.disabled' : colour.text,
                  fontWeight: 700,
                  cursor: day.hidden || future ? 'default' : 'pointer',
                  opacity: day.hidden ? 0.4 : 1,
                  font: 'inherit'
                }}
              >
                {Number(day.date.slice(8))}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
      <Stack direction="row" spacing={2} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
        {(['GREEN', 'RED', 'YELLOW'] as const).map((key) => (
          <Stack key={key} direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: COLOURS[key].bg, border: `2px solid ${COLOURS[key].border}` }} />
            <Typography variant="caption">{key === 'GREEN' ? 'Approved' : key === 'RED' ? 'Not approved / rejected' : 'Edit requested'}</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
