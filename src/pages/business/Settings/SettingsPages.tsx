import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  AutorenewRounded,
  BadgeRounded,
  CheckCircleRounded,
  ContentCopyRounded,
  KeyRounded,
  PersonAddAlt1Rounded,
  UploadFileRounded
} from '@mui/icons-material';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/common/DataTable';
import {
  AuditRecord,
  SettingRoleRecord,
  SettingUserRecord,
  auditOpsService,
  settingsOpsService
} from '../../../services/operations';
import { maskUserCode, markUserCodeCopied, isUserCodeCopied } from '../../../utils/userCode';
import { apiClient } from '../../../api/client';
import { useAuthStore } from '../../../store/authStore';

export const BusinessProfileSettingsPage = () => {
  const { user, setUser } = useAuthStore();
  const profile = settingsOpsService.getBusinessProfile();

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone || '');
  const [address, setAddress] = useState(profile.address || '');
  const [timezone, setTimezone] = useState(profile.timezone);
  const [currency, setCurrency] = useState(profile.currency);
  const [logoPreview, setLogoPreview] = useState<string | null>(user?.logoUrl || null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      // Always save local profile fields
      settingsOpsService.updateBusinessProfile({ name, email, phone, address, timezone, currency });

      // If there's a logo or businessName change, hit the real API
      if (logoFile || name) {
        const formData = new FormData();
        formData.append('businessName', name);
        if (logoFile) formData.append('logo', logoFile);
        const { data } = await apiClient.put('/settings/branding', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setUser({ hotelName: data.businessName || data.name, logoUrl: data.logoUrl });
      }
      setSaveSuccess(true);
    } catch (err: any) {
      setSaveError(err?.response?.data?.error || err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Business Profile</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Core property settings. The logo and business name appear on the sidebar and all dashboards.
        </Typography>

        <Paper sx={{ p: 3 }}>
          <Box component="form" onSubmit={save}>
            <Stack spacing={2.5}>
              {saveError && <Alert severity="error" onClose={() => setSaveError(null)}>{saveError}</Alert>}
              {saveSuccess && <Alert severity="success" onClose={() => setSaveSuccess(false)}>Saved successfully</Alert>}

              {/* Logo upload */}
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  component="img"
                  src={logoPreview || '/logo.png'}
                  alt="Business logo"
                  sx={{ width: 72, height: 72, borderRadius: 2, objectFit: 'contain', border: '1px solid', borderColor: 'divider', p: 0.5 }}
                />
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">Company Logo</Typography>
                  <Typography variant="caption" color="text.secondary">PNG, JPG or WebP · max 5 MB</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<UploadFileRounded />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {logoPreview ? 'Change logo' : 'Upload logo'}
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleLogoChange} />
                </Stack>
              </Stack>

              <TextField label="Business Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} multiline minRows={2} />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} fullWidth />
                <TextField label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} fullWidth />
              </Stack>
              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? 'Saving…' : 'Save Profile'}
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Layout>
  );
};

