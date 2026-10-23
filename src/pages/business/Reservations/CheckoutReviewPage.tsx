import React, { useCallback, useEffect, useState } from 'react';
import RowActionsMenu from '../../../components/common/RowActionsMenu';
import { useNavigate, useParams } from 'react-router-dom';
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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import Layout from '../../../components/Layout';
import CheckoutSettlementDialog from '../../../components/reservations/CheckoutSettlementDialog';
import DamageReportDialog from '../../../components/checkout/DamageReportDialog';
import { usePermissionStore } from '../../../store/permissionStore';
import {
  ADDABLE_CATEGORIES,
  CHARGE_STATUS_LABEL,
  DAMAGE_STATUS_LABEL,
  INSPECTION_LABEL,
  checkoutApi,
  type ChargeCategory,
  type CheckoutCharge,
  type CheckoutReview,
  type DamageIncident
} from '../../../services/checkout';
import { formatCurrency } from '../../../utils/formatters';
import { getApiErrorMessage } from '../../../utils/apiError';
import { printElement } from '../../../utils/printElement';

/**
 * Check-out review: A guest and stay, B the bill so far, C late check-out and
 * damage, D additional charges and minibar, E the final bill, F settle and
 * check out. Charges are approved before they reach the bill; nothing is
 * counted twice.
 */

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  PENDING_APPROVAL: 'warning',
  POSTED: 'success',
  DISPUTED: 'error',
  WAIVED: 'default',
  REJECTED: 'default',
  REVERSED: 'default',
  REPORTED: 'warning',
  UNDER_ASSESSMENT: 'warning',
  AWAITING_APPROVAL: 'warning',
  APPROVED: 'success',
  CLOSED: 'default',
  PENDING_REVIEW: 'warning',
  CHARGED: 'success',
  NO_CHARGE: 'default'
};

const Section: React.FC<{ letter: string; title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ letter, title, action, children }) => (
  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
      <Typography fontWeight={800}>{letter}. {title}</Typography>
      {action}
    </Stack>
    {children}
  </Paper>
);

const Row: React.FC<{ label: string; value: number; strong?: boolean; negative?: boolean }> = ({ label, value, strong, negative }) => (
  <Stack direction="row" justifyContent="space-between">
    <Typography variant="body2" fontWeight={strong ? 800 : 400}>{label}</Typography>
    <Typography variant="body2" fontWeight={strong ? 800 : 600}>{negative ? `− ${formatCurrency(value)}` : formatCurrency(value)}</Typography>
  </Stack>
);

const CheckoutReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = usePermissionStore((state) => state.can);
  const canApprove = can('APPROVE_CHECKOUT_CHARGES');

  const [review, setReview] = useState<CheckoutReview | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [damageOpen, setDamageOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [charge, setCharge] = useState({ category: 'LAUNDRY' as ChargeCategory, description: '', serviceLocation: '', serviceDate: '', quantity: '1', unitPrice: '', supportingRef: '', remarks: '' });
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [lateOpen, setLateOpen] = useState(false);
  const [late, setLate] = useState({ actualTime: '', waiveAmount: '', reason: '' });
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendUntil, setExtendUntil] = useState('');
  const [reasonFor, setReasonFor] = useState<{ title: string; run: (reason: string) => Promise<unknown> } | null>(null);
  const [reason, setReason] = useState('');
  const [assessing, setAssessing] = useState<DamageIncident | null>(null);
  const [assessment, setAssessment] = useState({ assessmentMethod: 'REPAIR', assessedCost: '', recoveryCharge: '', assessment: '' });
  const [refundOpen, setRefundOpen] = useState(false);
  const [refund, setRefund] = useState({ amount: '', method: 'TRANSFER', reason: '' });

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setReview(await checkoutApi.review(id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the stay'));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      if (done) setNotice(done);
      await load();
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, 'That did not work'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addCharge = async (confirmDuplicate = false) => {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      const saved = await checkoutApi.addCharge(id, {
        category: charge.category,
        description: charge.description.trim(),
        serviceLocation: charge.serviceLocation.trim() || undefined,
        serviceDate: charge.serviceDate ? new Date(charge.serviceDate).toISOString() : undefined,
        quantity: Number(charge.quantity) || 1,
        unitPrice: Number(charge.unitPrice),
        supportingRef: charge.supportingRef.trim() || undefined,
        remarks: charge.remarks.trim() || undefined,
        confirmDuplicate
      });
      setChargeOpen(false);
      setDuplicateWarning('');
      setNotice(saved.status === 'PENDING_APPROVAL' ? `${saved.reference} is waiting for a manager's approval.` : `${saved.reference} added to the bill.`);
      await load();
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      if (data?.error === 'POSSIBLE_DUPLICATE') setDuplicateWarning(data.message ?? 'This may already be on the bill.');
      else setError(getApiErrorMessage(err, 'Could not add the charge'));
    } finally {
      setBusy(false);
    }
  };

  if (!review) {
    return (
      <Layout>
        <Container maxWidth="lg" sx={{ py: 3 }}>
          {error ? <Alert severity="error">{error}</Alert> : <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}><CircularProgress /></Box>}
        </Container>
      </Layout>
    );
  }

  const { booking, lateCheckout, summary } = review;
  const checkedOut = booking.status === 'CHECKED_OUT';
  const askReason = (title: string, action: (reason: string) => Promise<unknown>) => {
    setReason('');
    setReasonFor({ title, run: action });
  };

  const chargeActions = (c: CheckoutCharge) => (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {canApprove && (c.status === 'PENDING_APPROVAL' || c.status === 'DISPUTED') && (
        <>
          <Button size="small" color="success" onClick={() => void run(() => checkoutApi.decideCharge(c.id, 'approve'), `${c.reference} approved.`)}>Approve</Button>
          <Button size="small" onClick={() => askReason(`Waive ${c.reference}`, (r) => checkoutApi.decideCharge(c.id, 'waive', r))}>Waive</Button>
          <Button size="small" color="error" onClick={() => askReason(`Reject ${c.reference}`, (r) => checkoutApi.decideCharge(c.id, 'reject', r))}>Reject</Button>
        </>
      )}
      {c.status === 'POSTED' && (
        <Button size="small" color="warning" onClick={() => askReason(`Guest disputes ${c.reference}`, (r) => checkoutApi.decideCharge(c.id, 'dispute', r))}>Dispute</Button>
      )}
      {canApprove && c.status === 'POSTED' && (
        <Button size="small" color="error" onClick={() => askReason(`Reverse ${c.reference}`, (r) => checkoutApi.decideCharge(c.id, 'reverse', r))}>Reverse</Button>
      )}
    </Stack>
  );

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/business/reservations/checkout')} sx={{ mb: 1 }}>Check-out queue</Button>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800}>Check-out · {booking.guestName}</Typography>
            <Typography variant="body2" color="text.secondary">{booking.bookingNumber} · Room {booking.roomNumber ?? '—'}</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<PrintRoundedIcon />} onClick={() => printElement('checkout-bill', `Bill ${booking.bookingNumber}`)}>Print bill</Button>
            {!checkedOut && <Button variant="contained" onClick={() => setSettleOpen(true)}>Settle & check out</Button>}
          </Stack>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
        {review.blockers.length > 0 && !checkedOut && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Check-out is on hold: {review.blockers.join('; ')}.
          </Alert>
        )}

        <Stack spacing={2}>
          <Section letter="A" title="Guest and stay">
            <Grid container spacing={1}>
              <Grid item xs={12} md={4}><Typography variant="body2" color="text.secondary">Checked in</Typography><Typography>{fmt(booking.checkIn)}</Typography></Grid>
              <Grid item xs={12} md={4}><Typography variant="body2" color="text.secondary">Check-out due</Typography><Typography>{fmt(lateCheckout.standardDeadline)}</Typography></Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">Agreed late check-out</Typography>
                <Typography>{booking.lateCheckoutUntil ? fmt(booking.lateCheckoutUntil) : 'None'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Chip size="small" label={INSPECTION_LABEL[booking.inspectionStatus]} color={booking.inspectionStatus === 'COMPLETED' || booking.inspectionStatus === 'NOT_REQUIRED' ? 'success' : booking.inspectionStatus === 'ISSUES_FOUND' ? 'warning' : 'default'} />
                {review.policy.inspection === 'MANDATORY' && <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>Inspection is required before check-out.</Typography>}
              </Grid>
            </Grid>
          </Section>

          <Section letter="B" title="Bills already on the room">
            {(review.bill?.charges ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">Nothing besides the room so far.</Typography>
            ) : (
              <Table size="small">
                <TableBody>
                  {(review.bill?.charges ?? []).map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.description}{line.items ? <Typography variant="caption" color="text.secondary" display="block">{line.items}</Typography> : null}</TableCell>
                      <TableCell>{fmt(line.postedAt)}</TableCell>
                      <TableCell><Chip size="small" label={line.status === 'SETTLED' ? 'Paid' : 'Unpaid'} color={line.status === 'SETTLED' ? 'success' : 'warning'} /></TableCell>
                      <TableCell align="right">{formatCurrency(line.totalAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section
            letter="C"
            title="Late check-out and damage"
            action={!checkedOut && (
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={() => { setExtendUntil(''); setExtendOpen(true); }}>Agree late check-out</Button>
                <Button size="small" variant="outlined" onClick={() => { setLate({ actualTime: '', waiveAmount: '', reason: '' }); setLateOpen(true); }} disabled={lateCheckout.alreadyCharged}>Assess late check-out</Button>
                <Button size="small" variant="outlined" color="warning" onClick={() => setDamageOpen(true)}>Record property damage</Button>
              </Stack>
            )}
          >
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              {lateCheckout.alreadyCharged
                ? 'A late check-out fee is already on this stay.'
                : lateCheckout.amount > 0
                  ? `If the guest leaves now: ${lateCheckout.minutesLate} min late, fee ${formatCurrency(lateCheckout.amount)}${lateCheckout.capped ? ' (capped)' : ''}.`
                  : lateCheckout.minutesLate > 0
                    ? `${lateCheckout.minutesLate} min past the deadline — still within the grace period or no fee is set.`
                    : 'Not late.'}
            </Typography>
            {review.damages.length > 0 && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Damage</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Charge</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {review.damages.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>{d.itemDamaged}</Typography>
                        <Typography variant="caption" color="text.secondary">{d.reference} · {d.specificLocation || d.locationCategory} · {d.description}</Typography>
                        {d.disputeNote && <Typography variant="caption" color="error" display="block">Guest says: {d.disputeNote}</Typography>}
                      </TableCell>
                      <TableCell><Chip size="small" label={DAMAGE_STATUS_LABEL[d.status]} color={STATUS_COLOR[d.status]} /></TableCell>
                      <TableCell align="right">{d.recoveryCharge != null ? formatCurrency(d.recoveryCharge) : '—'}</TableCell>
                      <TableCell align="right">
                        <RowActionsMenu
                          subject={d.reference}
                          actions={[
                            {
                              key: 'assess',
                              label: 'Assess',
                              hidden: !['REPORTED', 'UNDER_ASSESSMENT', 'AWAITING_APPROVAL', 'DISPUTED'].includes(d.status),
                              onClick: () => { setAssessment({ assessmentMethod: d.assessmentMethod ?? 'REPAIR', assessedCost: d.assessedCost != null ? String(d.assessedCost) : '', recoveryCharge: d.recoveryCharge != null ? String(d.recoveryCharge) : '', assessment: d.assessment ?? '' }); setAssessing(d); }
                            },
                            { key: 'approve', label: 'Approve charge', hidden: !(canApprove && (d.status === 'AWAITING_APPROVAL' || d.status === 'DISPUTED')), onClick: () => void run(() => checkoutApi.decideDamage(d.id, 'approve'), `${d.reference} approved.`) },
                            { key: 'dispute', label: 'Guest disputes', hidden: !['REPORTED', 'UNDER_ASSESSMENT', 'AWAITING_APPROVAL'].includes(d.status), onClick: () => askReason(`Guest disputes ${d.reference}`, (r) => checkoutApi.decideDamage(d.id, 'dispute', r)) },
                            { key: 'waive', label: 'Waive', destructive: true, hidden: !(canApprove && !['APPROVED', 'WAIVED', 'CLOSED'].includes(d.status)), onClick: () => askReason(`Waive ${d.reference}`, (r) => checkoutApi.decideDamage(d.id, 'waive', r)) }
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section letter="D" title="Additional charges and minibar" action={!checkedOut && <Button size="small" variant="outlined" onClick={() => { setDuplicateWarning(''); setChargeOpen(true); }}>Add additional charge</Button>}>
            {review.charges.length === 0 && review.minibarCounts.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No additional charges.</Typography>
            ) : (
              <Table size="small">
                <TableBody>
                  {review.charges.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>{c.categoryLabel}</Typography>
                        <Typography variant="caption" color="text.secondary">{c.reference} · {c.description}{c.decisionReason ? ` · ${c.decisionReason}` : ''}</Typography>
                      </TableCell>
                      <TableCell><Chip size="small" label={CHARGE_STATUS_LABEL[c.status]} color={STATUS_COLOR[c.status]} /></TableCell>
                      <TableCell align="right">{formatCurrency(c.amount)}</TableCell>
                      <TableCell align="right">{chargeActions(c)}</TableCell>
                    </TableRow>
                  ))}
                  {review.minibarCounts.filter((m) => m.status === 'PENDING_REVIEW').map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>Minibar count</Typography>
                        <Typography variant="caption" color="text.secondary">{m.lines.filter((l) => l.consumed > 0).map((l) => `${l.consumed}× ${l.name} @ ${formatCurrency(l.price)}`).join(', ')}</Typography>
                      </TableCell>
                      <TableCell><Chip size="small" label="To charge" color="warning" /></TableCell>
                      <TableCell align="right">{formatCurrency(m.total)}</TableCell>
                      <TableCell align="right">
                        <Button size="small" color="success" onClick={() => void run(() => checkoutApi.decideMinibarCount(m.id, 'charge'), 'Minibar added to the bill.')}>Charge</Button>
                        <Button size="small" onClick={() => askReason('No charge for the minibar', (r) => checkoutApi.decideMinibarCount(m.id, 'no-charge', r))}>No charge</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section letter="E" title="Final bill">
            <Box id="checkout-bill">
              <Typography fontWeight={800} sx={{ mb: 1 }}>{booking.guestName} · {booking.bookingNumber} · Room {booking.roomNumber ?? '—'}</Typography>
              <Stack spacing={0.5} sx={{ maxWidth: 420 }}>
                <Row label="Accommodation" value={summary.accommodation} />
                <Row label="Outlet and service bills" value={summary.outletBills} />
                {summary.lateCheckout > 0 && <Row label="Late check-out fee" value={summary.lateCheckout} />}
                {summary.damage > 0 && <Row label="Damage recovery" value={summary.damage} />}
                {summary.additional > 0 && <Row label="Additional charges" value={summary.additional} />}
                <Divider />
                <Row label="Total charges" value={summary.totalCharges} strong />
                <Row label="Payments received" value={summary.paid} negative />
                <Divider />
                {summary.refundDue > 0 ? <Row label="Refund due to guest" value={summary.refundDue} strong /> : <Row label="Outstanding balance" value={summary.balance} strong />}
              </Stack>
            </Box>
            {summary.refundDue > 0 && canApprove && (
              <Button size="small" variant="outlined" sx={{ mt: 1.5 }} onClick={() => { setRefund({ amount: String(summary.refundDue), method: 'TRANSFER', reason: '' }); setRefundOpen(true); }}>Refund the guest</Button>
            )}
          </Section>
        </Stack>

        {/* F: settle and check out — the existing settlement step. */}
        <CheckoutSettlementDialog
          reservationId={settleOpen ? booking.id : null}
          onClose={() => { setSettleOpen(false); void load(); }}
          onCheckedOut={() => { setSettleOpen(false); navigate('/business/reservations/checkout'); }}
        />

        <DamageReportDialog open={damageOpen} bookingId={booking.id} roomId={booking.roomId} roomNumber={booking.roomNumber} onClose={() => setDamageOpen(false)}
          onReported={(refNo) => { setDamageOpen(false); setNotice(`Damage ${refNo} recorded. A manager assesses and approves any charge.`); void load(); }} />

        <Dialog open={chargeOpen} onClose={() => !busy && setChargeOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontWeight: 800 }}>Add additional charge</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {duplicateWarning && <Grid item xs={12}><Alert severity="warning">{duplicateWarning}</Alert></Grid>}
              <Grid item xs={12}>
                <TextField select fullWidth size="small" label="Category" value={charge.category} onChange={(e) => setCharge({ ...charge, category: e.target.value as ChargeCategory })}>
                  {ADDABLE_CATEGORIES.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12}><TextField fullWidth size="small" label="Description" value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} required /></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" label="Where" value={charge.serviceLocation} onChange={(e) => setCharge({ ...charge, serviceLocation: e.target.value })} /></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" type="date" label="Service date" InputLabelProps={{ shrink: true }} value={charge.serviceDate} onChange={(e) => setCharge({ ...charge, serviceDate: e.target.value })} /></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" type="number" label="Quantity" value={charge.quantity} onChange={(e) => setCharge({ ...charge, quantity: e.target.value })} /></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" type="number" label="Unit price (₦)" value={charge.unitPrice} onChange={(e) => setCharge({ ...charge, unitPrice: e.target.value })} required /></Grid>
              <Grid item xs={12}><TextField fullWidth size="small" label="Receipt / order / ticket number" value={charge.supportingRef} onChange={(e) => setCharge({ ...charge, supportingRef: e.target.value })} helperText="Used to stop the same bill being added twice" /></Grid>
              <Grid item xs={12}><TextField fullWidth size="small" label="Remarks" value={charge.remarks} onChange={(e) => setCharge({ ...charge, remarks: e.target.value })} /></Grid>
              <Grid item xs={12}>
                <Typography variant="body2" fontWeight={700}>Total: {formatCurrency((Number(charge.quantity) || 0) * (Number(charge.unitPrice) || 0))}</Typography>
                <Typography variant="caption" color="text.secondary">Charges over {formatCurrency(review.policy.approvalThreshold)} wait for a manager.</Typography>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setChargeOpen(false)} disabled={busy}>Cancel</Button>
            {duplicateWarning ? (
              <Button variant="contained" color="warning" onClick={() => void addCharge(true)} disabled={busy}>It is a different charge — add it</Button>
            ) : (
              <Button variant="contained" onClick={() => void addCharge()} disabled={busy || charge.description.trim().length < 3 || !(Number(charge.unitPrice) > 0)}>Add charge</Button>
            )}
          </DialogActions>
        </Dialog>

        <Dialog open={lateOpen} onClose={() => !busy && setLateOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Assess late check-out</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Deadline {fmt(lateCheckout.deadline)}{lateCheckout.extended ? ' (agreed late check-out)' : ''}; grace {review.policy.graceMinutes} min.
              </Typography>
              <TextField type="datetime-local" label="Left at (blank = now)" InputLabelProps={{ shrink: true }} value={late.actualTime} onChange={(e) => setLate({ ...late, actualTime: e.target.value })} />
              <TextField type="number" label="Waive (₦, optional)" value={late.waiveAmount} onChange={(e) => setLate({ ...late, waiveAmount: e.target.value })} />
              {Number(late.waiveAmount) > 0 && <TextField label="Reason for waiver" value={late.reason} onChange={(e) => setLate({ ...late, reason: e.target.value })} />}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLateOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="contained" disabled={busy} onClick={() => void run(async () => {
              const result = await checkoutApi.assessLate(booking.id, {
                ...(late.actualTime ? { actualTime: new Date(late.actualTime).toISOString() } : {}),
                ...(Number(late.waiveAmount) > 0 ? { waiveAmount: Number(late.waiveAmount), reason: late.reason } : {})
              });
              setLateOpen(false);
              if (!result.charged) setNotice(result.waived ? 'Late fee waived.' : 'No late fee is due.');
            })}>Charge fee</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={extendOpen} onClose={() => !busy && setExtendOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Agree a late check-out</DialogTitle>
          <DialogContent>
            <TextField type="datetime-local" fullWidth label="Guest may stay until" InputLabelProps={{ shrink: true }} value={extendUntil} onChange={(e) => setExtendUntil(e.target.value)} sx={{ mt: 1 }} />
            <Typography variant="caption" color="text.secondary">No fee is charged up to this time.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExtendOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="contained" disabled={busy || !extendUntil} onClick={() => void run(async () => { await checkoutApi.extend(booking.id, new Date(extendUntil).toISOString()); setExtendOpen(false); }, 'Late check-out agreed.')}>Save</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(assessing)} onClose={() => !busy && setAssessing(null)} fullWidth maxWidth="sm">
          <DialogTitle>Assess {assessing?.itemDamaged}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={6}>
                <TextField select fullWidth size="small" label="Method" value={assessment.assessmentMethod} onChange={(e) => setAssessment({ ...assessment, assessmentMethod: e.target.value })}>
                  <MenuItem value="REPAIR">Repair cost</MenuItem>
                  <MenuItem value="REPLACEMENT">Replacement cost</MenuItem>
                  <MenuItem value="FIXED_RATE">Fixed damage rate</MenuItem>
                  <MenuItem value="MANUAL">Manual assessment</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Cost (₦)" value={assessment.assessedCost} onChange={(e) => setAssessment({ ...assessment, assessedCost: e.target.value })} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Charge guest (₦)" value={assessment.recoveryCharge} onChange={(e) => setAssessment({ ...assessment, recoveryCharge: e.target.value })} /></Grid>
              <Grid item xs={12}><TextField fullWidth size="small" label="Assessment" multiline minRows={2} value={assessment.assessment} onChange={(e) => setAssessment({ ...assessment, assessment: e.target.value })} helperText="The extent of the damage and how the amount was reached." /></Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAssessing(null)} disabled={busy}>Cancel</Button>
            <Button variant="contained" disabled={busy || assessment.assessment.trim().length < 3} onClick={() => void run(async () => {
              await checkoutApi.assessDamage(assessing!.id, { assessmentMethod: assessment.assessmentMethod, assessedCost: Number(assessment.assessedCost) || 0, recoveryCharge: Number(assessment.recoveryCharge) || 0, assessment: assessment.assessment.trim() });
              setAssessing(null);
            }, 'Assessment saved — waiting for a manager to approve the charge.')}>Save assessment</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(reasonFor)} onClose={() => !busy && setReasonFor(null)} fullWidth maxWidth="xs">
          <DialogTitle>{reasonFor?.title}</DialogTitle>
          <DialogContent>
            <TextField autoFocus fullWidth multiline minRows={2} label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} sx={{ mt: 1 }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReasonFor(null)} disabled={busy}>Cancel</Button>
            <Button variant="contained" disabled={busy || reason.trim().length < 3} onClick={() => void run(async () => { await reasonFor!.run(reason.trim()); setReasonFor(null); }, 'Saved.')}>Save</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={refundOpen} onClose={() => !busy && setRefundOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Refund the guest</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField type="number" label="Amount (₦)" value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value })} />
              <TextField select label="Method" value={refund.method} onChange={(e) => setRefund({ ...refund, method: e.target.value })}>
                {['CASH', 'TRANSFER', 'CARD', 'POS'].map((m) => <MenuItem key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</MenuItem>)}
              </TextField>
              <TextField label="Reason" value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRefundOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="contained" disabled={busy || refund.reason.trim().length < 3} onClick={() => void run(async () => { await checkoutApi.refund(booking.id, { amount: Number(refund.amount), method: refund.method, reason: refund.reason.trim() }); setRefundOpen(false); }, 'Refund recorded.')}>Refund</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default CheckoutReviewPage;
