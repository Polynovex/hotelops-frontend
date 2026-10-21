import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import Layout from '../../../components/Layout';
import { usePermissionStore } from '../../../store/permissionStore';
import {
  CHARGE_STATUS_LABEL,
  DAMAGE_STATUS_LABEL,
  checkoutApi,
  type CheckoutCharge,
  type CheckoutPolicy,
  type DamageIncident,
  type DamageStatus
} from '../../../services/checkout';
import { formatCurrency } from '../../../utils/formatters';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * Check-out approvals for managers: charges waiting for a decision, the
 * hotel-wide damage register, and the check-out policy (late fee, approval
 * limit, inspection).
 */
const CheckoutApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const can = usePermissionStore((state) => state.can);
  const canApprove = can('APPROVE_CHECKOUT_CHARGES');
  const [tab, setTab] = useState<'charges' | 'damage' | 'policy'>('charges');
  const [charges, setCharges] = useState<CheckoutCharge[]>([]);
  const [damages, setDamages] = useState<DamageIncident[]>([]);
  const [damageFilter, setDamageFilter] = useState<DamageStatus | ''>('');
  const [policy, setPolicy] = useState<CheckoutPolicy | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reasonFor, setReasonFor] = useState<{ title: string; run: (reason: string) => Promise<unknown> } | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const [pending, disputed, damageList, pol] = await Promise.all([
        checkoutApi.listCharges('PENDING_APPROVAL'),
        checkoutApi.listCharges('DISPUTED'),
        checkoutApi.listDamages(damageFilter ? { status: damageFilter } : {}),
        checkoutApi.policy()
      ]);
      setCharges([...pending, ...disputed]);
      setDamages(damageList);
      setPolicy(pol);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load approvals'));
    }
  }, [damageFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(done);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'That did not work'));
    }
  };

  const askReason = (title: string, run: (r: string) => Promise<unknown>) => {
    setReason('');
    setReasonFor({ title, run });
  };

  const setP = <K extends keyof CheckoutPolicy>(k: K, v: CheckoutPolicy[K]) => setPolicy((p) => (p ? { ...p, [k]: v } : p));

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h4" fontWeight={800}>Check-out approvals</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Charges and damage waiting for a decision, and the hotel's check-out rules.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="charges" label={`Waiting (${charges.length})`} />
          <Tab value="damage" label="Damage register" />
          <Tab value="policy" label="Check-out policy" />
        </Tabs>

        {tab === 'charges' && (
          <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Charge</TableCell><TableCell>Guest</TableCell><TableCell align="right">Amount</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {charges.length === 0 ? (
                  <TableRow><TableCell colSpan={5} sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>Nothing is waiting.</TableCell></TableRow>
                ) : charges.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>{c.categoryLabel}</Typography>
                      <Typography variant="caption" color="text.secondary">{c.reference} · {c.description}{c.decisionReason ? ` · ${c.decisionReason}` : ''}</Typography>
                    </TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => navigate(`/business/reservations/${c.bookingId}/checkout`)}>{c.guestName} · {c.roomNumber ?? '—'}</Button>
                    </TableCell>
                    <TableCell align="right">{formatCurrency(c.amount)}</TableCell>
                    <TableCell><Chip size="small" label={CHARGE_STATUS_LABEL[c.status]} color={c.status === 'DISPUTED' ? 'error' : 'warning'} /></TableCell>
                    <TableCell>
                      {canApprove && (
                        <Stack direction="row" spacing={0.5}>
                          <Button size="small" color="success" onClick={() => void act(() => checkoutApi.decideCharge(c.id, 'approve'), `${c.reference} approved.`)}>Approve</Button>
                          <Button size="small" onClick={() => askReason(`Waive ${c.reference}`, (r) => checkoutApi.decideCharge(c.id, 'waive', r))}>Waive</Button>
                          <Button size="small" color="error" onClick={() => askReason(`Reject ${c.reference}`, (r) => checkoutApi.decideCharge(c.id, 'reject', r))}>Reject</Button>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}

        {tab === 'damage' && (
          <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
            <Stack sx={{ p: 2 }}>
              <TextField select size="small" label="Status" value={damageFilter} onChange={(e) => setDamageFilter(e.target.value as DamageStatus | '')} sx={{ maxWidth: 240 }}>
                <MenuItem value="">All</MenuItem>
                {(Object.keys(DAMAGE_STATUS_LABEL) as DamageStatus[]).map((s) => <MenuItem key={s} value={s}>{DAMAGE_STATUS_LABEL[s]}</MenuItem>)}
              </TextField>
            </Stack>
            <Table size="small">
              <TableHead><TableRow><TableCell>Damage</TableCell><TableCell>Where</TableCell><TableCell>Guest</TableCell><TableCell align="right">Charge</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {damages.length === 0 ? (
                  <TableRow><TableCell colSpan={6} sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>No damage reports.</TableCell></TableRow>
                ) : damages.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>{d.itemDamaged}</Typography>
                      <Typography variant="caption" color="text.secondary">{d.reference} · {d.description}{d.reportedByName ? ` · by ${d.reportedByName}` : ''}</Typography>
                    </TableCell>
                    <TableCell>{d.specificLocation || d.locationCategory}</TableCell>
                    <TableCell>{d.guestName || '—'}</TableCell>
                    <TableCell align="right">{d.recoveryCharge != null ? formatCurrency(d.recoveryCharge) : '—'}</TableCell>
                    <TableCell><Chip size="small" label={DAMAGE_STATUS_LABEL[d.status]} color={d.status === 'APPROVED' ? 'success' : d.status === 'DISPUTED' ? 'error' : ['WAIVED', 'CLOSED'].includes(d.status) ? 'default' : 'warning'} /></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        {d.bookingId && <Button size="small" onClick={() => navigate(`/business/reservations/${d.bookingId}/checkout`)}>Open stay</Button>}
                        {canApprove && (d.status === 'AWAITING_APPROVAL' || d.status === 'DISPUTED') && (
                          <Button size="small" color="success" onClick={() => void act(() => checkoutApi.decideDamage(d.id, 'approve'), `${d.reference} approved.`)}>Approve</Button>
                        )}
                        {canApprove && !d.bookingId && !['WAIVED', 'CLOSED'].includes(d.status) && (
                          <Button size="small" onClick={() => askReason(`Close ${d.reference}`, (r) => checkoutApi.decideDamage(d.id, 'close', r))}>Close</Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}

        {tab === 'policy' && policy && (
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}><TextField fullWidth size="small" type="time" label="Check-out time" InputLabelProps={{ shrink: true }} value={policy.standardTime} onChange={(e) => setP('standardTime', e.target.value)} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Grace period (min)" value={policy.graceMinutes} onChange={(e) => setP('graceMinutes', Number(e.target.value))} /></Grid>
              <Grid item xs={12} md={6}>
                <TextField select fullWidth size="small" label="Late check-out fee" value={policy.method} onChange={(e) => setP('method', e.target.value as CheckoutPolicy['method'])}>
                  <MenuItem value="NONE">No fee</MenuItem>
                  <MenuItem value="FIXED">Fixed fee</MenuItem>
                  <MenuItem value="HOURLY">Hourly rate</MenuItem>
                  <MenuItem value="HALF_DAY">Half a night's rate</MenuItem>
                  <MenuItem value="FULL_DAY">A full night's rate</MenuItem>
                </TextField>
              </Grid>
              {(policy.method === 'FIXED' || policy.method === 'HOURLY') && (
                <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label={policy.method === 'HOURLY' ? 'Rate per hour (₦)' : 'Fee (₦)'} value={policy.rate} onChange={(e) => setP('rate', Number(e.target.value))} /></Grid>
              )}
              {policy.method === 'HOURLY' && (
                <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Charge in blocks of (min)" value={policy.incrementMinutes} onChange={(e) => setP('incrementMinutes', Number(e.target.value))} /></Grid>
              )}
              <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Most it can be (₦, optional)" value={policy.maxCharge ?? ''} onChange={(e) => setP('maxCharge', e.target.value === '' ? null : Number(e.target.value))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Approval needed above (₦)" value={policy.approvalThreshold} onChange={(e) => setP('approvalThreshold', Number(e.target.value))} /></Grid>
              <Grid item xs={12} md={6}>
                <TextField select fullWidth size="small" label="Room inspection before check-out" value={policy.inspection} onChange={(e) => setP('inspection', e.target.value as CheckoutPolicy['inspection'])}>
                  <MenuItem value="OFF">Not used</MenuItem>
                  <MenuItem value="ADVISORY">Advised (does not hold check-out)</MenuItem>
                  <MenuItem value="MANDATORY">Required (holds check-out)</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  An agreed late check-out is never charged. The fee is never a full extra night unless you choose it here.
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" disabled={!canApprove} onClick={() => void act(() => checkoutApi.savePolicy(policy), 'Check-out policy saved.')}>Save policy</Button>
              </Grid>
            </Grid>
          </Paper>
        )}

        <Dialog open={Boolean(reasonFor)} onClose={() => setReasonFor(null)} fullWidth maxWidth="xs">
          <DialogTitle>{reasonFor?.title}</DialogTitle>
          <DialogContent>
            <TextField autoFocus fullWidth multiline minRows={2} label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} sx={{ mt: 1 }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReasonFor(null)}>Cancel</Button>
            <Button variant="contained" disabled={reason.trim().length < 3} onClick={() => void act(async () => { await reasonFor!.run(reason.trim()); setReasonFor(null); }, 'Saved.')}>Save</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default CheckoutApprovalsPage;
