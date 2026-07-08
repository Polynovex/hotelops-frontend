import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  AutoAwesomeRounded,
  CheckRounded,
  CloseRounded,
  HelpOutlineRounded,
  LocalOfferRounded,
  LockClockRounded,
  PaidRounded,
  PlayArrowRounded,
  ReportProblemRounded,
  SecurityRounded,
  ShieldRounded,
  TimerOutlined,
  WarningAmberRounded
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import Layout from '../../components/Layout';
import LogoLoader from '../../components/LogoLoader';
import {
  AnomalyFlag,
  AnomalySeverity,
  AnomalyStatus,
  AnomalyType,
  anomalyService
} from '../../services/anomaly.service';

const fmtNGN = (v: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(v || 0);

const SEVERITY_COLOR: Record<AnomalySeverity, 'error' | 'warning' | 'info' | 'default'> = {
  CRITICAL: 'error',
  HIGH: 'error',
  MEDIUM: 'warning',
  LOW: 'info'
};

const STATUS_COLOR: Record<AnomalyStatus, 'warning' | 'info' | 'success' | 'default'> = {
  OPEN: 'warning',
  ACKNOWLEDGED: 'info',
  RESOLVED: 'success',
  DISMISSED: 'default'
};

const TYPE_LABEL: Record<AnomalyType, string> = {
  CASH_VARIANCE_HIGH: 'Cash variance',
  DISCOUNT_RATE_OUTLIER: 'Discount outlier',
  VOID_RATE_HIGH: 'High void rate',
  LOGIN_FROM_NEW_IP: 'New IP login',
  FORCED_SHIFT_CLOSE: 'Forced close',
  SHIFT_TOO_LONG: 'Shift too long'
};

const TYPE_ICON: Record<AnomalyType, React.ReactElement> = {
  CASH_VARIANCE_HIGH: <PaidRounded />,
  DISCOUNT_RATE_OUTLIER: <LocalOfferRounded />,
  VOID_RATE_HIGH: <ReportProblemRounded />,
  LOGIN_FROM_NEW_IP: <SecurityRounded />,
  FORCED_SHIFT_CLOSE: <LockClockRounded />,
  SHIFT_TOO_LONG: <TimerOutlined />
};

const formatEvidence = (flag: AnomalyFlag): React.ReactNode => {
  const ev = flag.evidence as Record<string, unknown>;
  switch (flag.type) {
    case 'CASH_VARIANCE_HIGH':
      return (
        <Stack spacing={0.5}>
          <Typography variant="body2">Opening: <b className="mono">{fmtNGN(Number(ev.openingCash) || 0)}</b></Typography>
          <Typography variant="body2">Sales: <b className="mono">{fmtNGN(Number(ev.totalSales) || 0)}</b></Typography>
          <Typography variant="body2">Expected: <b className="mono">{fmtNGN(Number(ev.expectedCash) || 0)}</b></Typography>
          <Typography variant="body2">Counted: <b className="mono">{fmtNGN(Number(ev.closingCash) || 0)}</b></Typography>
          <Typography variant="body2" color="error">Variance: <b className="mono">{fmtNGN(Number(ev.variance) || 0)}</b></Typography>
        </Stack>
      );
    case 'DISCOUNT_RATE_OUTLIER':
      return (
        <Stack spacing={0.5}>
          <Typography variant="body2">Total discount applied: <b className="mono">{fmtNGN(Number(ev.totalSaved) || 0)}</b></Typography>
          <Typography variant="body2">Peer median: <b className="mono">{fmtNGN(Number(ev.peerMedian) || 0)}</b></Typography>
          <Typography variant="body2">Multiplier: <b className="mono">{Number(ev.multiplier).toFixed(1)}×</b></Typography>
        </Stack>
      );
    case 'VOID_RATE_HIGH':
      return (
        <Stack spacing={0.5}>
          <Typography variant="body2">Total orders: <b>{String(ev.totalOrders)}</b></Typography>
          <Typography variant="body2">Voided: <b>{String(ev.voided)}</b></Typography>
          <Typography variant="body2" color="warning.dark">Void rate: <b>{(Number(ev.ratio) * 100).toFixed(0)}%</b></Typography>
        </Stack>
      );
    default:
      return (
        <Stack spacing={0.5}>
          {Object.entries(ev).map(([k, v]) => (
            <Typography variant="body2" key={k}>
              {k}: <b className="mono">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</b>
            </Typography>
          ))}
        </Stack>
      );
  }
};

const SeverityKpi = ({
  label,
  icon,
  count,
  tone
}: {
  label: string;
  icon: React.ReactElement;
  count: number;
  tone: 'error' | 'warning' | 'info' | 'success';
}) => {
  const theme = useTheme();
  const color = theme.palette[tone].main;
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {label}
          </Typography>
          <Box sx={{ width: 32, height: 32, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: alpha(color, 0.14), color }}>
            {icon}
          </Box>
        </Stack>
        <Typography variant="h4" fontWeight={700} sx={{ fontFamily: '"Cormorant Garamond", serif' }}>
          {count}
        </Typography>
      </CardContent>
    </Card>
  );
};

