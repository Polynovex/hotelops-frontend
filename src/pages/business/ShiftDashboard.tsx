import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  AssessmentRounded,
  AttachMoneyRounded,
  AutorenewRounded,
  HistoryRounded,
  LocalOfferRounded,
  PauseCircleOutlineRounded,
  PlayArrowRounded,
  RefreshRounded,
  StopCircleOutlined,
  TimerRounded,
  TrendingUpRounded
} from '@mui/icons-material';
import { Shift, shiftService, ShiftStatus } from '../../services/shift.service';
import { useAuthStore } from '../../store/authStore';
import Layout from '../../components/Layout';
import LogoLoader from '../../components/LogoLoader';
import { maskUserCode } from '../../utils/userCode';

const formatNGN = (v?: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(v || 0);

const formatDuration = (from?: string | Date | null, to?: string | Date | null) => {
  if (!from) return '—';
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  const minutes = Math.max(0, Math.floor((end - start) / 60000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const statusMeta = (status?: ShiftStatus) => {
  if (status === 'OPEN') return { label: 'On shift', color: 'success' as const };
  if (status === 'ON_BREAK') return { label: 'On break', color: 'warning' as const };
  if (status === 'CLOSED') return { label: 'Closed', color: 'default' as const };
  return { label: '—', color: 'default' as const };
};

interface ListedShift extends Shift {
  user?: { firstName?: string; lastName?: string; userCode?: string };
  _count?: { events: number };
}

const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  tone?: 'default' | 'primary' | 'success';
}> = ({ label, value, hint, icon, tone = 'default' }) => {
  const theme = useTheme();
  const bg =
    tone === 'primary'
      ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`
      : tone === 'success'
        ? `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.light} 100%)`
        : undefined;
  const textColor = tone === 'default' ? theme.palette.text.primary : '#fff';
  const labelColor = tone === 'default' ? theme.palette.text.secondary : alpha('#fff', 0.78);
  const hintColor = tone === 'default' ? theme.palette.text.secondary : alpha('#fff', 0.66);

  return (
    <Card
      sx={{
        position: 'relative',
        overflow: 'hidden',
        backgroundImage: bg,
        color: textColor,
        border: tone === 'default' ? undefined : 'none',
        boxShadow: tone === 'default' ? undefined : '0 20px 44px rgba(15, 42, 68, 0.22)'
      }}
    >
      <CardContent sx={{ pb: '16px !important' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.2}>
          <Typography
            variant="caption"
            sx={{ color: labelColor, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            {label}
          </Typography>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '10px',
              display: 'grid',
              placeItems: 'center',
              background:
                tone === 'default'
                  ? alpha(theme.palette.secondary.main, 0.16)
                  : alpha('#FFFFFF', 0.18),
              color: tone === 'default' ? theme.palette.secondary.dark : '#fff'
            }}
          >
            {icon}
          </Box>
        </Stack>
        <Typography
          variant="h3"
          sx={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 700, lineHeight: 1, color: textColor }}
        >
          {value}
        </Typography>
        {hint ? (
          <Typography variant="body2" sx={{ color: hintColor, mt: 0.5 }}>
            {hint}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
};

const resolvePostShiftPath = (role?: string): string => {
  const r = role?.toUpperCase();
  if (r === 'BUSINESS_ADMIN') return '/business/dashboard';
  if (r === 'MANAGER') return '/business/reservations';
  if (r === 'ACCOUNTANT') return '/business/accounting/night-audit/status';
  if (r === 'RECEPTIONIST') return '/business/reservations/arrivals';
  if (r === 'HOUSEKEEPING') return '/business/rooms/status-board';
  return '/business/pos/orders';
};

const PersonalShift: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useTheme();

  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0); // re-render duration

  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState('0');
  const [closingCash, setClosingCash] = useState('0');
  const [notes, setNotes] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await shiftService.getMine();
      setShift(r.shift);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load shift');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!shift) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, [shift]);

  const handleOpen = async () => {
    setBusy(true);
    try {
      const s = await shiftService.open({ openingCash: Number(openingCash) || 0, notes });
      setShift(s);
      setOpenDialog(false);
      setOpeningCash('0');
      setNotes('');
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from || resolvePostShiftPath(user?.role), { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to open shift');
    } finally {
      setBusy(false);
    }
  };

  const handleStartBreak = async () => {
    setBusy(true);
    try {
      await shiftService.startBreak('User went on break');
      logout();
      navigate('/login', { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to take break');
      setBusy(false);
    }
  };

  const handleEndBreak = async () => {
    setBusy(true);
    try {
      const r = await shiftService.endBreak();
      setShift(r.shift);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to resume shift');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    setBusy(true);
    try {
      const r = await shiftService.close({ closingCash: Number(closingCash) || 0, notes });
      setCloseDialog(false);
      setClosingCash('0');
      setNotes('');
      setShift(null);
      window.alert(
        `Shift closed.\nExpected: ${formatNGN(r.summary.expectedCash)}\nVariance: ${formatNGN(
          r.summary.cashVariance
        )}`
      );
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to close shift');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={160} />
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={80} />
      </Stack>
    );
  }

  if (!shift) {
    return (
      <Card>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <Avatar
            sx={{
              width: 64,
              height: 64,
              mx: 'auto',
              mb: 2,
              background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.light})`,
              color: theme.palette.primary.main
            }}
          >
            <PlayArrowRounded fontSize="large" />
          </Avatar>
          <Typography variant="h4" sx={{ mb: 1 }}>
            Start your shift
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', mb: 3 }}>
            Open a shift to begin recording sales, payments, and discounts on the POS or front desk. Cash variance is
            tracked automatically.
          </Typography>
          <Button
            size="large"
            variant="contained"
            startIcon={<PlayArrowRounded />}
            onClick={() => setOpenDialog(true)}
          >
            Open shift
          </Button>
        </CardContent>

        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="xs">
          <DialogTitle>Open new shift</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <TextField
                fullWidth
                autoFocus
                label="Opening cash"
                type="number"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">₦</InputAdornment> }}
              />
              <TextField
                fullWidth
                label="Notes (optional)"
                multiline
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleOpen} disabled={busy}>
              Open
            </Button>
          </DialogActions>
        </Dialog>
      </Card>
    );
  }

  const meta = statusMeta(shift.status);
  const duration = formatDuration(shift.openedAt);

  return (
    <Stack spacing={3}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Hero card */}
      <Card
        sx={{
          position: 'relative',
          overflow: 'hidden',
          color: '#fff',
          border: 'none',
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.light} 100%)`
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(theme.palette.secondary.main, 0.42)} 0%, transparent 70%)`
          }}
        />
        <CardContent sx={{ position: 'relative', p: { xs: 3, md: 4 } }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={3}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <Chip
                  size="small"
                  label={meta.label}
                  sx={{
                    bgcolor:
                      shift.status === 'OPEN'
                        ? alpha(theme.palette.success.light, 0.32)
                        : alpha(theme.palette.warning.light, 0.32),
                    color: '#fff',
                    fontWeight: 700,
                    letterSpacing: '0.06em'
                  }}
                />
                <Typography variant="caption" sx={{ color: alpha('#fff', 0.7) }}>
                  · {duration} elapsed
                </Typography>
              </Stack>
              <Typography
                variant="h2"
                sx={{ fontFamily: '"Cormorant Garamond", serif', color: '#fff', fontWeight: 600 }}
              >
                Welcome back, {user?.firstName || user?.name || 'team'}
              </Typography>
              <Typography variant="body2" sx={{ color: alpha('#fff', 0.78), mt: 0.5 }}>
                {user?.role} · Opened {new Date(shift.openedAt).toLocaleString()}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.2}>
              {shift.status === 'OPEN' && (
                <>
                  <Tooltip title="You'll be logged out, but the shift stays open">
                    <Button
                      variant="outlined"
                      startIcon={<PauseCircleOutlineRounded />}
                      onClick={handleStartBreak}
                      disabled={busy}
                      sx={{
                        color: '#fff',
                        borderColor: alpha('#fff', 0.32),
                        bgcolor: alpha('#fff', 0.06),
                        '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.12) }
                      }}
                    >
                      Take break
                    </Button>
                  </Tooltip>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<StopCircleOutlined />}
                    onClick={() => setCloseDialog(true)}
                    disabled={busy}
                  >
                    Close shift
                  </Button>
                </>
              )}
              {shift.status === 'ON_BREAK' && (
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<PlayArrowRounded />}
                  onClick={handleEndBreak}
                  disabled={busy}
                >
                  Resume shift
                </Button>
              )}
            </Stack>
          </Stack>
          {busy && <LinearProgress sx={{ mt: 2, borderRadius: 2 }} />}
        </CardContent>
      </Card>

      {/* Stat grid */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }
        }}
      >
        <StatTile
          label="Sales"
          value={formatNGN(shift.totalSales)}
          hint="Completed POS orders"
          icon={<TrendingUpRounded fontSize="small" />}
          tone="success"
        />
        <StatTile
          label="Opening cash"
          value={formatNGN(shift.openingCash)}
          hint={`At ${new Date(shift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          icon={<AttachMoneyRounded fontSize="small" />}
        />
        <StatTile
          label="Discounts"
          value={formatNGN(shift.totalDiscounts)}
          hint="Applied this shift"
          icon={<LocalOfferRounded fontSize="small" />}
        />
        <StatTile
          label="Refunds"
          value={formatNGN(shift.totalRefunds)}
          hint="Reversed"
          icon={<AssessmentRounded fontSize="small" />}
        />
      </Box>

      {/* Quick actions */}
      <Card>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Quick actions
          </Typography>
          <Stack direction="row" spacing={1.2} flexWrap="wrap" useFlexGap>
            <Button variant="contained" onClick={() => navigate('/business/pos/orders')}>
              Go to POS
            </Button>
            <Button variant="outlined" onClick={() => navigate('/business/reservations/arrivals')}>
              Reception
            </Button>
            <Button variant="text" startIcon={<RefreshRounded />} onClick={refresh}>
              Refresh
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={closeDialog} onClose={() => setCloseDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle>Close shift</DialogTitle>
        <DialogContent>
          <Stack spacing={2} pt={1}>
            <Alert severity="info" variant="outlined">
              Cash variance = closing cash − (opening cash + sales). Discrepancies are recorded for review.
            </Alert>
            <TextField
              fullWidth
              autoFocus
              label="Closing cash"
              type="number"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">₦</InputAdornment> }}
            />
            <TextField
              fullWidth
              label="Notes (optional)"
              multiline
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleClose} disabled={busy}>
            Confirm close
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

const ShiftsAdmin: React.FC = () => {
  const [items, setItems] = useState<ListedShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | ShiftStatus>('ALL');
  const theme = useTheme();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await shiftService.list({
        ...(filter !== 'ALL' && { status: filter }),
        pageSize: 50
      });
      setItems(r.items as ListedShift[]);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filter]);

  const summary = useMemo(() => {
    const open = items.filter((s) => s.status === 'OPEN').length;
    const onBreak = items.filter((s) => s.status === 'ON_BREAK').length;
    const sales = items.reduce((acc, s) => acc + (s.totalSales || 0), 0);
    return { open, onBreak, sales };
  }, [items]);

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }
        }}
      >
        <StatTile label="Open shifts" value={summary.open} icon={<TimerRounded fontSize="small" />} tone="success" />
        <StatTile label="On break" value={summary.onBreak} icon={<PauseCircleOutlineRounded fontSize="small" />} />
        <StatTile
          label="Sales (loaded set)"
          value={formatNGN(summary.sales)}
          icon={<TrendingUpRounded fontSize="small" />}
          tone="primary"
        />
      </Box>

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5">Recent shifts</Typography>
            <Stack direction="row" spacing={1}>
              <Tabs
                value={filter}
                onChange={(_, v) => setFilter(v)}
                sx={{
                  minHeight: 36,
                  '& .MuiTab-root': { minHeight: 36, py: 0.5 }
                }}
              >
                <Tab label="All" value="ALL" />
                <Tab label="Open" value="OPEN" />
                <Tab label="Break" value="ON_BREAK" />
                <Tab label="Closed" value="CLOSED" />
              </Tabs>
              <IconButton size="small" onClick={load}>
                <AutorenewRounded fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {loading ? (
            <LogoLoader inline minHeight={220} label="Loading shifts" />
          ) : items.length === 0 ? (
            <Box
              sx={{
                py: 6,
                textAlign: 'center',
                color: theme.palette.text.secondary,
                border: `1px dashed ${theme.palette.divider}`,
                borderRadius: 2
              }}
            >
              <HistoryRounded fontSize="large" />
              <Typography sx={{ mt: 1 }}>No shifts found for this filter.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Staff</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Opened</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell align="right">Opening</TableCell>
                    <TableCell align="right">Sales</TableCell>
                    <TableCell align="right">Variance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((s) => {
                    const meta = statusMeta(s.status);
                    return (
                      <TableRow key={s.id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1.2} alignItems="center">
                            <Avatar sx={{ width: 32, height: 32, bgcolor: alpha(theme.palette.secondary.main, 0.2), color: theme.palette.secondary.dark, fontSize: 13 }}>
                              {(s.user?.firstName?.[0] || '?').toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>
                                {s.user?.firstName} {s.user?.lastName}
                              </Typography>
                              <Typography variant="caption" className="mono" color="text.secondary">
                                {maskUserCode(s.user?.userCode)}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={meta.label} color={meta.color} variant="filled" />
                        </TableCell>
                        <TableCell>{new Date(s.openedAt).toLocaleString()}</TableCell>
                        <TableCell>{formatDuration(s.openedAt, s.closedAt)}</TableCell>
                        <TableCell align="right" className="mono">
                          {formatNGN(s.openingCash)}
                        </TableCell>
                        <TableCell align="right" className="mono">
                          {formatNGN(s.totalSales)}
                        </TableCell>
                        <TableCell
                          align="right"
                          className="mono"
                          sx={{
                            color:
                              (s.cashVariance ?? 0) < 0
                                ? theme.palette.error.main
                                : (s.cashVariance ?? 0) > 0
                                  ? theme.palette.success.main
                                  : 'text.secondary',
                            fontWeight: 600
                          }}
                        >
                          {s.cashVariance !== null && s.cashVariance !== undefined
                            ? formatNGN(s.cashVariance)
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
};

const ShiftDashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const isAdmin =
    user?.role === 'BUSINESS_ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';
  
  // Only POS_STAFF, RECEPTIONIST, and ACCOUNTANT can open shifts
  const canOpenShift = 
    user?.role === 'POS_STAFF' || user?.role === 'RECEPTIONIST' || user?.role === 'ACCOUNTANT';
  
  const [tab, setTab] = useState<'mine' | 'admin'>('mine');

  // If user cannot open shifts, default to admin view
  React.useEffect(() => {
    if (!canOpenShift && isAdmin) {
      setTab('admin');
    }
  }, [canOpenShift, isAdmin]);

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
          <Box>
            <Typography variant="caption">Shift center</Typography>
            <Typography variant="h2" sx={{ fontFamily: '"Cormorant Garamond", serif' }}>
              {tab === 'mine' ? 'Your shift' : 'All shifts'}
            </Typography>
          </Box>
          {isAdmin && (
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              {canOpenShift && (
                <Tab value="mine" label="My shift" icon={<TimerRounded />} iconPosition="start" />
              )}
              <Tab value="admin" label="All shifts" icon={<HistoryRounded />} iconPosition="start" />
            </Tabs>
          )}
        </Stack>

        {tab === 'mine' && canOpenShift ? <PersonalShift /> : <ShiftsAdmin />}
      </Container>
    </Layout>
  );
};

export default ShiftDashboard;
