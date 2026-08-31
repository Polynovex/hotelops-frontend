import HrTabs from './HrTabs';
import Layout from '../../../components/Layout';
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
  DialogTitle,
  Grid,
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
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import SearchIcon from '@mui/icons-material/Search';
import PeopleIcon from '@mui/icons-material/People';
import KeyIcon from '@mui/icons-material/VpnKey';
import KeyOffIcon from '@mui/icons-material/NoEncryptionGmailerrorred';
import RowActionsMenu from '../../../components/common/RowActionsMenu';
import {
  formatNaira,
  hrService,
  STAFF_STATUS_COLOR,
  type StaffMember,
  type StaffStatus,
  defaultAccessLevelFor,
  NON_OPERATIONAL_DEPARTMENTS,
  type StaffAccessLevel
} from '../../../services/hr.service';

/**
 * Departments across a full hospitality operation, with the job titles each
 * typically employs. Titles are suggestions on a free-text field — a hotel may
 * use its own wording, so nothing is rejected for being off-list.
 */
const JOB_TITLES_BY_DEPARTMENT: Record<string, string[]> = {
  FRONT_DESK: ['Front Desk Agent', 'Receptionist', 'Front Office Manager', 'Night Auditor', 'Reservations Officer', 'Guest Relations Officer'],
  CONCIERGE: ['Concierge', 'Bell Attendant', 'Porter', 'Doorman', 'Airport Liaison'],
  HOUSEKEEPING: ['Housekeeper', 'Room Attendant', 'Housekeeping Supervisor', 'Executive Housekeeper', 'Public Area Cleaner', 'Linen Room Attendant'],
  LAUNDRY: ['Laundry Attendant', 'Dry Cleaner', 'Presser', 'Laundry Supervisor', 'Washer', 'Tailor / Seamstress'],
  FOOD_BEVERAGE: ['Waiter / Waitress', 'Bartender', 'Barista', 'Restaurant Supervisor', 'F&B Manager', 'Room Service Attendant', 'Banquet Server', 'Sommelier'],
  KITCHEN: ['Executive Chef', 'Sous Chef', 'Chef de Partie', 'Line Cook', 'Pastry Chef', 'Kitchen Assistant', 'Steward / Dishwasher', 'Butcher'],
  POS: ['POS Cashier', 'Till Operator', 'POS Supervisor'],
  SECURITY: ['Security Officer', 'Security Guard', 'Head of Security', 'CCTV Operator', 'Gate Officer', 'Night Security'],
  MAINTENANCE: ['Maintenance Technician', 'Electrician', 'Plumber', 'HVAC Technician', 'Chief Engineer', 'Generator Operator', 'Handyman', 'Painter'],
  GROUNDS: ['Gardener', 'Landscaper', 'Pool Attendant', 'Grounds Supervisor', 'Cleaner (External)'],
  SPA_WELLNESS: ['Spa Therapist', 'Masseur / Masseuse', 'Beautician', 'Hair Stylist', 'Gym Instructor', 'Spa Manager'],
  TRANSPORT: ['Driver', 'Chauffeur', 'Shuttle Driver', 'Fleet Supervisor', 'Dispatch Rider'],
  EVENTS: ['Events Coordinator', 'Banquet Manager', 'AV Technician', 'Decorator'],
  FINANCE: ['Accountant', 'Account Officer', 'Cashier', 'Auditor', 'Finance Manager', 'Store Accountant', 'Payroll Officer'],
  HR: ['HR Officer', 'HR Manager', 'Training Officer', 'Recruitment Officer'],
  INVENTORY: ['Store Keeper', 'Storeman', 'Procurement Officer', 'Inventory Supervisor', 'Receiving Clerk'],
  SALES_MARKETING: ['Sales Executive', 'Marketing Officer', 'Business Development Manager', 'Social Media Officer', 'Revenue Manager'],
  IT: ['IT Support Officer', 'Systems Administrator', 'Network Technician'],
  MANAGEMENT: ['General Manager', 'Deputy General Manager', 'Operations Manager', 'Duty Manager', 'Managing Director']
};