const AnomaliesPage = () => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [items, setItems] = useState<AnomalyFlag[]>([]);
  const [counts, setCounts] = useState<Record<AnomalyStatus, number>>({
    OPEN: 0,
    ACKNOWLEDGED: 0,
    RESOLVED: 0,
    DISMISSED: 0
  });
  const [filters, setFilters] = useState<{
    status?: AnomalyStatus | '';
    severity?: AnomalySeverity | '';
    type?: AnomalyType | '';
  }>({ status: 'OPEN', severity: '', type: '' });

  const [resolveDialog, setResolveDialog] = useState<{
    flag: AnomalyFlag;
    resolution: 'RESOLVED' | 'DISMISSED';
  } | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await anomalyService.list({
        ...(filters.status && { status: filters.status as AnomalyStatus }),
        ...(filters.severity && { severity: filters.severity as AnomalySeverity }),
        ...(filters.type && { type: filters.type as AnomalyType })
      });
      setItems(data.items);
      setCounts(data.counts);
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.error || 'Failed to load anomalies', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.severity, filters.type]);

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const result = await anomalyService.runNow(24);
      enqueueSnackbar(
        result.created
          ? `${result.created} new flag${result.created === 1 ? '' : 's'} created`
          : 'No new anomalies detected',
        { variant: 'success' }
      );
      await load();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.error || 'Detection failed', { variant: 'error' });
    } finally {
      setRunning(false);
    }
  };

  const handleAcknowledge = async (flag: AnomalyFlag) => {
    try {
      await anomalyService.acknowledge(flag.id);
      enqueueSnackbar('Flag acknowledged', { variant: 'success' });
      await load();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.error || 'Acknowledge failed', { variant: 'error' });
    }
  };

  const handleResolveSubmit = async () => {
    if (!resolveDialog) return;
    try {
      await anomalyService.resolve(resolveDialog.flag.id, resolveDialog.resolution, resolveNote);
      enqueueSnackbar(
        resolveDialog.resolution === 'RESOLVED' ? 'Flag marked resolved' : 'Flag dismissed',
        { variant: 'success' }
      );
      setResolveDialog(null);
      setResolveNote('');
      await load();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.error || 'Action failed', { variant: 'error' });
    }
  };

  const grouped = useMemo(() => {
    const groups: Record<AnomalySeverity, AnomalyFlag[]> = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
    for (const item of items) groups[item.severity].push(item);
    return groups;
  }, [items]);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} mb={3}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '10px',
                display: 'grid',
                placeItems: 'center',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
                color: theme.palette.secondary.light
              }}
            >
              <AutoAwesomeRounded />
            </Box>
            <Box>
              <Typography variant="overline" color="text.secondary">
                AI · Loss prevention
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                Shift Anomalies
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Automatically detected discrepancies in cash, discounts, voids, logins and shift duration.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Run detection across the last 24 hours now">
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PlayArrowRounded />}
                  onClick={handleRunNow}
                  disabled={running}
                >
                  {running ? 'Running…' : 'Run detection'}
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <SeverityKpi label="Open" icon={<WarningAmberRounded fontSize="small" />} count={counts.OPEN} tone="warning" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <SeverityKpi label="Acknowledged" icon={<HelpOutlineRounded fontSize="small" />} count={counts.ACKNOWLEDGED} tone="info" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <SeverityKpi label="Resolved" icon={<ShieldRounded fontSize="small" />} count={counts.RESOLVED} tone="success" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <SeverityKpi label="Dismissed" icon={<CloseRounded fontSize="small" />} count={counts.DISMISSED} tone="info" />
          </Grid>
        </Grid>

        <Card sx={{ p: 2, mb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
            <TextField
              select
              size="small"
              label="Status"
              value={filters.status ?? ''}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value as any }))}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">All statuses</MenuItem>
              <MenuItem value="OPEN">Open</MenuItem>
              <MenuItem value="ACKNOWLEDGED">Acknowledged</MenuItem>
              <MenuItem value="RESOLVED">Resolved</MenuItem>
              <MenuItem value="DISMISSED">Dismissed</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="Severity"
              value={filters.severity ?? ''}
              onChange={(e) => setFilters((p) => ({ ...p, severity: e.target.value as any }))}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">All severities</MenuItem>
              <MenuItem value="CRITICAL">Critical</MenuItem>
              <MenuItem value="HIGH">High</MenuItem>
              <MenuItem value="MEDIUM">Medium</MenuItem>
              <MenuItem value="LOW">Low</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="Type"
              value={filters.type ?? ''}
              onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value as any }))}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">All types</MenuItem>
              {(Object.keys(TYPE_LABEL) as AnomalyType[]).map((t) => (
                <MenuItem key={t} value={t}>{TYPE_LABEL[t]}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </Card>

        {loading ? (
          <Card>
            <LogoLoader inline minHeight={260} label="Scanning for anomalies" />
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <ShieldRounded sx={{ fontSize: 48, color: theme.palette.success.main, mb: 1 }} />
              <Typography variant="h5" sx={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 700 }}>
                All clear
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No anomalies match the current filters. Run detection or change filters to see more.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={3}>
            {(Object.keys(grouped) as AnomalySeverity[])
              .filter((sev) => grouped[sev].length > 0)
              .map((sev) => (
                <Box key={sev}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1.25}>
                    <Chip
                      size="small"
                      color={SEVERITY_COLOR[sev]}
                      label={sev}
                      sx={{ fontWeight: 700, letterSpacing: '0.06em' }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                      {grouped[sev].length} flag{grouped[sev].length === 1 ? '' : 's'}
                    </Typography>
                  </Stack>
                  <Grid container spacing={2}>
                    {grouped[sev].map((flag) => (
                      <Grid key={flag.id} item xs={12} md={6}>
                        <Card
                          sx={{
                            height: '100%',
                            borderLeft: `4px solid ${theme.palette[SEVERITY_COLOR[sev] === 'default' ? 'info' : SEVERITY_COLOR[sev]].main}`,
                            opacity: flag.status === 'RESOLVED' || flag.status === 'DISMISSED' ? 0.78 : 1
                          }}
                        >
                          <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                              <Stack direction="row" spacing={1.25} alignItems="center">
                                <Box
                                  sx={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '8px',
                                    display: 'grid',
                                    placeItems: 'center',
                                    bgcolor: alpha(theme.palette.secondary.main, 0.12),
                                    color: theme.palette.secondary.dark
                                  }}
                                >
                                  {TYPE_ICON[flag.type]}
                                </Box>
                                <Box>
                                  <Typography variant="overline" color="text.secondary">
                                    {TYPE_LABEL[flag.type]}
                                  </Typography>
                                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                    {flag.title}
                                  </Typography>
                                </Box>
                              </Stack>
                              <Chip size="small" color={STATUS_COLOR[flag.status]} label={flag.status} />
                            </Stack>

                            <Typography variant="body2" color="text.secondary" mb={1.5}>
                              {flag.detail}
                            </Typography>

                            {flag.subjectUser && (
                              <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                  Staff
                                </Typography>
                                <Typography variant="body2">
                                  {flag.subjectUser.firstName} {flag.subjectUser.lastName}
                                </Typography>
                                <Chip size="small" label={flag.subjectUser.role} variant="outlined" />
                                {flag.subjectUser.userCode && (
                                  <Chip size="small" className="mono" label={flag.subjectUser.userCode} variant="outlined" />
                                )}
                              </Stack>
                            )}

                            <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.04), mb: 1.5 }}>
                              {formatEvidence(flag)}
                            </Box>

                            <Typography variant="caption" color="text.secondary">
                              Detected {new Date(flag.detectedAt).toLocaleString()}
                            </Typography>

                            <Stack direction="row" spacing={1} mt={2}>
                              {flag.status === 'OPEN' && (
                                <Button size="small" variant="outlined" startIcon={<HelpOutlineRounded />} onClick={() => handleAcknowledge(flag)}>
                                  Acknowledge
                                </Button>
                              )}
                              {(flag.status === 'OPEN' || flag.status === 'ACKNOWLEDGED') && (
                                <>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    startIcon={<CheckRounded />}
                                    onClick={() => {
                                      setResolveDialog({ flag, resolution: 'RESOLVED' });
                                      setResolveNote('');
                                    }}
                                  >
                                    Resolve
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="text"
                                    color="inherit"
                                    startIcon={<CloseRounded />}
                                    onClick={() => {
                                      setResolveDialog({ flag, resolution: 'DISMISSED' });
                                      setResolveNote('');
                                    }}
                                  >
                                    Dismiss
                                  </Button>
                                </>
                              )}
                            </Stack>

                            {flag.resolutionNote && (
                              <Box sx={{ mt: 1.5, p: 1, borderLeft: `3px solid ${theme.palette.divider}`, fontStyle: 'italic' }}>
                                <Typography variant="caption" color="text.secondary">
                                  Note:
                                </Typography>{' '}
                                <Typography variant="body2" component="span">
                                  {flag.resolutionNote}
                                </Typography>
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ))}
          </Stack>
        )}
      </Container>

      <Dialog open={!!resolveDialog} onClose={() => setResolveDialog(null)} fullWidth maxWidth="xs">
        <DialogTitle>
          {resolveDialog?.resolution === 'RESOLVED' ? 'Resolve flag' : 'Dismiss flag'}
          <IconButton
            aria-label="close"
            onClick={() => setResolveDialog(null)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseRounded />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {resolveDialog && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {resolveDialog.flag.title}
            </Alert>
          )}
          <TextField
            autoFocus
            label="Resolution note (optional)"
            placeholder="What did you find / decide?"
            multiline
            rows={3}
            fullWidth
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialog(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={resolveDialog?.resolution === 'RESOLVED' ? 'success' : 'inherit'}
            onClick={handleResolveSubmit}
          >
            {resolveDialog?.resolution === 'RESOLVED' ? 'Mark resolved' : 'Dismiss'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default AnomaliesPage;
