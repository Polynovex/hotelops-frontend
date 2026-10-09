import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import {
  Badge,
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItemButton,
  Popover,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import NotificationsRounded from '@mui/icons-material/NotificationsRounded';
import NotificationsActiveRounded from '@mui/icons-material/NotificationsActiveRounded';
import { useAuthStore } from '../store/authStore';
import { useInboxStore, type InboxItem } from '../store/inboxStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { playChime, type ChimeKind } from '../utils/alertChime';

/**
 * Header notification centre.
 *
 * Real-time when the socket is up: any event addressed to this user triggers an
 * immediate refetch. The socket is optional infrastructure (it is absent in
 * some deployments and drops on flaky networks), so the inbox is also polled —
 * a housekeeper's "room done" reaches the supervisor within the poll interval
 * even with no socket at all.
 *
 * New arrivals play a chime and show a toast. The chime shape follows urgency:
 * a completed room is the rising "order" tone, a rejection or a flagged cleaner
 * the insistent "urgent" one, everything else a single soft note.
 */

const POLL_MS = 20_000;

/** Socket events that mean "your inbox changed". */
const INBOX_EVENTS = [
  'notification.created',
  'housekeeping.task.completed',
  'housekeeping.task.assigned',
  'housekeeping.task.approved',
  'housekeeping.task.rejected',
  'housekeeping.room_dirty',
  'housekeeping.cleaner_flagged'
];

const chimeFor = (item: InboxItem): ChimeKind => {
  if (item.type === 'TASK_REJECTED' || item.type === 'CLEANER_FLAGGED') return 'urgent';
  if (item.type === 'TASK_COMPLETED' || item.type === 'ROOM_DIRTY') return 'order';
  return 'soft';
};

const variantFor = (item: InboxItem): 'success' | 'info' | 'warning' | 'error' => {
  if (item.type === 'TASK_REJECTED' || item.type.endsWith('_REJECTED')) return 'error';
  if (item.type === 'CLEANER_FLAGGED' || item.type.endsWith('_PENDING')) return 'warning';
  if (item.type === 'TASK_COMPLETED' || item.type.endsWith('_APPROVED')) return 'success';
  return 'info';
};

const CATEGORY_LABEL: Record<string, string> = {
  HOUSEKEEPING: 'Housekeeping',
  HR: 'HR',
  POS: 'POS',
  FINANCE: 'Finance',
  SYSTEM: 'System'
};

const timeAgo = (iso: string) => {
  const seconds = Math.max(Math.round((Date.now() - new Date(iso).getTime()) / 1000), 0);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
};

export function NotificationCenter() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { on } = useWebSocket();
  const userId = useAuthStore((state) => state.user?.id);
  const { items, unreadCount, refresh, markRead, markAllRead, reset } = useInboxStore();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [ringing, setRinging] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!userId) {
      reset();
      return;
    }

    let active = true;

    const load = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const fresh = await refresh();
        if (!active || fresh.length === 0) return;

        // One chime for the batch, at the most urgent level present.
        const kinds = fresh.map(chimeFor);
        playChime(kinds.includes('urgent') ? 'urgent' : kinds.includes('order') ? 'order' : 'soft');
        setRinging(true);
        window.setTimeout(() => setRinging(false), 2_000);

        fresh.slice(0, 3).forEach((item) => {
          enqueueSnackbar(item.message, { variant: variantFor(item) });
        });
        if (fresh.length > 3) {
          enqueueSnackbar(`${fresh.length - 3} more notifications`, { variant: 'info' });
        }
      } catch {
        // A failed poll is retried on the next tick; the bell keeps what it has.
      } finally {
        inFlight.current = false;
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);

    // The socket broadcasts hotel-wide with targetUserIds; refetch only when
    // this user is a target (or the event names no targets).
    const unsubscribers = INBOX_EVENTS.map((event) =>
      on<{ targetUserIds?: string[] }>(event, (payload) => {
        const targets = payload?.targetUserIds;
        if (!targets || targets.includes(userId)) {
          void load();
        }
      })
    );

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [userId, refresh, reset, on, enqueueSnackbar]);

  const open = (item: InboxItem) => {
    void markRead(item.id);
    setAnchor(null);
    if (item.link) navigate(item.link);
  };

  return (
    <>
      <Tooltip title={unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'Notifications'}>
        <IconButton
          color="inherit"
          sx={{ mr: 1 }}
          onClick={(event) => setAnchor(event.currentTarget)}
          aria-label="Notifications"
        >
          <Badge badgeContent={unreadCount || null} color="error" max={99}>
            {ringing ? (
              <NotificationsActiveRounded
                sx={{
                  animation: 'hotelopx-ring 0.6s ease-in-out 3',
                  '@keyframes hotelopx-ring': {
                    '0%, 100%': { transform: 'rotate(0deg)' },
                    '25%': { transform: 'rotate(15deg)' },
                    '75%': { transform: 'rotate(-15deg)' }
                  }
                }}
              />
            ) : (
              <NotificationsRounded />
            )}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, maxWidth: 'calc(100vw - 32px)', maxHeight: 460 } }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Typography variant="subtitle2" fontWeight={700}>
            Notifications
          </Typography>
          <Button size="small" disabled={unreadCount === 0} onClick={() => void markAllRead()}>
            Mark all read
          </Button>
        </Stack>

        {items.length === 0 ? (
          <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No notifications yet
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {items.map((item) => (
              <ListItemButton
                key={item.id}
                onClick={() => open(item)}
                sx={{
                  alignItems: 'flex-start',
                  py: 1.25,
                  gap: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: (theme) => (item.isRead ? 'transparent' : alpha(theme.palette.primary.main, 0.06))
                }}
              >
                <Box
                  sx={{
                    mt: 0.75,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    flexShrink: 0,
                    bgcolor: item.isRead ? 'transparent' : 'primary.main'
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {item.title && (
                    <Typography variant="body2" fontWeight={700}>
                      {item.title}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                    {item.message}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <Chip
                      size="small"
                      label={CATEGORY_LABEL[item.category] ?? item.category}
                      color={variantFor(item)}
                      variant="outlined"
                      sx={{ height: 20, fontSize: 11 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {timeAgo(item.createdAt)}
                    </Typography>
                  </Stack>
                </Box>
              </ListItemButton>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}
