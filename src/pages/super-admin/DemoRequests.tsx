import Layout from '../../components/Layout';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
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
import InboxIcon from '@mui/icons-material/Inbox';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { api } from '../../services/api';
import { EmptyState, MetricCard, PageHeader } from '../../components/premium';

type Status = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'CLOSED' | 'SPAM';

interface DemoRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  hotelSize: string | null;
  message: string | null;
  status: Status;
  notes: string | null;
  handledAt: string | null;
  createdAt: string;
}

const STATUSES: Status[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'CLOSED', 'SPAM'];

const STATUS_COLOR: Record<Status, 'info' | 'warning' | 'primary' | 'success' | 'default' | 'error'> = {
  NEW: 'info',
  CONTACTED: 'warning',
  QUALIFIED: 'primary',
  CONVERTED: 'success',
  CLOSED: 'default',
  SPAM: 'error'
};

/**
 * Sales inbox for website enquiries.
 *
 * Deleting is a hard delete rather than a status change, because it doubles as
 * the NDPR right-to-erasure action — a soft delete would not satisfy a request
 * to be removed.
 */
const DemoRequests = () => {
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState<Status | ''>('');

  const [selected, setSelected] = useState<DemoRequest | null>(null);
  const [draftStatus, setDraftStatus] = useState<Status>('NEW');
  const [draftNotes, setDraftNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DemoRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/demo-requests', {
        params: filter ? { status: filter } : undefined
      });
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
      setCounts((data?.counts as Record<string, number>) || {});
      setError('');
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string; message?: string } } }).response;
      setError(response?.data?.message || response?.data?.error || 'Failed to load enquiries');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (request: DemoRequest) => {
    setSelected(request);
    setDraftStatus(request.status);
    setDraftNotes(request.notes ?? '');
  };

  const save = async () => {
    if (!selected) {
      return;
    }

    setSaving(true);
    try {
      await api.put(`/admin/demo-requests/${selected.id}`, {
        status: draftStatus,
        notes: draftNotes.trim() || undefined
      });
      setToast('Enquiry updated');
      setSelected(null);
      await load();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      setError(response?.data?.error || 'Could not update the enquiry');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) {
      return;
    }

    try {
      await api.delete(`/admin/demo-requests/${pendingDelete.id}`);
      setToast('Enquiry permanently deleted');
      await load();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      setError(response?.data?.error || 'Could not delete the enquiry');
    } finally {
      setPendingDelete(null);
    }
  };

  const total = useMemo(() => Object.values(counts).reduce((sum, n) => sum + n, 0), [counts]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader
        title="Demo Requests"
        subtitle="Enquiries submitted through the website contact form."
        actions={<Button onClick={() => void load()} disabled={loading}>Refresh</Button>}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard label="Total enquiries" value={total} icon={<InboxIcon />} variant="navy" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard label="New" value={counts.NEW || 0} detail="Awaiting first contact" variant="tinted" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard label="In progress" value={(counts.CONTACTED || 0) + (counts.QUALIFIED || 0)} detail="Contacted or qualified" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard label="Converted" value={counts.CONVERTED || 0} detail="Became customers" />
        </Grid>
      </Grid>

      <TextField
        select
        size="small"
        label="Status"
        value={filter}
        onChange={(event) => setFilter(event.target.value as Status | '')}
        sx={{ minWidth: 180, mb: 2 }}
      >
        <MenuItem value="">All</MenuItem>
        {STATUSES.map((status) => (
          <MenuItem key={status} value={status}>
            {status} {counts[status] ? `(${counts[status]})` : ''}
          </MenuItem>
        ))}
      </TextField>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Contact</TableCell>
              <TableCell>Business</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Received</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            )}

            {!loading && requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={<InboxIcon />}
                    title="No enquiries"
                    description={
                      filter
                        ? 'Nothing matches this status filter.'
                        : 'Enquiries from the website contact form will appear here.'
                    }
                  />
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              requests.map((request) => (
                <TableRow key={request.id} hover sx={{ cursor: 'pointer' }} onClick={() => open(request)}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {request.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {request.email}
                    </Typography>
                  </TableCell>
                  <TableCell>{request.companyName || '—'}</TableCell>
                  <TableCell>{request.hotelSize || '—'}</TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={request.status} color={STATUS_COLOR[request.status]} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={(e) => { e.stopPropagation(); open(request); }}>
                      Process
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle>{selected?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <EmailIcon fontSize="small" color="action" />
              <Typography variant="body2">
                <a href={`mailto:${selected?.email}`}>{selected?.email}</a>
              </Typography>
            </Stack>
            {selected?.phone && (
              <Stack direction="row" spacing={1} alignItems="center">
                <PhoneIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  <a href={`tel:${selected.phone}`}>{selected.phone}</a>
                </Typography>
              </Stack>
            )}
            {selected?.companyName && (
              <Typography variant="body2" color="text.secondary">
                {selected.companyName}
                {selected.hotelSize ? ` · ${selected.hotelSize} rooms` : ''}
              </Typography>
            )}
          </Stack>

          {selected?.message && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
              <Typography variant="body2">{selected.message}</Typography>
            </Paper>
          )}

          <Divider sx={{ mb: 2 }} />

          <Stack spacing={2.5}>
            <TextField
              select
              label="Status"
              value={draftStatus}
              onChange={(event) => setDraftStatus(event.target.value as Status)}
              fullWidth
            >
              {STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Internal notes"
              value={draftNotes}
              onChange={(event) => setDraftNotes(event.target.value)}
              fullWidth
              multiline
              minRows={3}
              placeholder="Call outcome, next step, who is following up…"
            />
          </Stack>

          <Box sx={{ mt: 3 }}>
            <Button
              size="small"
              color="error"
              startIcon={<DeleteForeverIcon />}
              onClick={() => {
                setPendingDelete(selected);
                setSelected(null);
              }}
            >
              Delete permanently (NDPR erasure)
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSelected(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete this enquiry permanently?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This permanently removes <strong>{pendingDelete?.name}</strong>&rsquo;s personal data.
            It cannot be undone. Use this to satisfy a right-to-erasure request — for ordinary
            housekeeping, set the status to Closed instead.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void remove()}>
            Delete permanently
          </Button>
        </DialogActions>
      </Dialog>

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

const DemoRequestsWithLayout = () => (
  <Layout>
    <DemoRequests />
  </Layout>
);

export default DemoRequestsWithLayout;
