import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Drawer,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import Layout from '../../../components/Layout';
import { useAuthStore } from '../../../store/authStore';
import { usePermissionStore } from '../../../store/permissionStore';
import { getApiErrorMessage } from '../../../utils/apiError';
import {
  promotionsApi,
  type Lookups,
  type PromotionKind,
  type PromotionRecord,
  type PromotionStatus,
  type Transition
} from '../../../services/promotions';
import PromotionEditor, { QuickPromotionDialog } from './PromotionEditor';

/**
 * Promotions: one engine for rooms and food & beverage, in three layers —
 * setup (the templates), rules (eligibility, stacking, approval) and
 * analytics (redemptions, revenue, discount cost, margin).
 */

type TabKey = 'ROOM' | 'FOOD_BEVERAGE' | 'EVENT' | 'approvals' | 'analytics' | 'policy';
const KIND_LABEL: Record<PromotionKind, string> = { ROOM: 'Room', FOOD_BEVERAGE: 'F&B', EVENT: 'Event' };

const STATUS_COLOR: Record<PromotionStatus, 'default' | 'success' | 'warning' | 'info' | 'error' | 'secondary'> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  SCHEDULED: 'info',
  ACTIVE: 'success',
  PAUSED: 'secondary',
  EXPIRED: 'default',
  ARCHIVED: 'default'
};
const statusLabel = (status: PromotionStatus) => status.replace('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const describe = (promo: PromotionRecord, money: (v: number) => string) => {
  switch (promo.mechanism) {
    case 'PERCENTAGE':
      return `${promo.value}% off`;
    case 'FIXED':
      return `${money(promo.value)} off`;
    case 'SPECIAL_PRICE':
      return `Special price ${money(promo.specialPrice ?? promo.value)}`;
    case 'BUY_X_GET_Y':
      return `Buy ${promo.buyQuantity ?? 1} get ${promo.getQuantity ?? 1}`;
    case 'COMBO':
      return `Combo ${money(promo.specialPrice ?? promo.value)}`;
    default:
      return promo.mechanism;
  }
};

const PromotionsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const can = usePermissionStore((state) => state.can);
  const isOwner = user?.role === 'BUSINESS_ADMIN';
  const canManage = isOwner || can('MANAGE_PROMOTIONS');
  const canApprove = isOwner || can('APPROVE_PROMOTIONS');

  const initial = (params.get('tab') ?? params.get('kind') ?? 'ROOM').toString();
  const [tab, setTab] = useState<TabKey>(
    (['ROOM', 'FOOD_BEVERAGE', 'EVENT', 'approvals', 'analytics', 'policy'] as TabKey[]).includes(initial as TabKey) ? (initial as TabKey) : 'ROOM'
  );
  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<{ kind: PromotionKind; record: PromotionRecord | null } | null>(null);
  const [quick, setQuick] = useState<PromotionKind | null>(null);
  const [detail, setDetail] = useState<PromotionRecord | null>(null);
  const [reject, setReject] = useState<PromotionRecord | null>(null);

  const money = useCallback(
    (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value || 0),
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, lists] = await Promise.all([promotionsApi.list({ withPerformance: true }), lookups ? Promise.resolve(lookups) : promotionsApi.lookups()]);
      setPromotions(list);
      setLookups(lists);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load promotions'));
    } finally {
      setLoading(false);
    }
  }, [lookups]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTab = (next: TabKey) => {
    setTab(next);
    setParams(next === 'ROOM' ? {} : { tab: next }, { replace: true });
  };

  const pending = promotions.filter((promo) => promo.effectiveStatus === 'PENDING_APPROVAL');

  const act = async (promo: PromotionRecord, transition: Transition, note?: string) => {
    try {
      await promotionsApi.transition(promo.id, transition, note);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, `Could not ${transition} this promotion`));
    }
  };

  const openDetail = async (promo: PromotionRecord) => {
    try {
      setDetail(await promotionsApi.get(promo.id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the promotion'));
    }
  };

  const listFor = (kind: PromotionKind) => promotions.filter((promo) => promo.kind === kind);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800}>Promotions</Typography>
            <Typography variant="body2" color="text.secondary">
              Room, food & beverage and event offers: set them up, control who gets them, and see what they earn.
            </Typography>
          </Box>
          {canManage && (tab === 'ROOM' || tab === 'FOOD_BEVERAGE' || tab === 'EVENT') && (
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<BoltRoundedIcon />} onClick={() => setQuick(tab)}>Add quick promotion</Button>
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setEditor({ kind: tab, record: null })}>New promotion</Button>
            </Stack>
          )}
        </Stack>

        <Tabs value={tab} onChange={(_e, v) => changeTab(v)} variant="scrollable" sx={{ mb: 2 }}>
          <Tab value="ROOM" label="Room promotions" />
          <Tab value="FOOD_BEVERAGE" label="F&B promotions" />
          <Tab value="EVENT" label="Event promotions" />
          <Tab value="approvals" label={pending.length ? `Approvals (${pending.length})` : 'Approvals'} />
          <Tab value="analytics" label="Analytics" />
          {isOwner && <Tab value="policy" label="Approval rules" />}
        </Tabs>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {loading && !promotions.length ? (
          <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>
        ) : tab === 'ROOM' || tab === 'FOOD_BEVERAGE' || tab === 'EVENT' ? (
          <PromotionTable
            rows={listFor(tab)}
            money={money}
            canManage={canManage}
            onEdit={(record) => setEditor({ kind: record.kind, record })}
            onDetail={openDetail}
            onAct={act}
            empty={tab === 'ROOM' ? 'No room promotions yet.' : tab === 'EVENT' ? 'No event promotions yet.' : 'No food & beverage promotions yet.'}
          />
        ) : tab === 'approvals' ? (
          <Stack spacing={1.5}>
            {!pending.length && <Alert severity="info">Nothing waiting for approval.</Alert>}
            {pending.map((promo) => (
              <Paper key={promo.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography fontWeight={700}>{promo.name} <Typography component="span" variant="caption" color="text.secondary">({promo.code} · {KIND_LABEL[promo.kind]})</Typography></Typography>
                    <Typography variant="body2" color="text.secondary">{describe(promo, money)}</Typography>
                  </Box>
                  <Button size="small" onClick={() => void openDetail(promo)}>Details</Button>
                  {canApprove && (
                    <>
                      <Button size="small" color="error" variant="outlined" onClick={() => setReject(promo)}>Return</Button>
                      <Button size="small" variant="contained" onClick={() => void act(promo, 'approve')}>Approve</Button>
                    </>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : tab === 'analytics' ? (
          <AnalyticsPanel money={money} />
        ) : (
          <PolicyPanel />
        )}
      </Container>

      <PromotionEditor
        open={Boolean(editor)}
        kind={editor?.kind ?? 'ROOM'}
        record={editor?.record}
        lookups={lookups}
        currency={money}
        onClose={() => setEditor(null)}
        onSaved={() => {
          setEditor(null);
          void load();
        }}
      />
      <QuickPromotionDialog
        open={Boolean(quick)}
        kind={quick ?? 'ROOM'}
        onClose={() => setQuick(null)}
        onSaved={() => {
          setQuick(null);
          void load();
        }}
      />
      <RejectDialog
        promo={reject}
        onClose={() => setReject(null)}
        onConfirm={async (note) => {
          if (reject) await act(reject, 'reject', note);
          setReject(null);
        }}
      />
      <Drawer anchor="right" open={Boolean(detail)} onClose={() => setDetail(null)}>
        {detail && <DetailPanel promo={detail} money={money} />}
      </Drawer>
    </Layout>
  );
};

const PromotionTable: React.FC<{
  rows: PromotionRecord[];
  money: (v: number) => string;
  canManage: boolean;
  empty: string;
  onEdit: (record: PromotionRecord) => void;
  onDetail: (record: PromotionRecord) => void;
  onAct: (record: PromotionRecord, transition: Transition) => void;
}> = ({ rows, money, canManage, empty, onEdit, onDetail, onAct }) => {
  if (!rows.length) return <Alert severity="info">{empty}</Alert>;
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Promotion</TableCell>
            <TableCell>Offer</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Valid</TableCell>
            <TableCell align="right">Redemptions</TableCell>
            <TableCell align="right">Revenue</TableCell>
            <TableCell align="right">Discount cost</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((promo) => (
            <TableRow key={promo.id} hover>
              <TableCell>
                <Typography fontWeight={700} variant="body2">{promo.name}</Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{promo.code}</Typography>
                  {promo.isQuick && <Chip size="small" label="Quick" variant="outlined" />}
                  {promo.autoApply && <Chip size="small" label="Auto" variant="outlined" />}
                </Stack>
              </TableCell>
              <TableCell>{describe(promo, money)}</TableCell>
              <TableCell><Chip size="small" color={STATUS_COLOR[promo.effectiveStatus]} label={statusLabel(promo.effectiveStatus)} /></TableCell>
              <TableCell>
                <Typography variant="caption">
                  {promo.startsAt ? new Date(promo.startsAt).toLocaleDateString() : '—'} – {promo.endsAt ? new Date(promo.endsAt).toLocaleDateString() : 'open'}
                </Typography>
              </TableCell>
              <TableCell align="right">{promo.performance?.redemptions ?? promo.redemptionCount}</TableCell>
              <TableCell align="right">{money(promo.performance?.netRevenue ?? 0)}</TableCell>
              <TableCell align="right">{money(promo.performance?.discountCost ?? 0)}</TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                <Tooltip title="Performance & history"><IconButton size="small" onClick={() => onDetail(promo)}><HistoryRoundedIcon fontSize="small" /></IconButton></Tooltip>
                {canManage && (
                  <>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => onEdit(promo)}><EditRoundedIcon fontSize="small" /></IconButton></Tooltip>
                    {promo.effectiveStatus === 'DRAFT' && <Button size="small" onClick={() => onAct(promo, 'publish')}>Publish</Button>}
                    {(promo.effectiveStatus === 'ACTIVE' || promo.effectiveStatus === 'SCHEDULED') && (
                      <Tooltip title="Pause"><IconButton size="small" onClick={() => onAct(promo, 'pause')}><PauseRoundedIcon fontSize="small" /></IconButton></Tooltip>
                    )}
                    {promo.effectiveStatus === 'PAUSED' && (
                      <Tooltip title="Resume"><IconButton size="small" onClick={() => onAct(promo, 'resume')}><PlayArrowRoundedIcon fontSize="small" /></IconButton></Tooltip>
                    )}
                    <Tooltip title="Archive"><IconButton size="small" onClick={() => onAct(promo, 'archive')}><ArchiveRoundedIcon fontSize="small" /></IconButton></Tooltip>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
};

const RejectDialog: React.FC<{ promo: PromotionRecord | null; onClose: () => void; onConfirm: (note: string) => Promise<void> }> = ({ promo, onClose, onConfirm }) => {
  const [note, setNote] = useState('');
  useEffect(() => setNote(''), [promo]);
  return (
    <Dialog open={Boolean(promo)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Return {promo?.name} to draft</DialogTitle>
      <DialogContent>
        <TextField label="Reason (shown to the creator)" value={note} onChange={(e) => setNote(e.target.value)} fullWidth multiline minRows={2} sx={{ mt: 1 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="error" variant="contained" disabled={!note.trim()} onClick={() => void onConfirm(note.trim())}>Return</Button>
      </DialogActions>
    </Dialog>
  );
};

const DetailPanel: React.FC<{ promo: PromotionRecord; money: (v: number) => string }> = ({ promo, money }) => (
  <Box sx={{ width: { xs: '100vw', sm: 440 }, p: 3 }}>
    <Typography variant="h6" fontWeight={800}>{promo.name}</Typography>
    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{promo.code}</Typography>
    <Stack direction="row" spacing={1} sx={{ my: 1.5 }}>
      <Chip size="small" color={STATUS_COLOR[promo.effectiveStatus]} label={statusLabel(promo.effectiveStatus)} />
      <Chip size="small" label={describe(promo, money)} />
    </Stack>
    <Grid container spacing={1.5} sx={{ mb: 2 }}>
      {[
        ['Redemptions', String(promo.performance?.redemptions ?? 0)],
        [promo.kind === 'ROOM' ? 'Room nights' : promo.kind === 'EVENT' ? 'Event days' : 'Items sold', String(promo.performance?.units ?? 0)],
        ['Revenue (after discount)', money(promo.performance?.netRevenue ?? 0)],
        ['Discount cost', money(promo.performance?.discountCost ?? 0)],
        ...(promo.kind === 'FOOD_BEVERAGE' ? [['Margin', promo.performance?.margin != null ? `${promo.performance.margin}%` : '—']] : [])
      ].map(([label, value]) => (
        <Grid item xs={6} key={label}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography fontWeight={800}>{value}</Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
    {promo.rejectionReason && <Alert severity="warning" sx={{ mb: 2 }}>Returned: {promo.rejectionReason}</Alert>}
    <Typography fontWeight={700} sx={{ mb: 1 }}>Audit trail</Typography>
    <Stack spacing={1}>
      {(promo.history ?? []).map((entry, index) => (
        <Box key={index} sx={{ borderLeft: '3px solid', borderColor: 'divider', pl: 1.5 }}>
          <Typography variant="body2" fontWeight={600}>{entry.action.replace(/_/g, ' ').toLowerCase()}</Typography>
          <Typography variant="caption" color="text.secondary">{entry.by} · {new Date(entry.at).toLocaleString()}</Typography>
        </Box>
      ))}
      {!promo.history?.length && <Typography variant="body2" color="text.secondary">No changes recorded.</Typography>}
    </Stack>
  </Box>
);

const AnalyticsPanel: React.FC<{ money: (v: number) => string }> = ({ money }) => {
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Awaited<ReturnType<typeof promotionsApi.analytics>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    promotionsApi
      .analytics({ from, to: `${to}T23:59:59` })
      .then(setData)
      .catch((err) => setError(getApiErrorMessage(err, 'Could not load analytics')));
  }, [from, to]);

  const totals = data?.totals;
  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction="row" spacing={2}>
        <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
      </Stack>
      <Grid container spacing={2}>
        {[
          ['Redemptions', String(totals?.redemptions ?? 0)],
          ['Revenue generated', money(totals?.netRevenue ?? 0)],
          ['Discount cost', money(totals?.discountCost ?? 0)],
          ['Room nights / items', String(totals?.units ?? 0)]
        ].map(([label, value]) => (
          <Grid item xs={6} md={3} key={label}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
              <Typography variant="h5" fontWeight={800}>{value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Promotion</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Redemptions</TableCell>
              <TableCell align="right">Units</TableCell>
              <TableCell align="right">Gross</TableCell>
              <TableCell align="right">Discount</TableCell>
              <TableCell align="right">Net revenue</TableCell>
              <TableCell align="right">Margin</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.rows ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name} <Typography component="span" variant="caption" color="text.secondary">{row.code}</Typography></TableCell>
                <TableCell>{KIND_LABEL[row.kind as PromotionKind] ?? row.kind}</TableCell>
                <TableCell align="right">{row.redemptions}</TableCell>
                <TableCell align="right">{row.units}</TableCell>
                <TableCell align="right">{money(row.grossRevenue)}</TableCell>
                <TableCell align="right">{money(row.discountCost)}</TableCell>
                <TableCell align="right">{money(row.netRevenue)}</TableCell>
                <TableCell align="right">{row.margin != null ? `${row.margin}%` : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
};

const PolicyPanel: React.FC = () => {
  const [policy, setPolicy] = useState({ maxDiscountPercent: 30, minMarginPercent: 15 });
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({});
  useEffect(() => {
    promotionsApi.policy().then(setPolicy).catch(() => undefined);
  }, []);
  const save = async () => {
    try {
      await promotionsApi.savePolicy(policy);
      setStatus({ ok: 'Saved' });
    } catch (err) {
      setStatus({ error: getApiErrorMessage(err, 'Could not save') });
    }
  };
  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, maxWidth: 560 }}>
      <Typography fontWeight={800} sx={{ mb: 1 }}>When a manager must approve</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Promotions that give more than this discount, or leave less than this margin, wait for someone with “Approve promotions”. Nobody can approve their own.
      </Typography>
      {status.ok && <Alert severity="success" sx={{ mb: 2 }}>{status.ok}</Alert>}
      {status.error && <Alert severity="error" sx={{ mb: 2 }}>{status.error}</Alert>}
      <Stack direction="row" spacing={2}>
        <TextField type="number" label="Discount above (%)" value={policy.maxDiscountPercent} onChange={(e) => setPolicy({ ...policy, maxDiscountPercent: Number(e.target.value) })} />
        <TextField type="number" label="Margin below (%)" value={policy.minMarginPercent} onChange={(e) => setPolicy({ ...policy, minMarginPercent: Number(e.target.value) })} />
      </Stack>
      <Button variant="contained" sx={{ mt: 2 }} onClick={() => void save()}>Save rules</Button>
    </Paper>
  );
};

export default PromotionsPage;

// Used by other screens that only need the status chip.
export const PromotionStatusChip: React.FC<{ status: PromotionStatus }> = ({ status }) => (
  <Chip size="small" color={STATUS_COLOR[status]} label={statusLabel(status)} />
);

export const useMoney = () => useMemo(() => (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value || 0), []);
