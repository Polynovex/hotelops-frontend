import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  InputAdornment,
  MenuItem,
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
  TextField,
  Typography
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import VerifiedIcon from '@mui/icons-material/Verified';
import Layout from '../../../components/Layout';
import RowActionsMenu from '../../../components/common/RowActionsMenu';
import guestService, { guestFullName, type Guest, type GuestType } from '../../../services/guest.service';

const SOURCE_LABEL: Record<string, string> = {
  STAFF: 'Front desk',
  SELF_REGISTRATION: 'Self-registered',
  BOOKING_ENGINE: 'Booking engine',
  IMPORT: 'Imported'
};

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string; message?: string } } }).response?.data?.message
  ?? (err as { response?: { data?: { error?: string } } }).response?.data?.error
  ?? fallback;

/**
 * The guest book: one place where every guest record lives, whichever door they
 * came through — front desk, admin, or self-registration.
 */
const GuestBookPage = () => {
  const [rows, setRows] = useState<Guest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<GuestType | ''>('');
  const [blacklistFilter, setBlacklistFilter] = useState<'true' | 'false' | ''>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [pendingBlacklist, setPendingBlacklist] = useState<Guest | null>(null);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Debounce so typing a name is one request, not one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await guestService.list({
        q: debouncedSearch || undefined,
        guestType: typeFilter,
        blacklisted: blacklistFilter,
        limit: rowsPerPage,
        offset: page * rowsPerPage
      });
      setRows(result.data);
      setTotal(result.total);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load the guest book'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, typeFilter, blacklistFilter, page, rowsPerPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeType = async (guest: Guest, guestType: GuestType) => {
    try {
      await guestService.setGuestType(guest.id, guestType);
      setToast(
        guestType === 'REGULAR'
          ? `${guestFullName(guest)} marked as a regular guest`
          : `${guestFullName(guest)} marked as one-time`
      );
      await load();
    } catch (err) {
      // The server refuses to demote a guest who holds a loyalty account.
      setError(errorMessage(err, 'Could not change the guest type'));
    }
  };

  const verify = async (guest: Guest) => {
    try {
      await guestService.verify(guest.id);
      setToast(`${guestFullName(guest)} verified`);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not verify the guest'));
    }
  };

  const openBlacklist = (guest: Guest) => {
    setBlacklistReason('');
    setPendingBlacklist(guest);
  };

  const confirmBlacklist = async () => {
    if (!pendingBlacklist || !blacklistReason.trim()) {
      return;
    }

    setSaving(true);
    try {
      await guestService.setBlacklist(pendingBlacklist.id, true, blacklistReason.trim());
      setToast(`${guestFullName(pendingBlacklist)} blacklisted`);
      setPendingBlacklist(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not blacklist the guest'));
    } finally {
      setSaving(false);
    }
  };

  const removeBlacklist = async (guest: Guest) => {
    try {
      await guestService.setBlacklist(guest.id, false);
      setToast(`${guestFullName(guest)} removed from the blacklist`);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not update the guest'));
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>Guest Book</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Every guest on record — added at the front desk, created here, or registered by
          the guest themselves. Regular guests are the ones eligible for loyalty.
        </Typography>

        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              placeholder="Search by name, phone, or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              fullWidth
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                )
              }}
            />
            <TextField
              select
              label="Guest type"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as GuestType | ''); setPage(0); }}
              size="small"
              sx={{ minWidth: { md: 180 } }}
            >
              <MenuItem value="">All guests</MenuItem>
              <MenuItem value="REGULAR">Regular</MenuItem>
              <MenuItem value="ONE_TIME">One-time</MenuItem>
            </TextField>
            <TextField
              select
              label="Standing"
              value={blacklistFilter}
              onChange={(e) => { setBlacklistFilter(e.target.value as 'true' | 'false' | ''); setPage(0); }}
              size="small"
              sx={{ minWidth: { md: 180 } }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="false">In good standing</MenuItem>
              <MenuItem value="true">Blacklisted</MenuItem>
            </TextField>
          </Stack>
        </Paper>

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Guest</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Stays</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Standing</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              )}

              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No guests match these filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {!loading && rows.map((guest) => (
                <TableRow key={guest.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={600}>
                        {guestFullName(guest)}
                      </Typography>
                      {guest.verifiedAt && (
                        <VerifiedIcon color="primary" sx={{ fontSize: 16 }} titleAccess="Verified by staff" />
                      )}
                    </Stack>
                    {guest.loyaltyAccount && (
                      <Typography variant="caption" color="text.secondary">
                        Loyalty · {guest.loyaltyAccount.tier} · {guest.loyaltyAccount.pointsBalance} pts
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{guest.phone}</Typography>
                    {guest.email && (
                      <Typography variant="caption" color="text.secondary">{guest.email}</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={guest.guestType === 'REGULAR' ? 'Regular' : 'One-time'}
                      color={guest.guestType === 'REGULAR' ? 'success' : 'default'}
                      variant={guest.guestType === 'REGULAR' ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">{guest.stayCount}</TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {SOURCE_LABEL[guest.source] ?? guest.source}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {guest.isBlacklisted ? (
                      <Chip size="small" color="error" label="Blacklisted" />
                    ) : (
                      <Chip size="small" color="success" variant="outlined" label="Good standing" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <RowActionsMenu
                      subject={guestFullName(guest)}
                      actions={[
                        {
                          key: 'promote',
                          label: 'Mark as regular guest',
                          icon: <StarIcon fontSize="small" />,
                          hidden: guest.guestType === 'REGULAR',
                          onClick: () => void changeType(guest, 'REGULAR')
                        },
                        {
                          key: 'demote',
                          label: 'Mark as one-time',
                          icon: <StarBorderIcon fontSize="small" />,
                          hidden: guest.guestType === 'ONE_TIME',
                          disabled: Boolean(guest.loyaltyAccount),
                          disabledReason: 'Close their loyalty account first',
                          onClick: () => void changeType(guest, 'ONE_TIME')
                        },
                        {
                          key: 'verify',
                          label: 'Mark as verified',
                          icon: <CheckCircleIcon fontSize="small" />,
                          hidden: Boolean(guest.verifiedAt),
                          onClick: () => void verify(guest)
                        },
                        {
                          key: 'unblacklist',
                          label: 'Remove from blacklist',
                          icon: <CheckCircleIcon fontSize="small" />,
                          hidden: !guest.isBlacklisted,
                          onClick: () => void removeBlacklist(guest)
                        },
                        {
                          key: 'blacklist',
                          label: 'Blacklist guest',
                          icon: <BlockIcon fontSize="small" />,
                          hidden: guest.isBlacklisted,
                          destructive: true,
                          onClick: () => openBlacklist(guest)
                        }
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_e, next) => setPage(next)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[25, 50, 100]}
          />
        </TableContainer>

        <Dialog
          open={Boolean(pendingBlacklist)}
          onClose={() => setPendingBlacklist(null)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Blacklist {pendingBlacklist && guestFullName(pendingBlacklist)}?</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2">
                Staff will be warned before taking any booking for this guest, and they
                cannot be enrolled in the loyalty programme.
              </Typography>
              <TextField
                label="Reason"
                value={blacklistReason}
                onChange={(e) => setBlacklistReason(e.target.value)}
                fullWidth
                required
                multiline
                rows={3}
                helperText="Recorded against your name in the audit log."
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPendingBlacklist(null)}>Cancel</Button>
            <Button
              color="error"
              variant="contained"
              disabled={saving || !blacklistReason.trim()}
              onClick={() => void confirmBlacklist()}
            >
              {saving ? 'Saving…' : 'Blacklist guest'}
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
    </Layout>
  );
};

export default GuestBookPage;
