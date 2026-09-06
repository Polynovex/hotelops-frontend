import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, Chip, Divider, Stack, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import LoginRounded from '@mui/icons-material/LoginRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import HotelRounded from '@mui/icons-material/HotelRounded';
import EventAvailableRounded from '@mui/icons-material/EventAvailableRounded';
import PeopleAltRounded from '@mui/icons-material/PeopleAltRounded';
import CleaningServicesRounded from '@mui/icons-material/CleaningServicesRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import BadgeRounded from '@mui/icons-material/BadgeRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import {
  DashboardShell,
  MetricCard,
  MetricGrid,
  QuickActions,
  SectionBlock,
  ShiftStatusBar
} from '../../components/dashboard';
import type { QuickAction } from '../../components/dashboard';
import { DashboardOverview, dashboardService } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../utils/apiError';

/**
 * The front desk's landing screen.
 *
 * Receptionists and front office managers previously signed in to the shift
 * page — an otherwise empty screen holding one button — and had to find
 * arrivals, departures and room status through the sidebar. This answers the
 * questions the desk actually opens the day with: who is arriving, who is
 * leaving, how full are we, and which rooms are ready to sell.
 *
 * Every figure comes from the same /dashboard payload the owner's view uses;
 * front-desk roles are authorised for it, so nothing here is estimated.
 */
const ReceptionDashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isDark = theme.palette.mode === 'dark';

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await dashboardService.getOverview());
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load today’s figures.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const widgets = overview?.widgets;
  const rooms = overview?.roomStatus;

  const firstName = user?.firstName?.trim() || 'there';
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const actions: QuickAction[] = [
    {
      label: 'New reservation',
      hint: 'Walk-in or phone booking',
      icon: CalendarMonthRounded,
      primary: true,
      onClick: () => navigate('/business/reservations/create')
    },
    {
      label: 'Check in',
      hint: 'Today’s arrivals',
      icon: LoginRounded,
      onClick: () => navigate('/business/reservations/arrivals')
    },
    {
      label: 'Check out',
      hint: 'Due to leave',
      icon: LogoutRounded,
      onClick: () => navigate('/business/reservations/departures')
    },
    {
      label: 'Stay view',
      hint: 'Room-by-room calendar',
      icon: EventAvailableRounded,
      onClick: () => navigate('/reception/stay-view')
    },
    {
      label: 'In-house',
      hint: 'Guests staying now',
      icon: HotelRounded,
      onClick: () => navigate('/business/reservations/in-house')
    },
    {
      label: 'Guest profiles',
      hint: 'Search and history',
      icon: BadgeRounded,
      onClick: () => navigate('/business/profiles')
    }
  ];

  /**
   * Rooms that cannot be sold until somebody does something.
   *
   * Surfaced as a single figure because it is the one number on this screen
   * that is a task rather than a statistic.
   */
  const needsAttention = (rooms?.dirty ?? 0) + (rooms?.outOfOrder ?? 0);

  const sellable = rooms?.vacant ?? 0;
  const occupancy = widgets?.occupancyRate ?? 0;

  return (
    <DashboardShell
      eyebrow="Front desk"
      title={`${greeting}, ${firstName}.`}
      subtitle="Everything the desk needs for today, in the order the day happens."
      actions={
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshRounded />}
          onClick={() => void load()}
          disabled={loading}
          sx={{ minHeight: 38 }}
        >
          Refresh
        </Button>
      }
    >
      <ShiftStatusBar />

      {error ? (
        <Alert severity="warning" action={<Button size="small" onClick={() => void load()}>Retry</Button>}>
          {error}
        </Alert>
      ) : null}

      <SectionBlock
        title="Today at a glance"
        description="Live from the property management system."
      >
        <MetricGrid>
          <MetricCard
            label="Arrivals today"
            value={widgets?.arrivalsToday ?? 0}
            caption="Guests expected"
            icon={LoginRounded}
            loading={loading}
            tone={(widgets?.arrivalsToday ?? 0) > 0 ? 'primary' : 'neutral'}
            onClick={() => navigate('/business/reservations/arrivals')}
          />
          <MetricCard
            label="Due out"
            value={rooms?.dueOut ?? 0}
            caption="Checking out today"
            icon={LogoutRounded}
            loading={loading}
            tone={(rooms?.dueOut ?? 0) > 0 ? 'attention' : 'neutral'}
            onClick={() => navigate('/business/reservations/departures')}
          />
          <MetricCard
            label="In house"
            value={widgets?.inHouseGuests ?? 0}
            caption="Guests staying tonight"
            icon={PeopleAltRounded}
            loading={loading}
            onClick={() => navigate('/business/reservations/in-house')}
          />
          <MetricCard
            label="Occupancy"
            value={`${Math.round(occupancy)}%`}
            caption={`${widgets?.occupiedRooms ?? 0} of ${widgets?.totalRooms ?? 0} rooms`}
            icon={HotelRounded}
            loading={loading}
            tone={occupancy >= 80 ? 'good' : 'neutral'}
          />
        </MetricGrid>
      </SectionBlock>

      <SectionBlock title="Quick actions" description="The things the desk does most.">
        <QuickActions actions={actions} />
      </SectionBlock>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gap: { xs: 3, md: 3.5 },
          alignItems: 'start'
        }}
      >
        <SectionBlock
          title="Room readiness"
          description="What you can sell right now."
          action={
            <Button size="small" onClick={() => navigate('/business/rooms/status-board')}>
              Status board
            </Button>
          }
        >
          <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Stack divider={<Divider flexItem />}>
              <RoomRow
                label="Ready to sell"
                value={sellable}
                tone="good"
                hint="Vacant and clean"
              />
              <RoomRow
                label="Needs housekeeping"
                value={needsAttention}
                tone={needsAttention > 0 ? 'attention' : 'neutral'}
                hint="Dirty or out of order"
              />
              <RoomRow label="Occupied" value={rooms?.occupied ?? 0} tone="neutral" hint="Guests in residence" />
              <RoomRow label="Reserved" value={rooms?.reserved ?? 0} tone="neutral" hint="Held for arrivals" />
            </Stack>
          </Card>
        </SectionBlock>

        <SectionBlock
          title="Recent activity"
          description="What the desk has done in the last few hours."
        >
          <Card
            elevation={0}
            sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}
          >
            {overview?.recentActivity?.length ? (
              <Stack divider={<Divider flexItem />}>
                {overview.recentActivity.slice(0, 6).map((entry) => (
                  <Stack
                    key={entry.id}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={2}
                    sx={{ px: 2.25, py: 1.5 }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>
                        {entry.label}
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }} noWrap>
                        {[entry.details, entry.actorName].filter(Boolean).join(' · ')}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={new Date(entry.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      sx={{
                        height: 22,
                        fontSize: 11,
                        fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0,
                        background: alpha(theme.palette.text.primary, isDark ? 0.12 : 0.05)
                      }}
                    />
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Nothing yet today</Typography>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
                  Check-ins, check-outs and new bookings will appear here as they happen.
                </Typography>
              </Box>
            )}
          </Card>
        </SectionBlock>
      </Box>
    </DashboardShell>
  );
};

/** One line of the room-readiness breakdown. */
const RoomRow = ({
  label,
  value,
  hint,
  tone
}: {
  label: string;
  value: number;
  hint: string;
  tone: 'good' | 'attention' | 'neutral';
}) => {
  const theme = useTheme();
  const color =
    tone === 'good'
      ? theme.palette.success.main
      : tone === 'attention'
        ? theme.palette.warning.main
        : theme.palette.text.primary;

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={2}
      sx={{ px: 2.25, py: 1.75 }}
    >
      <Box>
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{hint}</Typography>
      </Box>
      <Stack direction="row" spacing={1} alignItems="center">
        {tone === 'attention' && value > 0 ? (
          <CleaningServicesRounded sx={{ fontSize: 17, color }} />
        ) : null}
        <Typography
          sx={{
            fontFamily: '"Inter", system-ui, sans-serif',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 22,
            fontWeight: 700,
            color
          }}
        >
          {value}
        </Typography>
      </Stack>
    </Stack>
  );
};

export default ReceptionDashboard;
