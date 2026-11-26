import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, Chip, CircularProgress, Container, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import Layout from '../components/Layout';
import { useInboxStore } from '../store/inboxStore';

/**
 * Staff Hub → Notifications: the same inbox as the header bell, on a full
 * page, so nothing is missed on a phone where the bell's menu is small.
 */
const NotificationsPage = () => {
  const navigate = useNavigate();
  const { items, unreadCount, loaded, refresh, markRead, markAllRead } = useInboxStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh().catch(() => setError('Could not load your notifications.'));
  }, [refresh]);

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Notifications</Typography>
            <Typography variant="body2" color="text.secondary">
              {unreadCount ? `${unreadCount} unread` : 'All caught up'}
            </Typography>
          </Box>
          <Button variant="outlined" disabled={!unreadCount} onClick={() => markAllRead()}>
            Mark all read
          </Button>
        </Stack>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!loaded ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : items.length === 0 ? (
          <Card variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">You have no notifications.</Typography>
          </Card>
        ) : (
          <Card variant="outlined">
            <List disablePadding>
              {items.map((item) => (
                <ListItemButton
                  key={item.id}
                  divider
                  onClick={() => {
                    markRead(item.id);
                    if (item.link) navigate(item.link);
                  }}
                  sx={{ alignItems: 'flex-start', bgcolor: item.isRead ? 'transparent' : 'action.hover' }}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography fontWeight={item.isRead ? 500 : 700}>{item.title ?? item.type.replace(/_/g, ' ').toLowerCase()}</Typography>
                        <Chip size="small" label={item.category} variant="outlined" />
                      </Stack>
                    }
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.primary" sx={{ display: 'block' }}>{item.message}</Typography>
                        <Typography component="span" variant="caption" color="text.secondary">{new Date(item.createdAt).toLocaleString('en-GB')}</Typography>
                      </>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          </Card>
        )}
      </Container>
    </Layout>
  );
};

export default NotificationsPage;
