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
  IconButton,
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
  Tooltip,
  Typography
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import SearchIcon from '@mui/icons-material/Search';
import PeopleIcon from '@mui/icons-material/People';
import {
  formatNaira,
  hrService,
  STAFF_STATUS_COLOR,
  type StaffMember,
  type StaffStatus
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
const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'CASUAL'];
const SALARY_TYPES = ['MONTHLY', 'WEEKLY', 'HOURLY'];

type FormState = Partial<StaffMember> & { clockPin?: string };

const emptyForm: FormState = {
  firstName: '',
  lastName: '',
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
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(member)} aria-label={`Edit ${member.firstName}`}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Terminate">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={member.status === 'TERMINATED'}
                          onClick={() => setPendingTerminate(member)}
                          aria-label={`Terminate ${member.firstName}`}
                        >
                          <PersonOffIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
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
              onChange={(v) => setField('department', v)}
            />
            <SelectField
              label="Employment type"
              value={form.employmentType || 'FULL_TIME'}
              options={EMPLOYMENT_TYPES}
              onChange={(v) => setField('employmentType', v)}
            />
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
