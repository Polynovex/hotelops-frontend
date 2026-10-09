import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import { useSnackbar } from 'notistack';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import { RecordCalendar } from '../../../components/finance/RecordCalendar';
import { DailyRecordForm, emptyRecord } from '../../../components/finance/DailyRecordForm';
import { RecordAudit } from '../../../components/finance/RecordAudit';
import { useAuthStore } from '../../../store/authStore';
import {
  dailyRecords,
  naira,
  STATUS_LABEL,
  type AccessRequest,
  type CalendarDay,
  type DailyRecord,
  type DailyRecordData,
  type DailyTotals,
  type Meta
} from '../../../services/dailyRecords';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * Daily financial records (entry) and the Business Admin's approval screen.
 *
 * Both share one record panel. Figures shown as "Approved" are what every
 * report uses; a submission or edit is shown beside them as "Proposed" until
 * the Business Admin decides.
 */

const STATUS_COLOR = { SUBMITTED: 'error', APPROVED: 'success', REJECTED: 'error', EDIT_REQUESTED: 'warning' } as const;

const TotalsStrip = ({ totals, label }: { totals: DailyTotals; label: string }) => (
  <Paper variant="outlined" sx={{ p: 1.5 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
      <Box><Typography variant="caption">Revenue</Typography><Typography fontWeight={800}>{naira(totals.totalRevenue)}</Typography></Box>
      <Box><Typography variant="caption">Expenses</Typography><Typography fontWeight={800}>{naira(totals.operatingExpenses)}</Typography></Box>
      <Box><Typography variant="caption">Net operating</Typography><Typography fontWeight={800} color={totals.netOperatingProfit < 0 ? 'error.main' : 'success.main'}>{naira(totals.netOperatingProfit)}</Typography></Box>
      <Box><Typography variant="caption">Occupancy</Typography><Typography fontWeight={800}>{totals.rooms.occupancyPercent}%</Typography></Box>
      <Box><Typography variant="caption">Cash variance</Typography><Typography fontWeight={800} color={Math.abs(totals.cashVariance) > 0.01 ? 'error.main' : undefined}>{naira(totals.cashVariance)}</Typography></Box>
    </Stack>
  </Paper>
);

function RecordPanel({
  date,
  mode,
  meta,
  onChanged
}: {
  date: string;
  mode: 'entry' | 'approve';
  meta: Meta | null;
  onChanged: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const isOwner = useAuthStore((state) => String(state.user?.role || '').toUpperCase() === 'BUSINESS_ADMIN');
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState<DailyRecordData | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [tab, setTab] = useState<'figures' | 'proposed' | 'history'>('figures');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setDraft(null);
    setError('');
    try {
      const data = await dailyRecords.get(date);
      setRecord(data);
      setMissing(false);
      setTab(data.pendingData && mode === 'approve' ? 'proposed' : 'figures');
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setRecord(null);
      setMissing(status === 404);
      if (status !== 404) setError(getApiErrorMessage(err, 'Could not load this day'));
    } finally {
      setLoading(false);
    }
  }, [date, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const startNew = async () => {
    try {
      const { data } = await dailyRecords.prefill(date);
      setDraft(data);
    } catch {
      setDraft(emptyRecord());
    }
  };

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError('');
    try {
      await action();
      enqueueSnackbar(success, { variant: 'success' });
      setReason('');
      setNote('');
      onChanged();
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'That did not work'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LogoLoader inline minHeight={160} />;

  // --- Editing (new record, edit request, resubmission, or owner edit)
  if (draft) {
    const editingExisting = Boolean(record);
    const needsReason = editingExisting && !isOwner;
    return (
      <Stack spacing={2}>
        <Typography variant="h6" fontWeight={800}>
          {editingExisting ? (isOwner ? 'Edit record' : record?.status === 'REJECTED' ? 'Correct and resubmit' : 'Request an edit') : 'New daily record'} · {date}
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {editingExisting && !isOwner && record?.status === 'APPROVED' && (
          <Alert severity="info">The approved figures keep showing in every report until the Business Admin approves this edit.</Alert>
        )}
        <DailyRecordForm value={draft} onChange={setDraft} meta={meta} />
        {needsReason && <TextField label="Reason for the change" value={reason} onChange={(event) => setReason(event.target.value)} required />}
        <Stack direction="row" spacing={1}>
          <Button onClick={() => setDraft(null)} disabled={busy}>Cancel</Button>
          <Button
            variant="contained"
            disabled={busy || (needsReason && !reason.trim())}
            onClick={() =>
              void run(
                () => (record ? dailyRecords.edit(record.id, draft, reason.trim()) : dailyRecords.submit(date, draft)),
                record
                  ? isOwner ? 'Record updated' : 'Sent to the Business Admin for approval'
                  : isOwner ? 'Record saved and approved' : 'Submitted to the Business Admin for approval'
              )
            }
          >
            {record ? (isOwner ? 'Save changes' : 'Send for approval') : isOwner ? 'Save record' : 'Submit for approval'}
          </Button>
        </Stack>
      </Stack>
    );
  }

  if (missing) {
    return (
      <Stack spacing={2} alignItems="flex-start">
        <Typography variant="h6" fontWeight={800}>{date}</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Typography color="text.secondary">No record for this day yet.</Typography>
        {mode === 'entry' && <Button variant="contained" onClick={() => void startNew()}>Start record</Button>}
      </Stack>
    );
  }

  if (!record) return error ? <Alert severity="error">{error}</Alert> : null;

  const awaiting = record.status === 'SUBMITTED' || record.status === 'EDIT_REQUESTED';

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="h6" fontWeight={800}>{record.businessDate}</Typography>
        <Chip label={STATUS_LABEL[record.status]} color={STATUS_COLOR[record.status]} />
        {record.version > 0 && <Chip size="small" variant="outlined" label={`Version ${record.version}`} />}
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {record.status === 'REJECTED' && record.decisionNote && <Alert severity="error">Rejected: {record.decisionNote}</Alert>}
      {record.status === 'EDIT_REQUESTED' && record.editReason && <Alert severity="warning">Edit requested: {record.editReason}</Alert>}

      {record.totals && <TotalsStrip totals={record.totals} label="Approved figures (used by every report)" />}
      {record.pendingTotals && <TotalsStrip totals={record.pendingTotals} label={record.status === 'REJECTED' ? 'Rejected submission' : 'Proposed figures (not yet approved)'} />}

      <Tabs value={tab} onChange={(_event, value) => setTab(value)}>
        <Tab value="figures" label="Approved" disabled={!record.data} />
        <Tab value="proposed" label={record.status === 'REJECTED' ? 'Rejected' : 'Proposed'} disabled={!record.pendingData} />
        <Tab value="history" label="Edit history" />
      </Tabs>
      {tab === 'figures' && record.data && <DailyRecordForm value={record.data} onChange={() => undefined} meta={meta} readOnly />}
      {tab === 'proposed' && record.pendingData && <DailyRecordForm value={record.pendingData} onChange={() => undefined} meta={meta} readOnly />}
      {tab === 'history' && <RecordAudit revisions={record.revisions ?? []} />}

      {mode === 'approve' && awaiting && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography fontWeight={800} sx={{ mb: 1 }}>Decision</Typography>
          <TextField fullWidth multiline minRows={2} label="Note (required to reject)" value={note} onChange={(event) => setNote(event.target.value)} sx={{ mb: 1.5 }} />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" color="success" disabled={busy} onClick={() => void run(() => dailyRecords.approve(record.id, note.trim() || undefined), record.status === 'EDIT_REQUESTED' ? 'Edit approved — reports updated' : 'Record approved')}>
              Approve
            </Button>
            <Button variant="outlined" color="error" disabled={busy || !note.trim()} onClick={() => void run(() => dailyRecords.reject(record.id, note.trim()), 'Rejected')}>
              Reject
            </Button>
          </Stack>
        </Paper>
      )}

      {mode === 'entry' && !awaiting && (
        <Box>
          <Button variant="outlined" onClick={() => setDraft(structuredClone((record.status === 'REJECTED' ? record.pendingData : record.data) ?? emptyRecord()))}>
            {record.status === 'REJECTED' ? 'Correct and resubmit' : isOwner ? 'Edit' : 'Request edit'}
          </Button>
        </Box>
      )}
      {mode === 'entry' && awaiting && <Alert severity="info">Waiting for the Business Admin. It cannot be changed until they decide.</Alert>}
    </Stack>
  );
}

function useCalendar() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [visibleFrom, setVisibleFrom] = useState('');
  const reload = useCallback(async () => {
    try {
      const data = await dailyRecords.calendar(month);
      setDays(data.days);
      setVisibleFrom(data.visibleFrom);
    } catch {
      setDays([]);
    }
  }, [month]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { month, setMonth, days, visibleFrom, reload };
}

/** /business/finance/daily-records */
export function DailyRecordsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [params, setParams] = useSearchParams();
  const role = useAuthStore((state) => String(state.user?.role || '').toUpperCase());
  const [meta, setMeta] = useState<Meta | null>(null);
  const calendar = useCalendar();
  const selected = params.get('date') ?? new Date().toISOString().slice(0, 10);
  const [asking, setAsking] = useState(false);
  const [request, setRequest] = useState({ fromDate: '', toDate: '', scope: 'VIEW' as 'VIEW' | 'EDIT', reason: '' });
  const [myRequests, setMyRequests] = useState<AccessRequest[]>([]);

  useEffect(() => {
    dailyRecords.meta().then(setMeta).catch(() => undefined);
    dailyRecords.accessRequests().then(setMyRequests).catch(() => undefined);
  }, []);

  const submitRequest = async () => {
    try {
      await dailyRecords.requestAccess(request);
      enqueueSnackbar('Request sent to the Business Admin', { variant: 'success' });
      setAsking(false);
      setMyRequests(await dailyRecords.accessRequests());
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not send the request'), { variant: 'error' });
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Daily records</Typography>
            <Typography variant="body2" color="text.secondary">
              Record each day's figures for Business Admin approval. A day cannot be entered until the one before it is approved.
            </Typography>
          </Box>
          {role !== 'BUSINESS_ADMIN' && <Button variant="outlined" onClick={() => setAsking(true)}>Request access to older records</Button>}
        </Stack>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4} lg={3}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <RecordCalendar
                month={calendar.month}
                days={calendar.days}
                selected={selected}
                onMonthChange={calendar.setMonth}
                onSelect={(day) => setParams({ date: day.date })}
              />
              {calendar.visibleFrom && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  You can see records from {calendar.visibleFrom}.
                </Typography>
              )}
            </Paper>
            {myRequests.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                <Typography fontWeight={800} sx={{ mb: 1 }}>My access requests</Typography>
                {myRequests.slice(0, 5).map((item) => (
                  <Typography key={item.id} variant="body2">
                    {item.fromDate.slice(0, 10)} – {item.toDate.slice(0, 10)} ({item.scope.toLowerCase()}): <strong>{item.status.toLowerCase()}</strong>
                  </Typography>
                ))}
              </Paper>
            )}
          </Grid>
          <Grid item xs={12} md={8} lg={9}>
            <RecordPanel key={selected} date={selected} mode="entry" meta={meta} onChanged={() => void calendar.reload()} />
          </Grid>
        </Grid>

        <Dialog open={asking} onClose={() => setAsking(false)} fullWidth maxWidth="xs">
          <DialogTitle>Request access to older records</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField type="date" label="From" value={request.fromDate} onChange={(event) => setRequest({ ...request, fromDate: event.target.value })} InputLabelProps={{ shrink: true }} />
              <TextField type="date" label="To" value={request.toDate} onChange={(event) => setRequest({ ...request, toDate: event.target.value })} InputLabelProps={{ shrink: true }} />
              <TextField select label="Access" value={request.scope} onChange={(event) => setRequest({ ...request, scope: event.target.value as 'VIEW' | 'EDIT' })}>
                <MenuItem value="VIEW">View only</MenuItem>
                <MenuItem value="EDIT">View and request edits</MenuItem>
              </TextField>
              <TextField label="Reason" multiline minRows={2} value={request.reason} onChange={(event) => setRequest({ ...request, reason: event.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAsking(false)}>Cancel</Button>
            <Button variant="contained" disabled={!request.fromDate || !request.toDate || !request.reason.trim()} onClick={() => void submitRequest()}>Send</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
}

/** /business/finance/approvals — Business Admin only. */
export function FinanceApprovalsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [params, setParams] = useSearchParams();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [pending, setPending] = useState<DailyRecord[]>([]);
  const [access, setAccess] = useState<AccessRequest[]>([]);
  const calendar = useCalendar();
  const selected = params.get('date');

  const loadPending = useCallback(async () => {
    try {
      const data = await dailyRecords.pending();
      setPending(data.records);
      setAccess(data.accessRequests);
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not load approvals'), { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    dailyRecords.meta().then(setMeta).catch(() => undefined);
    void loadPending();
  }, [loadPending]);

  const decide = async (item: AccessRequest, decision: 'APPROVE' | 'REJECT') => {
    try {
      await dailyRecords.decideAccess(item.id, decision, 7);
      enqueueSnackbar(decision === 'APPROVE' ? 'Access granted for 7 days' : 'Access refused', { variant: 'success' });
      await loadPending();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not decide'), { variant: 'error' });
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" fontWeight={700}>Approve requests</Typography>
          <Typography variant="body2" color="text.secondary">
            Daily records and edits wait here for you. Nothing reaches reports until you approve it.
          </Typography>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4} lg={3}>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography fontWeight={800} sx={{ mb: 1 }}>Waiting for you ({pending.length})</Typography>
              {pending.length === 0 && <Typography variant="body2" color="text.secondary">Nothing to approve.</Typography>}
              <Stack spacing={1}>
                {pending.map((record) => (
                  <Button
                    key={record.id}
                    variant={selected === record.businessDate ? 'contained' : 'outlined'}
                    color={record.status === 'EDIT_REQUESTED' ? 'warning' : 'error'}
                    onClick={() => setParams({ date: record.businessDate })}
                    sx={{ justifyContent: 'space-between' }}
                  >
                    <span>{record.businessDate}</span>
                    <span>{STATUS_LABEL[record.status]}</span>
                  </Button>
                ))}
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <RecordCalendar
                month={calendar.month}
                days={calendar.days}
                selected={selected}
                onMonthChange={calendar.setMonth}
                onSelect={(day) => setParams({ date: day.date })}
              />
            </Paper>
            {access.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography fontWeight={800} sx={{ mb: 1 }}>Access requests</Typography>
                {access.map((item) => (
                  <Box key={item.id} sx={{ mb: 1.5 }}>
                    <Typography variant="body2">
                      {item.scope === 'EDIT' ? 'Edit' : 'View'} {item.fromDate.slice(0, 10)} – {item.toDate.slice(0, 10)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">“{item.reason}”</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <Button size="small" color="success" onClick={() => void decide(item, 'APPROVE')}>Grant 7 days</Button>
                      <Button size="small" color="error" onClick={() => void decide(item, 'REJECT')}>Refuse</Button>
                    </Stack>
                  </Box>
                ))}
              </Paper>
            )}
          </Grid>
          <Grid item xs={12} md={8} lg={9}>
            {selected ? (
              <RecordPanel
                key={selected}
                date={selected}
                mode="approve"
                meta={meta}
                onChanged={() => {
                  void loadPending();
                  void calendar.reload();
                }}
              />
            ) : (
              <Typography color="text.secondary">Select a request or a day on the calendar to view its record.</Typography>
            )}
          </Grid>
        </Grid>
      </Container>
    </Layout>
  );
}