export const UsersSettingsPage = () => {
  const theme = useTheme();
  const [rows, setRows] = useState<SettingUserRecord[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('TempPass123!');
  const [role, setRole] = useState('RECEPTION');
  const [autoAssignCode, setAutoAssignCode] = useState(true);
  const [issuedCode, setIssuedCode] = useState<{ user: SettingUserRecord; userCode: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = async () => setRows(await settingsOpsService.listUsers());

  useEffect(() => {
    void reload();
  }, []);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('TempPass123!');
    setRole('RECEPTION');
    setAutoAssignCode(true);
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await settingsOpsService.createUser({ firstName, lastName, email, role, password });
      let userCode: string | null = created.userCode || null;
      if (autoAssignCode && !userCode) {
        const issued = await settingsOpsService.assignUserCode(created.id);
        userCode = issued.userCode;
      }
      setCreateOpen(false);
      resetForm();
      await reload();
      if (userCode) {
        setIssuedCode({ user: { ...created, userCode }, userCode });
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to create user');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (userId: string) => {
    await settingsOpsService.toggleUserActive(userId);
    await reload();
  };

  const rotateCode = async (user: SettingUserRecord) => {
    if (
      user.userCode &&
      !window.confirm(`Rotate ${user.name}'s usercode? They will be signed out and need to use the new code.`)
    ) {
      return;
    }
    const issued = await settingsOpsService.assignUserCode(user.id);
    await reload();
    setIssuedCode({ user: { ...user, userCode: issued.userCode }, userCode: issued.userCode });
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.isActive).length;
    const withCode = rows.filter((r) => !!r.userCode).length;
    return { active, inactive: rows.length - active, withCode };
  }, [rows]);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4, overflowX: 'hidden' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" mb={3}>
          <Box>
            <Typography variant="caption">Staff & access</Typography>
            <Typography variant="h2" sx={{ fontFamily: '"Cormorant Garamond", serif' }}>
              Users
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 540, mt: 0.5 }}>
              Manage staff accounts, role assignment, and usercodes used for quick POS / front-desk login.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} mt={{ xs: 2, sm: 0 }}>
            <IconButton onClick={reload} title="Refresh">
              <AutorenewRounded />
            </IconButton>
            <Button
              variant="contained"
              startIcon={<PersonAddAlt1Rounded />}
              onClick={() => {
                resetForm();
                setCreateOpen(true);
              }}
            >
              New user
            </Button>
          </Stack>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
          {[
            { label: 'Active staff', value: stats.active, color: theme.palette.success.main },
            { label: 'Disabled', value: stats.inactive, color: theme.palette.text.secondary },
            { label: 'Have usercode', value: stats.withCode, color: theme.palette.secondary.dark }
          ].map((tile) => (
            <Paper
              key={tile.label}
              sx={{
                p: 2.2,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}
            >
              <Box sx={{ width: 6, alignSelf: 'stretch', borderRadius: 99, bgcolor: tile.color }} />
              <Box>
                <Typography variant="caption">{tile.label}</Typography>
                <Typography variant="h4" sx={{ fontFamily: '"Cormorant Garamond", serif' }}>
                  {tile.value}
                </Typography>
              </Box>
            </Paper>
          ))}
        </Box>

        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          defaultRowsPerPage={10}
          emptyText="No staff users found."
          columns={[
            {
              key: 'name',
              label: 'Name',
              minWidth: 220,
              render: (row) => (
                <Stack direction="row" spacing={1.4} alignItems="center">
                  <Avatar sx={{ width: 36, height: 36, bgcolor: alpha(theme.palette.secondary.main, 0.18), color: theme.palette.secondary.dark, fontSize: 14, fontWeight: 700 }}>
                    {(row.name || '?').slice(0, 1).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {row.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.email}
                    </Typography>
                  </Box>
                </Stack>
              )
            },
            {
              key: 'role',
              label: 'Role',
              minWidth: 150,
              render: (row) => <Chip size="small" label={row.role.replace(/_/g, ' ')} variant="outlined" />
            },
            {
              key: 'userCode',
              label: 'Usercode',
              minWidth: 160,
              render: (row) =>
                row.userCode ? (
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Chip
                      size="small"
                      icon={<BadgeRounded fontSize="small" />}
                      label={isUserCodeCopied(row.id) ? maskUserCode(row.userCode) : maskUserCode(row.userCode)}
                      className="mono"
                      sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}
                    />
                    <Tooltip title={copied ? 'Copied!' : 'Copy full code (shown once)'}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          void copyCode(row.userCode!);
                          markUserCodeCopied(row.id);
                        }}
                      >
                        <ContentCopyRounded fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Not assigned
                  </Typography>
                )
            },
            {
              key: 'status',
              label: 'Status',
              minWidth: 110,
              render: (row) => (
                <Chip
                  size="small"
                  label={row.isActive ? 'Active' : 'Disabled'}
                  color={row.isActive ? 'success' : 'default'}
                />
              )
            },
            {
              key: 'action',
              label: 'Actions',
              minWidth: 260,
              render: (row) => (
                <Stack direction="row" spacing={1}>
                  <Tooltip title={row.userCode ? 'Rotate usercode' : 'Issue usercode'}>
                    <Button
                      size="small"
                      variant={row.userCode ? 'text' : 'outlined'}
                      startIcon={<KeyRounded fontSize="small" />}
                      onClick={() => void rotateCode(row)}
                    >
                      {row.userCode ? 'Rotate' : 'Issue code'}
                    </Button>
                  </Tooltip>
                  <Button size="small" onClick={() => void toggle(row.id)}>
                    {row.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </Stack>
              )
            }
          ]}
        />

        {/* Create user dialog */}
        <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>New staff user</DialogTitle>
          <DialogContent>
            <Box component="form" id="users-create-form" onSubmit={submitCreate}>
              <Stack spacing={2} pt={1}>
                {error && (
                  <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField fullWidth label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoFocus />
                  <TextField fullWidth label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </Stack>
                <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <TextField fullWidth label="Temporary password" value={password} onChange={(e) => setPassword(e.target.value)} required helperText="Staff can change this after first login." />
                <TextField select fullWidth label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
                  <MenuItem value="RECEPTION">Receptionist</MenuItem>
                  <MenuItem value="POS_STAFF">POS staff</MenuItem>
                  <MenuItem value="HOUSEKEEPING">Housekeeping</MenuItem>
                  <MenuItem value="MANAGER">Manager</MenuItem>
                  <MenuItem value="MANAGER_RECEPTION">Manager — Reception</MenuItem>
                  <MenuItem value="MANAGER_POS">Manager — POS</MenuItem>
                  <MenuItem value="MANAGER_HOUSEKEEPING">Manager — Housekeeping</MenuItem>
                  <MenuItem value="MANAGER_ACCOUNTING">Manager — Accounting</MenuItem>
                  <MenuItem value="ACCOUNTANT">Accountant</MenuItem>
                </TextField>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.secondary.main, 0.08),
                    border: `1px solid ${alpha(theme.palette.secondary.main, 0.18)}`
                  }}
                >
                  <Switch checked={autoAssignCode} onChange={(e) => setAutoAssignCode(e.target.checked)} />
                  <Box>
                    <Typography fontWeight={600}>Auto-assign 5–6 digit usercode</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Lets the user log in to the POS with just a numeric code.
                    </Typography>
                  </Box>
                </Stack>
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="contained" type="submit" form="users-create-form" disabled={busy}>
              Create user
            </Button>
          </DialogActions>
        </Dialog>

        {/* Issued usercode reveal */}
        <Dialog open={!!issuedCode} onClose={() => setIssuedCode(null)} fullWidth maxWidth="xs">
          <DialogTitle>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CheckCircleRounded sx={{ color: theme.palette.success.main }} />
              <span>Usercode issued</span>
            </Stack>
          </DialogTitle>
          <DialogContent sx={{ textAlign: 'center', pb: 1 }}>
            {issuedCode && (
              <>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Share this code securely with <b>{issuedCode.user.name}</b>. It is shown only once.
                </Typography>
                <Typography
                  variant="h1"
                  sx={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 56,
                    letterSpacing: '0.18em',
                    color: theme.palette.primary.main,
                    py: 3,
                    borderRadius: 3,
                    background: alpha(theme.palette.secondary.main, 0.1),
                    border: `1px dashed ${alpha(theme.palette.secondary.main, 0.4)}`,
                    mb: 2
                  }}
                >
                  {issuedCode.userCode}
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<ContentCopyRounded />}
                  onClick={() => void copyCode(issuedCode.userCode)}
                >
                  {copied ? 'Copied' : 'Copy to clipboard'}
                </Button>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIssuedCode(null)} variant="contained">
              Done
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export const RolesSettingsPage = () => {
  const [rows, setRows] = useState<SettingRoleRecord[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const selectedRole = useMemo(() => rows.find((row) => row.id === selectedRoleId) || null, [rows, selectedRoleId]);
  const [permissionsInput, setPermissionsInput] = useState((selectedRole?.permissions || []).join(', '));

  useEffect(() => {
    const load = async () => {
      const loaded = await settingsOpsService.listRoles();
      setRows(loaded);
      if (!selectedRoleId && loaded[0]) {
        setSelectedRoleId(loaded[0].id);
      }
    };

    void load();
  }, [selectedRoleId]);

  useEffect(() => {
    setPermissionsInput((selectedRole?.permissions || []).join(', '));
  }, [selectedRole?.id]);

  const save = async () => {
    if (!selectedRole) {
      return;
    }

    const permissions = permissionsInput
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    settingsOpsService.updateRole(selectedRole.id, permissions);
    const updated = await settingsOpsService.listRoles();
    setRows(updated);
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Roles & Permissions</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure module permissions for predefined business roles.
        </Typography>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <TextField
              select
              label="Role"
              value={selectedRoleId}
              onChange={(event) => setSelectedRoleId(event.target.value)}
            >
              {rows.map((role) => (
                <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Permissions (comma separated)"
              value={permissionsInput}
              onChange={(event) => setPermissionsInput(event.target.value)}
              multiline
              minRows={4}
            />

            <Button variant="contained" onClick={() => void save()}>Save Permissions</Button>
          </Stack>
        </Paper>
      </Container>
    </Layout>
  );
};

export const TaxSettingsPage = () => {
  const settings = settingsOpsService.getTaxSettings();
  const [vatRate, setVatRate] = useState(settings.vatRate);
  const [rentRate, setRentRate] = useState(settings.whtRates.rent || 5);
  const [consultancyRate, setConsultancyRate] = useState(settings.whtRates.consultancy || 10);
  const [contractRate, setContractRate] = useState(settings.whtRates.contracts || 5);
  const [dividendRate, setDividendRate] = useState(settings.whtRates.dividends || 10);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    settingsOpsService.updateTaxSettings({
      vatRate,
      whtRates: {
        rent: rentRate,
        consultancy: consultancyRate,
        contracts: contractRate,
        dividends: dividendRate
      }
    });
  };

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Tax Settings</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          VAT and WHT configuration for Nigerian tax compliance.
        </Typography>

        <Paper sx={{ p: 3 }}>
          <Box component="form" onSubmit={save}>
            <Stack spacing={2}>
              <TextField label="VAT Rate (%)" type="number" value={vatRate} onChange={(event) => setVatRate(Number(event.target.value))} />
              <TextField label="WHT Rent (%)" type="number" value={rentRate} onChange={(event) => setRentRate(Number(event.target.value))} />
              <TextField label="WHT Consultancy (%)" type="number" value={consultancyRate} onChange={(event) => setConsultancyRate(Number(event.target.value))} />
              <TextField label="WHT Contracts (%)" type="number" value={contractRate} onChange={(event) => setContractRate(Number(event.target.value))} />
              <TextField label="WHT Dividends (%)" type="number" value={dividendRate} onChange={(event) => setDividendRate(Number(event.target.value))} />
              <Button type="submit" variant="contained">Save Tax Settings</Button>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Layout>
  );
};

export const PaymentGatewaysSettingsPage = () => {
  const [gateways, setGateways] = useState(settingsOpsService.getPaymentGateways());

  const updateGateway = (
    gateway: keyof typeof gateways,
    field: string,
    value: string | boolean
  ) => {
    const updated = settingsOpsService.updatePaymentGateway(gateway, {
      [field]: value
    });
    setGateways(updated);
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Payment Gateways</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Manage Paystack, Flutterwave and Interswitch credentials.
        </Typography>

        <Stack spacing={2}>
          {(['paystack', 'flutterwave', 'interswitch'] as const).map((gateway) => (
            <Paper key={gateway} sx={{ p: 3 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} spacing={2}>
                <Typography variant="h6" sx={{ textTransform: 'capitalize', minWidth: 160 }}>{gateway}</Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2">Enabled</Typography>
                  <Switch
                    checked={gateways[gateway].enabled}
                    onChange={(event) => updateGateway(gateway, 'enabled', event.target.checked)}
                  />
                </Stack>

                {'publicKey' in gateways[gateway] && (
                  <TextField
                    label="Public Key"
                    value={(gateways[gateway] as { publicKey: string }).publicKey}
                    onChange={(event) => updateGateway(gateway, 'publicKey', event.target.value)}
                    fullWidth
                  />
                )}

                {'secretKey' in gateways[gateway] && (
                  <TextField
                    label="Secret Key"
                    value={(gateways[gateway] as { secretKey: string }).secretKey}
                    onChange={(event) => updateGateway(gateway, 'secretKey', event.target.value)}
                    fullWidth
                  />
                )}

                {'merchantCode' in gateways[gateway] && (
                  <TextField
                    label="Merchant Code"
                    value={(gateways[gateway] as { merchantCode: string }).merchantCode}
                    onChange={(event) => updateGateway(gateway, 'merchantCode', event.target.value)}
                    fullWidth
                  />
                )}

                {'terminalId' in gateways[gateway] && (
                  <TextField
                    label="Terminal ID"
                    value={(gateways[gateway] as { terminalId: string }).terminalId}
                    onChange={(event) => updateGateway(gateway, 'terminalId', event.target.value)}
                    fullWidth
                  />
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Container>
    </Layout>
  );
};

export const BackupRestoreSettingsPage = () => {
  const [rows, setRows] = useState(settingsOpsService.listBackups());
  const [notes, setNotes] = useState('');

  const createBackup = () => {
    settingsOpsService.createBackup(notes.trim() || undefined);
    setRows(settingsOpsService.listBackups());
    setNotes('');
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Backup & Restore</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Create snapshot records and track restore points.
        </Typography>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField label="Backup Notes" value={notes} onChange={(event) => setNotes(event.target.value)} fullWidth />
            <Button variant="contained" onClick={createBackup}>Create Backup</Button>
          </Stack>
        </Paper>

        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          defaultRowsPerPage={10}
          emptyText="No backups created yet."
          columns={[
            { key: 'id', label: 'Backup ID', minWidth: 220 },
            {
              key: 'createdAt',
              label: 'Created At',
              minWidth: 190,
              render: (row) => new Date(row.createdAt).toLocaleString()
            },
            { key: 'createdBy', label: 'Created By', minWidth: 190 },
            {
              key: 'notes',
              label: 'Notes',
              minWidth: 240,
              render: (row) => row.notes || '—'
            },
            {
              key: 'action',
              label: 'Action',
              minWidth: 120,
              render: (row) => (
                <Button size="small" onClick={() => window.alert(`Restore flow for backup ${row.id} is queued.`)}>Restore</Button>
              )
            }
          ]}
        />
      </Container>
    </Layout>
  );
};

export const BusinessAuditTrailPage = () => {
  const [rows, setRows] = useState<AuditRecord[]>([]);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');

  useEffect(() => {
    const load = async () => setRows(await auditOpsService.list());
    void load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (actionFilter !== 'ALL' && row.action !== actionFilter) {
        return false;
      }
      if (entityFilter !== 'ALL' && row.entity !== entityFilter) {
        return false;
      }
      return true;
    });
  }, [rows, actionFilter, entityFilter]);

  const actionValues = Array.from(new Set(rows.map((row) => row.action)));
  const entityValues = Array.from(new Set(rows.map((row) => row.entity)));

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4, overflowX: 'hidden' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Business Audit Trail</Typography>
            <Typography variant="body2" color="text.secondary">Digital footprint of operational updates from PMS/POS/Settings workflows.</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField select size="small" label="Action" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} sx={{ minWidth: { sm: 170 } }} fullWidth>
              <MenuItem value="ALL">All</MenuItem>
              {actionValues.map((entry) => (
                <MenuItem key={entry} value={entry}>{entry}</MenuItem>
              ))}
            </TextField>
            <TextField select size="small" label="Entity" value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)} sx={{ minWidth: { sm: 170 } }} fullWidth>
              <MenuItem value="ALL">All</MenuItem>
              {entityValues.map((entry) => (
                <MenuItem key={entry} value={entry}>{entry}</MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" onClick={() => void auditOpsService.list().then(setRows)}>Refresh</Button>
          </Stack>
        </Stack>

        <DataTable
          rows={filtered}
          rowKey={(row) => row.id}
          defaultRowsPerPage={25}
          emptyText="No audit records for selected filters."
          columns={[
            {
              key: 'timestamp',
              label: 'Timestamp',
              minWidth: 190,
              render: (row) => new Date(row.timestamp).toLocaleString()
            },
            { key: 'action', label: 'Action', minWidth: 130 },
            { key: 'entity', label: 'Entity', minWidth: 130 },
            { key: 'entityId', label: 'Entity ID', minWidth: 190 },
            {
              key: 'details',
              label: 'Details',
              minWidth: 280,
              render: (row) => (
                <Typography variant="caption" component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(row.details, null, 2)}
                </Typography>
              )
            }
          ]}
        />
      </Container>
    </Layout>
  );
};
