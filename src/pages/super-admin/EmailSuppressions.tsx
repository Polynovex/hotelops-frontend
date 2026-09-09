import { useCallback, useEffect, useState } from 'react';
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
  DialogContentText,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip
} from '@mui/material';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailReadRounded';
import BlockIcon from '@mui/icons-material/BlockRounded';
import UndoIcon from '@mui/icons-material/UndoRounded';
import Layout from '../../components/Layout';
import { api } from '../../services/api';
import { EmptyState, MetricCard, PageHeader } from '../../components/premium';

type Reason = 'HARD_BOUNCE' | 'COMPLAINT' | 'MANUAL';

interface Suppression {
  id: string;
  address: string;
  reason: Reason;
  detail: string | null;
  messageId: string | null;
  createdAt: string;
}

const REASON_LABEL: Record<Reason, string> = {
  HARD_BOUNCE: 'Address does not exist',
  COMPLAINT: 'Reported as spam',
  MANUAL: 'Blocked by an administrator'
};

const REASON_COLOR: Record<Reason, 'error' | 'warning' | 'default'> = {
  HARD_BOUNCE: 'warning',
  COMPLAINT: 'error',
  MANUAL: 'default'
};

/**
 * Addresses the platform will no longer send email to.
 *
 * Without this screen the effect is invisible and reads as a bug: a hotel says
 * a staff member "never got the invitation", and there is nothing to look at.
 * Here the answer is one row — the address, why it was blocked, the reason the
 * receiving mail server gave, and when.
 *
 * Amazon judges a sender on how much of its mail bounces or is reported as
 * spam, and both come from writing again to an address that has already
 * failed. So the list exists to be honoured, not worked around; releasing an
 * address is deliberate, confirmed and audited.
 */
export default function EmailSuppressions() {
  const [items, setItems] = useState<Suppression[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [releasing, setReleasing] = useState<Suppression | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/email/suppressions', {
        params: { limit: rowsPerPage, offset: page * rowsPerPage }
      });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not load the blocked address list.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const release = async () => {
    if (!releasing) return;
    setBusy(true);
    try {
      await api.delete(`/admin/email/suppressions/${encodeURIComponent(releasing.address)}`);
      setToast(`${releasing.address} can receive email again.`);
      setReleasing(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not unblock that address.');
    } finally {
      setBusy(false);
    }
  };

  const complaints = items.filter((item) => item.reason === 'COMPLAINT').length;

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <PageHeader
          title="Blocked email addresses"
          subtitle="Addresses that rejected our mail or reported it as spam. Nothing further is sent to them."
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <Box sx={{ flex: 1 }}>
            <MetricCard label="Blocked addresses" value={total} icon={<BlockIcon />} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <MetricCard
              label="Spam complaints on this page"
              value={complaints}
              detail="These carry the most weight with Amazon"
              icon={<MarkEmailReadIcon />}
            />
          </Box>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Paper variant="outlined">
          {loading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<MarkEmailReadIcon />}
              title="No blocked addresses"
              description="Every address the platform has written to has accepted the message. This is the state to stay in."
            />
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Address</TableCell>
                      <TableCell>Why</TableCell>
                      <TableCell>What the mail server said</TableCell>
                      <TableCell>Blocked</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{item.address}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={REASON_LABEL[item.reason]}
                            color={REASON_COLOR[item.reason]}
                            variant="outlined"
                          />
                        </TableCell>
                        {/*
                          The diagnostic code verbatim. It is the only thing that
                          distinguishes a genuinely dead mailbox from an address
                          that was simply mistyped on the invitation.
                        */}
                        <TableCell
                          sx={{
                            maxWidth: 280,
                            color: 'text.secondary',
                            fontSize: 13,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Tooltip title={item.detail ?? ''}>
                            <span>{item.detail ?? '—'}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            startIcon={<UndoIcon />}
                            onClick={() => setReleasing(item)}
                          >
                            Unblock
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={total}
                page={page}
                onPageChange={(_event, next) => setPage(next)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setPage(0);
                }}
                rowsPerPageOptions={[25, 50, 100]}
              />
            </>
          )}
        </Paper>
      </Container>

      <Dialog open={Boolean(releasing)} onClose={() => !busy && setReleasing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Send email to {releasing?.address} again?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {releasing?.reason === 'COMPLAINT' ? (
              <>
                This address reported our email as spam. Sending to it again is
                the single fastest way to damage our ability to deliver mail to
                anyone — Amazon can suspend sending across the whole platform
                over a small number of repeat complaints. Only unblock this if
                you know the report was a mistake.
              </>
            ) : (
              <>
                The receiving mail server said this address does not exist:
                <Box component="span" sx={{ display: 'block', mt: 1, fontFamily: 'monospace', fontSize: 13 }}>
                  {releasing?.detail || 'No detail was given.'}
                </Box>
                <Box component="span" sx={{ display: 'block', mt: 1 }}>
                  Unblock it only if the address has genuinely been fixed since —
                  a mailbox that was over its quota, or an invitation sent to a
                  mistyped address that has now been corrected.
                </Box>
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReleasing(null)} disabled={busy}>
            Keep it blocked
          </Button>
          <Button variant="contained" color="warning" onClick={() => void release()} disabled={busy}>
            {busy ? 'Unblocking…' : 'Unblock this address'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={5000}
        onClose={() => setToast('')}
        message={toast}
      />
    </Layout>
  );
}
