import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import Layout from '../../../components/Layout';
import { formatNaira } from '../../../services/hr.service';
import {
  apiError,
  paymentsApi,
  STATUS_COLOR,
  STATUS_LABEL,
  type NewPayment,
  type PaymentCapabilities,
  type PaymentMethod,
  type PaymentRecord,
  type PaymentStatus
} from '../../../services/payments';

/**
 * Finance → Payments.
 *
 *   HR prepares a payment (a payroll run, or another staff payment) and
 *   submits it → the Admin or GM approves it, choosing bank or cash, or
 *   rejects it with a reason → the accountant prints or downloads the payment
 *   book and marks payments paid, one at a time or in a batch.
 *
 * Each person sees the tabs and buttons their permissions allow; the server
 * enforces the same rules (no self-approval, the accountant pays).
 */

type TabKey = 'PENDING_APPROVAL' | 'APPROVED' | 'PAID' | 'DRAFT' | 'CLOSED' | 'ALL';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'PENDING_APPROVAL', label: 'Awaiting approval' },
  { key: 'APPROVED', label: 'Approved — to pay' },
  { key: 'PAID', label: 'Paid' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'CLOSED', label: 'Rejected / voided' },
  { key: 'ALL', label: 'All' }
];

const EXPENSE_CATEGORIES = ['Staff Salaries', 'Staff Welfare', 'Transport & Logistics', 'Professional Fees', 'Repairs & Maintenance', 'Miscellaneous'];