const DEPARTMENTS = Object.keys(JOB_TITLES_BY_DEPARTMENT);

const humanise = (value: string) =>
  value.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
const ACCESS_LABEL: Record<string, string> = {
  NONE: 'No login',
  SELF_SERVICE: 'HR self-service',
  OPERATIONAL: 'Full access'
};

const ACCESS_COLOR: Record<string, 'default' | 'info' | 'success'> = {
  NONE: 'default',
  SELF_SERVICE: 'info',
  OPERATIONAL: 'success'
};

const ACCESS_HELP: Record<StaffAccessLevel, string> = {
  NONE: 'No account is created. HR manages their record on their behalf.',
  SELF_SERVICE:
    'Signs in only to the HR portal: their own payslips, attendance, and leave. No access to reservations, POS, finance, or audits.',
  OPERATIONAL:
    'Full role-based access to the modules their department works in.'
};

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'CASUAL'];
const SALARY_TYPES = ['MONTHLY', 'WEEKLY', 'HOURLY'];

type FormState = Partial<StaffMember> & { clockPin?: string };

const emptyForm: FormState = {
  firstName: '',
  lastName: '',
  accessLevel: 'NONE',
  employmentType: 'FULL_TIME',
  salaryType: 'MONTHLY',
  status: 'ACTIVE',
  baseSalary: 0,
  allowance: 0
};

