import React, { useCallback, useEffect, useState } from 'react';
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
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import Layout from '../../../components/Layout';
import { usePermissionStore } from '../../../store/permissionStore';
import { useAuthStore } from '../../../store/authStore';
import { formatNaira, hrService, type StaffHistoryEntry, type StaffProfile } from '../../../services/hr.service';
import { getApiErrorMessage } from '../../../utils/apiError';
import { JOB_TITLES_BY_DEPARTMENT } from './StaffManagement';

/**
 * A page for every staff member: their record, employment history
 * (promotions, transfers, pay changes), the last 30 days of attendance,
 * upcoming shifts, leave and payslips.
 */

const humanise = (value?: string | null) =>
  value ? value.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ') : '—';
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—');

const HISTORY_LABEL: Record<StaffHistoryEntry['type'], string> = {
  HIRED: 'Joined',
  PROMOTION: 'Promoted',
  TRANSFER: 'Transferred',
  SALARY_CHANGE: 'Pay changed',
  TITLE_CHANGE: 'Title changed',
  TERMINATED: 'Left',
  REINSTATED: 'Reinstated'
};
const HISTORY_COLOR: Record<StaffHistoryEntry['type'], 'success' | 'info' | 'warning' | 'error' | 'default' | 'primary'> = {
  HIRED: 'primary',
  PROMOTION: 'success',
  TRANSFER: 'info',
  SALARY_CHANGE: 'info',
  TITLE_CHANGE: 'info',
  TERMINATED: 'error',
  REINSTATED: 'warning'
};

const Info: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <Stack direction="row" spacing={2} sx={{ py: 0.5 }}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>{label}</Typography>
    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{value || '—'}</Typography>
  </Stack>
);

const Card: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
      <Typography fontWeight={800}>{title}</Typography>
      {action}
    </Stack>
    {children}
  </Paper>
);

const StaffProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = usePermissionStore((state) => state.can);
  const canEdit = can('EDIT_STAFF');
  const canPay = can('VIEW_PAYROLL');
  const role = useAuthStore((state) => state.user?.role);
  const canUnlock = role === 'BUSINESS_ADMIN' || role === 'MANAGER';
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlock, setUnlock] = useState({ minutes: '60', reason: '' });
  const [unlockNote, setUnlockNote] = useState('');

  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [error, setError] = useState('');
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [form, setForm] = useState({ jobTitle: '', department: '', pay: '', effectiveDate: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setProfile(await hrService.getStaffProfile(id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load this staff member'));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPromote = () => {
    if (!profile) return;
    const s = profile.staff;
    setForm({
      jobTitle: s.jobTitle ?? '',
      department: s.department ?? '',
      pay: String(s.salaryType === 'HOURLY' ? s.hourlyRate ?? 0 : s.baseSalary ?? 0),
      effectiveDate: new Date().toISOString().slice(0, 10),
      reason: ''
    });
    setFormError('');
    setPromoteOpen(true);
  };

  const savePromotion = async () => {
    if (!profile || !id) return;
    if (form.reason.trim().length < 3) {
      setFormError('Give a reason for the change.');
      return;
    }
    const s = profile.staff;
    const hourly = s.salaryType === 'HOURLY';
    setSaving(true);
    setFormError('');
    try {
      await hrService.promoteStaff(id, {
        ...(form.jobTitle !== (s.jobTitle ?? '') ? { jobTitle: form.jobTitle } : {}),
        ...(form.department !== (s.department ?? '') ? { department: form.department } : {}),
        ...(Number(form.pay) !== (hourly ? s.hourlyRate ?? 0 : s.baseSalary ?? 0) ? (hourly ? { hourlyRate: Number(form.pay) } : { baseSalary: Number(form.pay) }) : {}),
        effectiveDate: form.effectiveDate ? new Date(`${form.effectiveDate}T09:00`).toISOString() : undefined,
        reason: form.reason.trim()
      });
      setPromoteOpen(false);
      await load();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Could not save the change'));
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <Layout>
        <Container maxWidth="lg" sx={{ py: 3 }}>
          {error ? <Alert severity="error">{error}</Alert> : <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}><CircularProgress /></Box>}
        </Container>
      </Layout>
    );
  }

  const { staff, account, history, attendance, leave, payslips, upcomingShifts } = profile;
  const terminated = staff.status === 'TERMINATED';
  const titles = JOB_TITLES_BY_DEPARTMENT[form.department] ?? [];

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/business/hr/staff')} sx={{ mb: 1 }}>All staff</Button>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h4" fontWeight={800}>{staff.firstName} {staff.lastName}</Typography>
              <Chip size="small" label={humanise(staff.status)} color={terminated ? 'error' : staff.status === 'ACTIVE' ? 'success' : 'warning'} />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {staff.jobTitle || 'No title'} · {humanise(staff.department)}{staff.staffNumber ? ` · ${staff.staffNumber}` : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            {canUnlock && account && !terminated && (
              <Button variant="outlined" onClick={() => { setUnlock({ minutes: '60', reason: '' }); setUnlockOpen(true); }}>Unlock account</Button>
            )}
            {canEdit && !terminated && (
              <Button variant="contained" startIcon={<TrendingUpRoundedIcon />} onClick={openPromote}>Promote / change position</Button>
            )}
          </Stack>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {unlockNote && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setUnlockNote('')}>{unlockNote}</Alert>}

        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <Card title="Details">
              <Info label="Email" value={staff.email} />
              <Info label="Phone" value={staff.phone} />
              <Info label="Address" value={staff.address} />
              <Info label="Emergency contact" value={[staff.emergencyContact, staff.emergencyPhone].filter(Boolean).join(' · ')} />
              <Info label="Date of birth" value={fmtDate(staff.dateOfBirth)} />
              <Info label="Started" value={fmtDate(staff.hireDate ?? staff.createdAt)} />
              <Info label="Employment" value={humanise(staff.employmentType)} />
              <Info label="Platform access" value={account ? `${account.email} · ${humanise(account.role)}${account.isActive ? '' : ' (disabled)'}` : 'No login'} />
              {canPay && (
                <>
                  <Info label="Pay" value={staff.salaryType === 'HOURLY' ? `${formatNaira(staff.hourlyRate || 0)} per hour` : `${formatNaira(staff.baseSalary)} per month`} />
                  <Info label="Allowance" value={formatNaira(staff.allowance)} />
                  <Info label="Overtime rate" value={staff.overtimeRate ? `${formatNaira(staff.overtimeRate)} per hour` : 'Hotel matrix'} />
                  <Info label="Bank" value={[staff.bankName, staff.accountNumber].filter(Boolean).join(' · ')} />
                </>
              )}
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card title="Employment history">
              {history.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No changes recorded yet.</Typography>
              ) : (
                <Stack spacing={1.25}>
                  {history.map((h) => (
                    <Box key={h.id} sx={{ pl: 1.5, borderLeft: '3px solid', borderColor: 'divider' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label={HISTORY_LABEL[h.type]} color={HISTORY_COLOR[h.type]} />
                        <Typography variant="caption" color="text.secondary">
                          {fmtDate(h.effectiveDate)} → {h.endedAt ? fmtDate(h.endedAt) : 'present'}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {h.toTitle || '—'} · {humanise(h.toDepartment)}
                        {canPay && h.toSalary != null ? ` · ${formatNaira(h.toSalary)}${h.salaryType === 'HOURLY' ? '/hr' : '/month'}` : ''}
                      </Typography>
                      {(h.fromTitle || h.fromDepartment) && h.type !== 'HIRED' && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Was {h.fromTitle || '—'} · {humanise(h.fromDepartment)}{canPay && h.fromSalary != null ? ` · ${formatNaira(h.fromSalary)}` : ''}
                        </Typography>
                      )}
                      {h.reason && <Typography variant="caption" color="text.secondary" display="block">“{h.reason}”</Typography>}
                      {h.recordedByName && <Typography variant="caption" color="text.secondary" display="block">By {h.recordedByName}</Typography>}
                    </Box>
                  ))}
                </Stack>
              )}
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card title="Attendance — last 30 days" action={<Button size="small" onClick={() => navigate('/business/hr/attendance')}>Attendance</Button>}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                <Chip size="small" color="success" label={`${attendance.present} on time / present`} />
                <Chip size="small" color="error" label={`${attendance.late} late`} />
                <Chip size="small" color="warning" label={`${attendance.onLeave} on leave`} />
                <Chip size="small" color="info" label={`${attendance.overtimeHours} h overtime`} />
                <Chip size="small" label={`${attendance.hours} h worked`} />
              </Stack>
              {attendance.recent.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No attendance in the last 30 days.</Typography>
              ) : (
                attendance.recent.map((a) => (
                  <Stack key={a.id} direction="row" justifyContent="space-between" sx={{ py: 0.4 }}>
                    <Typography variant="body2">{fmtDate(a.date)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {fmtTime(a.clockIn)} – {fmtTime(a.clockOut)}{a.lateMinutes > 0 ? ` · ${a.lateMinutes} min late` : ''}
                    </Typography>
                  </Stack>
                ))
              )}
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card title="Upcoming shifts" action={<Button size="small" onClick={() => navigate('/business/hr/rota')}>Rota</Button>}>
              {upcomingShifts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No shifts scheduled.</Typography>
              ) : (
                upcomingShifts.map((sh) => (
                  <Stack key={sh.id} direction="row" justifyContent="space-between" sx={{ py: 0.4 }}>
                    <Typography variant="body2">{fmtDate(sh.date)}</Typography>
                    <Typography variant="body2" color="text.secondary">{fmtTime(sh.startsAt)} – {fmtTime(sh.endsAt)}{sh.position ? ` · ${sh.position}` : ''}</Typography>
                  </Stack>
                ))
              )}
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card title="Leave">
              {leave.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No leave requests.</Typography>
              ) : (
                leave.map((l) => (
                  <Stack key={l.id} direction="row" justifyContent="space-between" sx={{ py: 0.4 }}>
                    <Typography variant="body2">{humanise(l.leaveType ?? l.type)} · {fmtDate(l.startDate)} – {fmtDate(l.endDate)}</Typography>
                    <Typography variant="caption" color="text.secondary">{humanise(l.status)}</Typography>
                  </Stack>
                ))
              )}
            </Card>
          </Grid>

          {canPay && (
            <Grid item xs={12} md={6}>
              <Card title="Recent payslips" action={<Button size="small" onClick={() => navigate('/business/hr/payroll')}>Payroll</Button>}>
                {payslips.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No payroll yet.</Typography>
                ) : (
                  payslips.map((p) => (
                    <Stack key={p.id} direction="row" justifyContent="space-between" sx={{ py: 0.4 }}>
                      <Typography variant="body2">{fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}</Typography>
                      <Typography variant="body2" fontWeight={600}>{formatNaira(p.netPay)} <Typography component="span" variant="caption" color="text.secondary">· {humanise(p.status)}</Typography></Typography>
                    </Stack>
                  ))
                )}
              </Card>
            </Grid>
          )}
        </Grid>

        <Dialog open={promoteOpen} onClose={() => !saving && setPromoteOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontWeight: 800 }}>Promote or change position</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {formError && <Grid item xs={12}><Alert severity="error">{formError}</Alert></Grid>}
              <Grid item xs={12} md={6}>
                <TextField select fullWidth size="small" label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  {Object.keys(JOB_TITLES_BY_DEPARTMENT).map((d) => <MenuItem key={d} value={d}>{humanise(d)}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Job title" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                  inputProps={{ list: 'promote-titles' }} />
                <datalist id="promote-titles">{titles.map((t) => <option key={t} value={t} />)}</datalist>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" type="number" label={staff.salaryType === 'HOURLY' ? 'Hourly rate (NGN)' : 'Monthly salary (NGN)'} value={form.pay} onChange={(e) => setForm({ ...form, pay: e.target.value })} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" type="date" label="Effective from" InputLabelProps={{ shrink: true }} value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} multiline minRows={2} required />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  The previous position is closed on this date and kept in the history, together with who made the change.
                </Typography>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPromoteOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="contained" onClick={() => void savePromotion()} disabled={saving}>Save</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={unlockOpen} onClose={() => setUnlockOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Unlock {staff.firstName}&apos;s account</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField select label="For" value={unlock.minutes} onChange={(e) => setUnlock({ ...unlock, minutes: e.target.value })}>
                {[['30', '30 minutes'], ['60', '1 hour'], ['120', '2 hours'], ['240', '4 hours'], ['480', '8 hours']].map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </TextField>
              <TextField label="Reason" value={unlock.reason} onChange={(e) => setUnlock({ ...unlock, reason: e.target.value })} />
              <Typography variant="caption" color="text.secondary">Lets them in outside their shift. Recorded in the audit trail; not counted as paid time.</Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUnlockOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={unlock.reason.trim().length < 3} onClick={async () => {
              try {
                const result = await hrService.grantAccess(staff.id, Number(unlock.minutes), unlock.reason.trim());
                setUnlockOpen(false);
                setUnlockNote(`Unlocked until ${new Date(result.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
              } catch (err) {
                setError(getApiErrorMessage(err, 'Could not unlock the account'));
                setUnlockOpen(false);
              }
            }}>Unlock</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default StaffProfilePage;
