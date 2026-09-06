import { useEffect, useState } from 'react';
import { Box, Button, Card, Chip, Stack, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import TimerRounded from '@mui/icons-material/TimerRounded';
import PauseCircleRounded from '@mui/icons-material/PauseCircleRounded';
import { useNavigate } from 'react-router-dom';
import { Shift, shiftService } from '../../services/shift.service';
import { brand } from '../../theme/theme';
import { formatCurrency } from '../../utils/formatters';

/**
 * Whether this person's till is open, at the top of their dashboard.
 *
 * Roles that run a till used to land on the shift screen itself: a full page
 * holding a single button. Moving the shift onto the dashboard keeps it the
 * first thing they see — it gates most of their work — without spending an
 * entire screen on it.
 *
 * Read-only by design. Opening a shift asks for an opening cash figure and
 * closing one reconciles against it, so both stay on the shift screen where
 * there is room to do that carefully; this reports state and links there.
 */
const ShiftStatusBar = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';

  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    shiftService
      .getMine()
      .then((result) => {
        if (active) setShift(result?.shift ?? null);
      })
      // A role that cannot open shifts is refused here; the bar then simply
      // reports no open shift rather than surfacing an error for a feature
      // that role never uses.
      .catch(() => {
        if (active) setShift(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return null;

  const open = shift?.status === 'OPEN';
  const onBreak = shift?.status === 'ON_BREAK';
  const isActive = open || onBreak;

  const accent = onBreak ? brand.amber : open ? brand.emerald : brand.smoke;
  const openedAt = shift?.openedAt ? new Date(shift.openedAt) : null;

  return (
    <Card
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.25 },
        borderRadius: 3,
        border: '1px solid',
        borderColor: alpha(accent, isDark ? 0.35 : 0.25),
        background: alpha(accent, isDark ? 0.1 : 0.05)
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <Stack direction="row" spacing={1.75} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              color: accent,
              background: alpha(accent, isDark ? 0.2 : 0.12),
              flexShrink: 0
            }}
          >
            {onBreak ? <PauseCircleRounded /> : open ? <TimerRounded /> : <PlayArrowRounded />}
          </Box>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 700 }}>
                {onBreak ? 'Shift on break' : open ? 'Shift open' : 'No shift open'}
              </Typography>
              {isActive ? (
                <Chip
                  size="small"
                  label={onBreak ? 'Paused' : 'Live'}
                  sx={{
                    height: 20,
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '.06em',
                    color: accent,
                    background: alpha(accent, 0.16)
                  }}
                />
              ) : null}
            </Stack>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              {isActive && openedAt
                ? `Opened ${openedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` +
                  (typeof shift?.openingCash === 'number'
                    ? ` · float ${formatCurrency(shift.openingCash)}`
                    : '')
                : 'Sales and payments are recorded against an open shift.'}
            </Typography>
          </Box>
        </Stack>

        <Button
          variant={isActive ? 'outlined' : 'contained'}
          size="small"
          onClick={() => navigate('/shift')}
          sx={{ flexShrink: 0, minHeight: 38 }}
        >
          {isActive ? 'Manage shift' : 'Open shift'}
        </Button>
      </Stack>
    </Card>
  );
};

export default ShiftStatusBar;