const StaffManagement = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StaffStatus | ''>('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pendingTerminate, setPendingTerminate] = useState<StaffMember | null>(null);
  const [pendingAccess, setPendingAccess] = useState<StaffMember | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<StaffMember | null>(null);
  const [accessLevel, setAccessLevel] = useState<StaffAccessLevel>('SELF_SERVICE');
  const [accessEmail, setAccessEmail] = useState('');
  const [accessSaving, setAccessSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await hrService.listStaff({
        search: search.trim() || undefined,
        status: statusFilter || undefined
      });
      setStaff(rows);
      setError('');
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string; message?: string } } }).response;
      setError(
        response?.data?.error === 'FEATURE_DISABLED'
          ? 'The HR module is not included in your current plan.'
          : response?.data?.message || 'Failed to load staff'
      );
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (member: StaffMember) => {
    setEditing(member);
    setForm({ ...member });
    setDialogOpen(true);
  };

  const setField = (key: keyof FormState, value: unknown) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    if (!form.firstName?.trim() || !form.lastName?.trim()) {
      setError('First and last name are required');
      return;
    }

    setSaving(true);
    try {
      // Strip empty strings so optional fields are omitted rather than rejected.
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, value]) => value !== '' && value !== null && value !== undefined)
      ) as FormState;

      if (editing) {
        // Access changes go through the explicit grant/revoke actions so they
        // are always deliberate and audited. Never let an ordinary detail edit
        // silently re-assert them.
        delete payload.accessLevel;
        delete payload.userId;
        await hrService.updateStaff(editing.id, payload);
        setToast('Staff record updated');
      } else {
        await hrService.createStaff(payload);
        setToast('Staff member added');
      }

      setDialogOpen(false);
      await load();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string; error?: string; issues?: Array<{ message: string }> } } }).response;
      setError(response?.data?.issues?.[0]?.message || response?.data?.error || 'Failed to save staff record');
    } finally {
      setSaving(false);
    }
  };

  /** Opens the access dialog pre-filled with the department's default. */
  const openAccessDialog = (member: StaffMember) => {
    setAccessLevel(defaultAccessLevelFor(member.department) === 'OPERATIONAL'
      ? 'OPERATIONAL'
      : 'SELF_SERVICE');
    setAccessEmail(member.email ?? '');
    setPendingAccess(member);
  };

  const handleGrantAccess = async () => {
    if (!pendingAccess) {
      return;
    }

    setAccessSaving(true);
    try {
      await hrService.grantAccount(pendingAccess.id, {
        accessLevel,
        email: accessEmail.trim() || undefined
      });
      setToast(
        `Login created for ${pendingAccess.firstName}. Their sign-in details have been emailed to them.`
      );
      setPendingAccess(null);
      await load();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })
        .response?.data?.error;
      setError(message || 'Failed to create the login');
    } finally {
      setAccessSaving(false);
    }
  };

  const handleRevokeAccess = async () => {
    if (!pendingRevoke) {
      return;
    }

    try {
      await hrService.revokeAccount(pendingRevoke.id);
      setToast(`${pendingRevoke.firstName} can no longer sign in`);
      await load();
    } catch {
      setError('Failed to revoke access');
    } finally {
      setPendingRevoke(null);
    }
  };

  const handleTerminate = async () => {
    if (!pendingTerminate) {
      return;
    }

    try {
      await hrService.terminateStaff(pendingTerminate.id);
      setToast(`${pendingTerminate.firstName} ${pendingTerminate.lastName} marked terminated`);
      await load();
    } catch {
      setError('Failed to terminate staff member');
    } finally {
      setPendingTerminate(null);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <HrTabs />
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Staff
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Employee records, salaries, and bank details.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Add Staff
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          placeholder="Search by name, email, or staff number"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          size="small"
          sx={{ flexGrow: 1, maxWidth: 420 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <TextField
          select
          size="small"
          label="Status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StaffStatus | '')}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All</MenuItem>
          {(['ACTIVE', 'ON_LEAVE', 'INACTIVE', 'TERMINATED'] as const).map((value) => (
            <MenuItem key={value} value={value}>
              {value.replace('_', ' ')}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Staff no.</TableCell>
              <TableCell>Job title</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Base salary</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Platform access</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            )}

            {!loading && staff.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                  <PeopleIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    No staff found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {search || statusFilter
                      ? 'Try clearing your filters.'
                      : 'Add your first employee to get started.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              staff.map((member) => (
                <TableRow key={member.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {member.firstName} {member.lastName}
                    </Typography>
                    {member.email && (
                      <Typography variant="caption" color="text.secondary">
                        {member.email}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{member.staffNumber || '—'}</TableCell>
                  <TableCell>{member.jobTitle || '—'}</TableCell>
                  <TableCell>{member.department ? humanise(member.department) : '—'}</TableCell>
                  <TableCell>{member.employmentType.replace('_', ' ')}</TableCell>
                  <TableCell align="right">
                    {member.salaryType === 'HOURLY'
                      ? `${formatNaira(member.hourlyRate || 0)}/hr`
                      : formatNaira(member.baseSalary)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={member.status.replace('_', ' ')}
                      color={STAFF_STATUS_COLOR[member.status]}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant={member.accessLevel === 'NONE' ? 'outlined' : 'filled'}
                      label={ACCESS_LABEL[member.accessLevel] ?? 'No login'}
                      color={ACCESS_COLOR[member.accessLevel] ?? 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <RowActionsMenu
                      subject={`${member.firstName} ${member.lastName}`}
                      actions={[
                        {
                          key: 'edit',
                          label: 'Edit details',
                          icon: <EditIcon fontSize="small" />,
                          onClick: () => openEdit(member)
                        },
                        {
                          key: 'grant',
                          label: 'Give platform access',
                          icon: <KeyIcon fontSize="small" />,
                          hidden: member.accessLevel !== 'NONE',
                          disabled: member.status === 'TERMINATED',
                          disabledReason: 'Terminated staff cannot be given a login',
                          onClick: () => openAccessDialog(member)
                        },
                        {
                          key: 'revoke',
                          label: 'Revoke platform access',
                          icon: <KeyOffIcon fontSize="small" />,
                          hidden: member.accessLevel === 'NONE',
                          destructive: true,
                          onClick: () => setPendingRevoke(member)
                        },
                        {
                          key: 'terminate',
                          label: 'Terminate',
                          icon: <PersonOffIcon fontSize="small" />,
                          destructive: true,
                          disabled: member.status === 'TERMINATED',
                          disabledReason: 'Already terminated',
                          onClick: () => setPendingTerminate(member)
                        }
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? 'Edit staff member' : 'Add staff member'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Field label="First name" required value={form.firstName} onChange={(v) => setField('firstName', v)} />
            <Field label="Last name" required value={form.lastName} onChange={(v) => setField('lastName', v)} />
            <Field label="Staff number" value={form.staffNumber} onChange={(v) => setField('staffNumber', v)} />
            <Grid item xs={12} sm={6}>
              <Autocomplete
                freeSolo
                options={form.department ? JOB_TITLES_BY_DEPARTMENT[form.department] ?? [] : []}
                value={form.jobTitle ?? ''}
                onInputChange={(_e, value) => setField('jobTitle', value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Job title"
                    size="small"
                    helperText={
                      form.department
                        ? 'Pick a suggestion or type your own'
                        : 'Choose a department to see suggested titles'
                    }
                  />
                )}
              />
            </Grid>
            <Field label="Email" type="email" value={form.email} onChange={(v) => setField('email', v)} />
            <Field label="Phone" value={form.phone} onChange={(v) => setField('phone', v)} />

            <SelectField
              label="Department"
              value={form.department || ''}
              options={DEPARTMENTS}
              onChange={(v) => {
                setField('department', v);
                // Propose the access level the department implies. Still fully
                // overridable below — this only sets the starting point.
                if (!editing) {
                  setField('accessLevel', defaultAccessLevelFor(v));
                }
              }}
            />
            <SelectField
              label="Employment type"
              value={form.employmentType || 'FULL_TIME'}
              options={EMPLOYMENT_TYPES}
              onChange={(v) => setField('employmentType', v)}
            />
            {!editing && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Platform access"
                    value={form.accessLevel || 'NONE'}
                    onChange={(e) => setField('accessLevel', e.target.value)}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="NONE">No login</MenuItem>
                    <MenuItem value="SELF_SERVICE">HR self-service only</MenuItem>
                    <MenuItem value="OPERATIONAL">Full access for their department</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <Alert
                    severity={form.accessLevel === 'OPERATIONAL' ? 'warning' : 'info'}
                    sx={{ py: 0.5 }}
                  >
                    {ACCESS_HELP[(form.accessLevel as StaffAccessLevel) || 'NONE']}
                    {form.accessLevel !== 'NONE' && !form.email && (
                      <strong> An email address is required to create a login.</strong>
                    )}
                  </Alert>
                </Grid>
              </>
            )}
            <SelectField
              label="Salary type"
              value={form.salaryType || 'MONTHLY'}
              options={SALARY_TYPES}
              onChange={(v) => setField('salaryType', v)}
            />
            <SelectField
              label="Status"
              value={form.status || 'ACTIVE'}
              options={['ACTIVE', 'ON_LEAVE', 'INACTIVE', 'TERMINATED']}
              onChange={(v) => setField('status', v)}
            />

            {form.salaryType === 'HOURLY' ? (
              <>
                <Field
                  label="Hourly rate (NGN)"
                  type="number"
                  value={form.hourlyRate ?? ''}
                  onChange={(v) => setField('hourlyRate', Number(v))}
                />
                <Field
                  label="Overtime rate (NGN)"
                  type="number"
                  helperText="Defaults to 1.5x hourly if left blank"
                  value={form.overtimeRate ?? ''}
                  onChange={(v) => setField('overtimeRate', Number(v))}
                />
              </>
            ) : (
              <Field
                label={`Base salary per ${form.salaryType === 'WEEKLY' ? 'week' : 'month'} (NGN)`}
                type="number"
                value={form.baseSalary ?? 0}
                onChange={(v) => setField('baseSalary', Number(v))}
              />
            )}
            <Field
              label="Allowance (NGN)"
              type="number"
              value={form.allowance ?? 0}
              onChange={(v) => setField('allowance', Number(v))}
            />

            <Field label="Bank name" value={form.bankName} onChange={(v) => setField('bankName', v)} />
            <Field label="Account number" value={form.accountNumber} onChange={(v) => setField('accountNumber', v)} />
            <Field label="Tax ID (TIN)" value={form.taxId} onChange={(v) => setField('taxId', v)} />
            <Field
              label="Clock-in PIN"
              type="password"
              helperText={editing ? 'Leave blank to keep the current PIN' : '4-8 digits, used for clock in/out'}
              value={form.clockPin || ''}
              onChange={(v) => setField('clockPin', v)}
            />
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add staff'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(pendingAccess)}
        onClose={() => setPendingAccess(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Give {pendingAccess?.firstName} {pendingAccess?.lastName} platform access
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              label="Work email"
              type="email"
              fullWidth
              required
              value={accessEmail}
              onChange={(e) => setAccessEmail(e.target.value)}
              helperText="Their sign-in details are sent here. They must set a new password on first login."
            />

            <TextField
              select
              label="Level of access"
              fullWidth
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value as StaffAccessLevel)}
            >
              <MenuItem value="SELF_SERVICE">HR self-service only</MenuItem>
              <MenuItem value="OPERATIONAL">Full access for their department</MenuItem>
            </TextField>

            <Alert severity={accessLevel === 'OPERATIONAL' ? 'warning' : 'info'}>
              {ACCESS_HELP[accessLevel]}
            </Alert>

            {pendingAccess?.department
              && NON_OPERATIONAL_DEPARTMENTS.includes(pendingAccess.department)
              && accessLevel === 'OPERATIONAL' && (
              <Alert severity="error">
                {humanise(pendingAccess.department)} staff do not normally operate the
                platform. Granting full access lets them into the modules their
                department works in.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPendingAccess(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={accessSaving || !accessEmail.trim()}
            onClick={() => void handleGrantAccess()}
          >
            {accessSaving ? 'Creating…' : 'Create login'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(pendingRevoke)} onClose={() => setPendingRevoke(null)}>
        <DialogTitle>Revoke platform access?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            <strong>
              {pendingRevoke?.firstName} {pendingRevoke?.lastName}
            </strong>{' '}
            will no longer be able to sign in. They stay on the HR roster, and their
            payroll, attendance, and audit history is kept.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPendingRevoke(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void handleRevokeAccess()}>
            Revoke access
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(pendingTerminate)} onClose={() => setPendingTerminate(null)}>
        <DialogTitle>Terminate staff member?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            <strong>
              {pendingTerminate?.firstName} {pendingTerminate?.lastName}
            </strong>{' '}
            will be marked terminated. Their payroll and attendance history is kept.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPendingTerminate(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void handleTerminate()}>
            Terminate
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
  );
};

const Field = ({
  label,
  value,
  onChange,
  type = 'text',
  required,
  helperText
}: {
  label: string;
  value: unknown;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  helperText?: string;
}) => (
  <Grid item xs={12} sm={6}>
    <TextField
      label={label}
      type={type}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      fullWidth
      size="small"
      required={required}
      helperText={helperText}
    />
  </Grid>
);

const SelectField = ({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) => (
  <Grid item xs={12} sm={6}>
    <TextField
      select
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      fullWidth
      size="small"
    >
      <MenuItem value="">—</MenuItem>
      {options.map((option) => (
        <MenuItem key={option} value={option}>
          {humanise(option)}
        </MenuItem>
      ))}
    </TextField>
  </Grid>
);

/**
 * Wrapped in Layout so this page carries the same sidebar, header, and
 * page chrome as the rest of the dashboard. Wrapping at the export keeps
 * the loading and error early-returns inside the shell too.
 */
const StaffManagementWithLayout = () => (
  <Layout>
    <StaffManagement />
  </Layout>
);

export default StaffManagementWithLayout;