const date = (value: string | null) => (value ? new Date(value).toLocaleDateString('en-GB') : '—');
// Local dates: toISOString is UTC and shifts a midnight date back a day.
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const firstOfMonth = () => {
  const d = new Date();
  return ymd(new Date(d.getFullYear(), d.getMonth(), 1));
};
const endOfMonth = () => {
  const d = new Date();
  return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

const PaymentsPage = () => {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [can, setCan] = useState<PaymentCapabilities | null>(null);
  const [tab, setTab] = useState<TabKey>('PENDING_APPROVAL');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ type: 'PAYROLL' as 'PAYROLL' | 'OTHER', periodStart: firstOfMonth(), periodEnd: endOfMonth(), description: '', amount: '', category: 'Staff Welfare', payeeName: '' });
  const [approving, setApproving] = useState<PaymentRecord | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('BANK');
  const [reasonFor, setReasonFor] = useState<{ record: PaymentRecord; action: 'reject' | 'void' } | null>(null);
  const [reason, setReason] = useState('');

  const bookOnly = Boolean(can && !can.create && !can.approve);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await paymentsApi.list();
      setRecords(data.records);
      setCan(data.capabilities);
      // Land each person on their own queue.
      setTab((current) => {
        if (data.capabilities.create || data.capabilities.approve) return current;
        return current === 'PAID' ? 'PAID' : 'APPROVED';
      });
    } catch (err) {
      setMessage({ type: 'error', text: apiError(err, 'Could not load payments.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tabs = useMemo(() => (bookOnly ? TABS.filter((t) => t.key === 'APPROVED' || t.key === 'PAID') : TABS), [bookOnly]);
  const shown = useMemo(() => {
    if (tab === 'ALL') return records;
    if (tab === 'CLOSED') return records.filter((r) => r.status === 'REJECTED' || r.status === 'VOIDED');
    return records.filter((r) => r.status === (tab as PaymentStatus));
  }, [records, tab]);
  const countOf = (key: TabKey) =>
    key === 'ALL' ? records.length : key === 'CLOSED' ? records.filter((r) => r.status === 'REJECTED' || r.status === 'VOIDED').length : records.filter((r) => r.status === key).length;
  const selectedTotal = shown.filter((r) => selected.includes(r.id)).reduce((sum, r) => sum + r.amount, 0);

  const run = async (work: () => Promise<string | void>, fallback: string) => {
    setBusy(true);
    try {
      const text = await work();
      if (text) setMessage({ type: 'success', text });
      setSelected([]);
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: apiError(err, fallback) });
    } finally {
      setBusy(false);
    }
  };

  const createPayment = () =>
    run(async () => {
      const input: NewPayment =
        draft.type === 'PAYROLL'
          ? { type: 'PAYROLL', periodStart: draft.periodStart, periodEnd: draft.periodEnd, description: draft.description || undefined }
          : { type: 'OTHER', description: draft.description, amount: Number(draft.amount), category: draft.category, payeeName: draft.payeeName || null };
      const record = await paymentsApi.create(input);
      setCreateOpen(false);
      setTab('DRAFT');
      return `${record.reference} saved as a draft (${formatNaira(record.amount)}). Submit it when it is ready for approval.`;
    }, 'Could not create the payment.');

  const markPaid = (ids: string[]) =>
    run(async () => {
      const result = await paymentsApi.markPaid(ids);
      const failures = result.results.filter((r) => !r.ok).map((r) => `${r.reference}: ${r.error}`);
      return failures.length ? `${result.message} Not paid — ${failures.join('; ')}` : result.message;
    }, 'Could not mark the payment paid.');

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>{bookOnly ? 'Payment Book' : 'Payments'}</Typography>
            <Typography variant="body2" color="text.secondary">
              HR prepares · Admin or GM approves (bank or cash) · Accountant pays. Approved payments appear in Expenses automatically.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {can?.book && (
              <>
                <Button variant="outlined" disabled={busy} onClick={() => paymentsApi.printBook('APPROVED').catch((err) => setMessage({ type: 'error', text: apiError(err, 'Could not open the payment book.') }))}>
                  Print payment book
                </Button>
                <Button variant="outlined" disabled={busy} onClick={() => paymentsApi.downloadBook('APPROVED', 'pdf')}>PDF</Button>
                <Button variant="outlined" disabled={busy} onClick={() => paymentsApi.downloadBook('ALL', 'csv')}>CSV</Button>
              </>
            )}
            {can?.create && (
              <Button variant="contained" disabled={busy} onClick={() => setCreateOpen(true)}>New payment</Button>
            )}
          </Stack>
        </Stack>

        {message && <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mb: 2 }}>{message.text}</Alert>}

        <Tabs value={tabs.some((t) => t.key === tab) ? tab : tabs[0].key} onChange={(_e, value) => { setTab(value); setSelected([]); }} variant="scrollable" sx={{ mb: 2 }}>
          {tabs.map((t) => <Tab key={t.key} value={t.key} label={`${t.label} (${countOf(t.key)})`} />)}
        </Tabs>

        {tab === 'APPROVED' && can?.markPaid && (
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
            <Button variant="contained" color="success" disabled={busy || selected.length === 0} onClick={() => markPaid(selected)}>
              Mark {selected.length || ''} paid
            </Button>
            {selected.length > 0 && <Typography variant="body2" color="text.secondary">Selected total {formatNaira(selectedTotal)}</Typography>}
          </Stack>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <Card variant="outlined">
            <TableContainer sx={{ maxHeight: '70vh' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {tab === 'APPROVED' && can?.markPaid && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={shown.length > 0 && selected.length === shown.length}
                          indeterminate={selected.length > 0 && selected.length < shown.length}
                          onChange={(e) => setSelected(e.target.checked ? shown.map((r) => r.id) : [])}
                        />
                      </TableCell>
                    )}
                    <TableCell>Reference</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Prepared / approved</TableCell>
                    <TableCell>Expense</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shown.length === 0 && (
                    <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>Nothing here.</TableCell></TableRow>
                  )}
                  {shown.map((r) => (
                    <TableRow key={r.id} hover>
                      {tab === 'APPROVED' && can?.markPaid && (
                        <TableCell padding="checkbox">
                          <Checkbox checked={selected.includes(r.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((id) => id !== r.id)))} />
                        </TableCell>
                      )}
                      <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.reference}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{r.description}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.type === 'PAYROLL' ? `Payroll · ${r.staffCount} staff` : `${r.category}${r.payeeName ? ` · ${r.payeeName}` : ''}`}
                        </Typography>
                        {r.rejectionReason && <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>Rejected: {r.rejectionReason}</Typography>}
                        {r.voidReason && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Voided: {r.voidReason}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Chip size="small" color={STATUS_COLOR[r.status]} label={STATUS_LABEL[r.status]} />
                          {r.selfApproved && (
                            <Tooltip title="Approved by the person who submitted it, because the business has no other approver">
                              <Chip size="small" variant="outlined" color="warning" label="Self-approved" />
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatNaira(r.amount)}</TableCell>
                      <TableCell>{r.paymentMethod ? (r.paymentMethod === 'BANK' ? 'Bank' : 'Cash') : '—'}</TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ display: 'block' }}>By {r.submittedByName ?? r.createdByName ?? '—'} · {date(r.submittedAt ?? r.createdAt)}</Typography>
                        {r.approvedByName && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Approved by {r.approvedByName} · {date(r.approvedAt)}</Typography>}
                        {r.paidMarkedByName && <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>Paid by {r.paidMarkedByName} · {date(r.paidAt)}</Typography>}
                      </TableCell>
                      <TableCell>{r.expense ? <Chip size="small" variant="outlined" label={`${r.expense.reference}${r.expense.status === 'VOIDED' ? ' (void)' : ''}`} /> : '—'}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {r.status === 'DRAFT' && can?.create && (
                            <>
                              <Button size="small" variant="contained" disabled={busy} onClick={() => run(async () => { await paymentsApi.submit(r.id); return `${r.reference} sent for approval.`; }, 'Could not submit.')}>Submit</Button>
                              <Button size="small" color="inherit" disabled={busy} onClick={() => run(async () => { await paymentsApi.remove(r.id); return `${r.reference} deleted.`; }, 'Could not delete.')}>Delete</Button>
                            </>
                          )}
                          {r.status === 'PENDING_APPROVAL' && can?.approve && (
                            <>
                              <Button size="small" variant="contained" color="success" disabled={busy} onClick={() => { setApproving(r); setMethod('BANK'); }}>Approve</Button>
                              <Button size="small" color="error" disabled={busy} onClick={() => { setReasonFor({ record: r, action: 'reject' }); setReason(''); }}>Reject</Button>
                            </>
                          )}
                          {r.status === 'APPROVED' && can?.markPaid && (
                            <Button size="small" variant="outlined" color="success" disabled={busy} onClick={() => markPaid([r.id])}>Mark paid</Button>
                          )}
                          {r.status === 'APPROVED' && can?.approve && (
                            <Button size="small" color="inherit" disabled={busy} onClick={() => { setReasonFor({ record: r, action: 'void' }); setReason(''); }}>Void</Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        )}

        {/* New payment */}
        <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>New payment</DialogTitle>
          <DialogContent>
            <RadioGroup row value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as 'PAYROLL' | 'OTHER' })} sx={{ mb: 2 }}>
              <FormControlLabel value="PAYROLL" control={<Radio />} label="Payroll run" />
              <FormControlLabel value="OTHER" control={<Radio />} label="Other staff payment" />
            </RadioGroup>
            {draft.type === 'PAYROLL' ? (
              <Stack spacing={2}>
                <Alert severity="info">Takes the draft payroll of this period (generate it on the Payroll page first). The amount is their total net pay.</Alert>
                <Stack direction="row" spacing={2}>
                  <TextField label="Period start" type="date" fullWidth InputLabelProps={{ shrink: true }} value={draft.periodStart} onChange={(e) => setDraft({ ...draft, periodStart: e.target.value })} />
                  <TextField label="Period end" type="date" fullWidth InputLabelProps={{ shrink: true }} value={draft.periodEnd} onChange={(e) => setDraft({ ...draft, periodEnd: e.target.value })} />
                </Stack>
                <TextField label="Description (optional)" fullWidth value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Stack>
            ) : (
              <Stack spacing={2}>
                <TextField label="Description" required fullWidth value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                <TextField label="Amount (₦)" required type="number" fullWidth value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
                <TextField select label="Expense category" fullWidth value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  {EXPENSE_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
                <TextField label="Paid to (optional)" fullWidth value={draft.payeeName} onChange={(e) => setDraft({ ...draft, payeeName: e.target.value })} />
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={busy || (draft.type === 'OTHER' && (draft.description.trim().length < 3 || !(Number(draft.amount) > 0)))}
              onClick={createPayment}
            >
              Save draft
            </Button>
          </DialogActions>
        </Dialog>

        {/* Approve: choose bank or cash */}
        <Dialog open={Boolean(approving)} onClose={() => setApproving(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Approve {approving?.reference}</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 2 }}>{approving?.description} — <strong>{approving ? formatNaira(approving.amount) : ''}</strong></Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>How will it be paid?</Typography>
            <RadioGroup value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              <FormControlLabel value="BANK" control={<Radio />} label="Bank transfer" />
              <FormControlLabel value="CASH" control={<Radio />} label="Cash" />
            </RadioGroup>
            <Alert severity="info" sx={{ mt: 1 }}>Approving adds it to Expenses and sends it to the accountant’s payment book.</Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setApproving(null)}>Cancel</Button>
            <Button
              variant="contained"
              color="success"
              disabled={busy}
              onClick={() => {
                const record = approving!;
                setApproving(null);
                run(async () => {
                  const result = await paymentsApi.approve(record.id, method);
                  return `${record.reference} approved (${method === 'BANK' ? 'bank' : 'cash'}). Added to Expenses as ${result.expense.reference}.${result.selfApproved ? ' Flagged as self-approved.' : ''}`;
                }, 'Could not approve.');
              }}
            >
              Approve
            </Button>
          </DialogActions>
        </Dialog>

        {/* Reject or void, with a reason */}
        <Dialog open={Boolean(reasonFor)} onClose={() => setReasonFor(null)} maxWidth="xs" fullWidth>
          <DialogTitle>{reasonFor?.action === 'reject' ? 'Reject' : 'Void'} {reasonFor?.record.reference}</DialogTitle>
          <DialogContent>
            {reasonFor?.action === 'void' && <Alert severity="warning" sx={{ mb: 2 }}>Voiding cancels an approved payment: its expense is voided and the ledger is reversed.</Alert>}
            <TextField label="Reason" required fullWidth multiline minRows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReasonFor(null)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              disabled={busy || reason.trim().length < 3}
              onClick={() => {
                const { record, action } = reasonFor!;
                setReasonFor(null);
                run(async () => {
                  if (action === 'reject') await paymentsApi.reject(record.id, reason.trim());
                  else await paymentsApi.void(record.id, reason.trim());
                  return `${record.reference} ${action === 'reject' ? 'rejected' : 'voided'}.`;
                }, `Could not ${action}.`);
              }}
            >
              {reasonFor?.action === 'reject' ? 'Reject' : 'Void'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default PaymentsPage;
