import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
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
  Grid,
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
  PersonRemoveRounded,
  AlternateEmailRounded,
  PersonAddAlt1Rounded
} from '@mui/icons-material';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/common/DataTable';
import {
  SettingRoleRecord,
  SettingUserRecord,
  settingsOpsService
} from '../../../services/operations';
import { maskUserCode, markUserCodeCopied, isUserCodeCopied } from '../../../utils/userCode';
import { apiClient } from '../../../api/client';
import { useAuthStore } from '../../../store/authStore';
import { useSnackbar } from 'notistack';
import RowActionsMenu from '../../../components/common/RowActionsMenu';
import { getApiErrorMessage } from '../../../utils/apiError';
import { SettingsTabs } from './SettingsTabs';
import { PasswordConfirmDialog } from '../../../components/common/PasswordConfirmDialog';
import { AuditTrailViewer } from '../../../components/audit/AuditTrailViewer';

/**
 * Logos are stored as PNG (at most 512px) whatever was picked, so the same
 * file can sit in the middle of the business's QR codes and on receipts.
 */
const logoAsPng = async (file: File): Promise<File> => {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(512 / bitmap.width, 512 / bitmap.height, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(Math.round(bitmap.width * scale), 1);
    canvas.height = Math.max(Math.round(bitmap.height * scale), 1);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' }) : file;
  } catch {
    return file;
  }
};

export const BusinessProfileSettingsPage = () => {
  const { setUser } = useAuthStore();
  const profile = settingsOpsService.getBusinessProfile();

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone || '');
  const [address, setAddress] = useState(profile.address || '');
  const [timezone, setTimezone] = useState(profile.timezone);
  const [currency, setCurrency] = useState(profile.currency);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const currentUser = useAuthStore((state) => state.user);
  const [logoUrl, setLogoUrl] = useState<string | null>(currentUser?.logoUrl ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(currentUser?.brandColors?.primary ?? '');
  const [accentColor, setAccentColor] = useState(currentUser?.brandColors?.accent ?? '');
  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : removeLogo ? null : logoUrl), [logoFile, removeLogo, logoUrl]);
  /** Printed on invoices, receipts and quotations. */
  const [invoice, setInvoice] = useState({ website: '', tagline: '', contactEmail: '', bankName: '', accountName: '', accountNumber: '', signatoryName: '', signatoryTitle: '' });
  const [logoNote, setLogoNote] = useState('');

  useEffect(() => {
    apiClient
      .get('/settings/branding')
      .then(({ data }) => {
        setLogoUrl(data.logoUrl ?? null);
        setPrimaryColor(data.colors?.primary ?? '');
        setAccentColor(data.colors?.accent ?? '');
        // Saved on the server now; the browser copy was only a stand-in.
        if (data.businessName || data.name) setName(data.businessName || data.name);
        if (data.phone != null) setPhone(data.phone);
        if (data.address != null) setAddress(data.address);
        if (data.timezone) setTimezone(data.timezone);
        if (data.currency) setCurrency(data.currency);
        setInvoice((current) => ({ ...current, ...(data.invoice ?? {}), contactEmail: data.invoice?.contactEmail ?? data.email ?? '' }));
      })
      .catch(() => undefined);
  }, []);

  /** Warns about logos that will look poor once fitted to the fixed logo box. */
  const checkLogo = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      setLogoNote(
        img.width < 300
          ? `This logo is ${img.width}×${img.height}px; it may look blurry. Use at least 600×200px.`
          : ratio > 6 || ratio < 0.5
            ? `This logo is very ${ratio > 6 ? 'wide' : 'tall'} (${img.width}×${img.height}px). It will be fitted, but a 3:1 landscape or a square logo looks best.`
            : ''
      );
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      settingsOpsService.updateBusinessProfile({ name, email, phone, address, timezone, currency });

      // Name, logo and colours: what staff and guests see first.
      const formData = new FormData();
      if (name) formData.append('businessName', name);
      formData.append('phone', phone);
      formData.append('address', address);
      if (timezone) formData.append('timezone', timezone);
      if (currency) formData.append('currency', currency);
      Object.entries(invoice).forEach(([key, value]) => formData.append(key, value));
      formData.append('primaryColor', primaryColor);
      formData.append('accentColor', accentColor);
      if (logoFile) formData.append('logo', await logoAsPng(logoFile));
      else if (removeLogo) formData.append('removeLogo', 'true');
      const { data } = await apiClient.put('/settings/branding', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setLogoUrl(data.logoUrl ?? null);
      setLogoFile(null);
      setRemoveLogo(false);
      // Applies the new theme straight away, like picking a browser colour.
      setUser({ hotelName: data.businessName || data.name, logoUrl: data.logoUrl ?? null, brandColors: data.colors ?? null });
      setSaveSuccess(true);
    } catch (err: any) {
      setSaveError(getApiErrorMessage(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <SettingsTabs />
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Business Profile</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Core property settings. Your business name, logo and colours lead every screen, receipt and QR menu; HotelOpX appears only as a small "Powered by" credit.
        </Typography>

        <Paper sx={{ p: 3 }}>
          <Box component="form" onSubmit={save}>
            <Stack spacing={2.5}>
              {saveError && <Alert severity="error" onClose={() => setSaveError(null)}>{saveError}</Alert>}
              {saveSuccess && <Alert severity="success" onClose={() => setSaveSuccess(false)}>Saved successfully</Alert>}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                {/* The same fixed, centred box the sidebar uses, so what you see is what staff see. */}
                <Box
                  sx={{ width: 180, height: 72, borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1, display: 'grid', placeItems: 'center', bgcolor: 'background.default', flexShrink: 0 }}
                >
                  {logoPreview ? (
                    <Box component="img" src={logoPreview} alt={name} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <Typography variant="h4" fontWeight={800} color="primary">{(name || '?').charAt(0).toUpperCase()}</Typography>
                  )}
                </Box>
                <Stack spacing={1}>
                  <Typography variant="subtitle2">Your logo</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'none' }}>
                    Shown on the sidebar, receipts, invoices and your QR pages, fitted into a fixed box.
                    Best: a landscape logo about 600×200px (3:1) or a square one at least 400×400px, PNG with a transparent background, up to 5 MB.
                  </Typography>
                  {logoNote && <Alert severity="warning" sx={{ py: 0 }}>{logoNote}</Alert>}
                  <Stack direction="row" spacing={1}>
                    <Button component="label" variant="outlined" size="small">
                      {logoPreview ? 'Change logo' : 'Upload logo'}
                      <input
                        hidden
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            setLogoFile(file);
                            setRemoveLogo(false);
                            checkLogo(file);
                          }
                        }}
                      />
                    </Button>
                    {logoPreview && (
                      <Button size="small" color="inherit" onClick={() => { setLogoFile(null); setRemoveLogo(true); }}>
                        Remove
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Stack>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>App colours</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Pick your business's colours, like a browser theme. Everyone in your business sees them; leave blank for the HotelOpX defaults.
                </Typography>
                {([
                  ['Primary (sidebar, buttons)', primaryColor, setPrimaryColor, ['#0F2A44', '#1A73E8', '#0B6E4F', '#7B1E3A', '#4A148C', '#263238', '#B23A00']],
                  ['Accent (highlights)', accentColor, setAccentColor, ['#C49355', '#F2A900', '#00A3A3', '#E91E63', '#8BC34A', '#FF7043', '#90A4AE']]
                ] as Array<[string, string, (value: string) => void, string[]]>).map(([label, value, set, presets]) => (
                  <Stack key={label} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 1.5 }}>
                    <Typography variant="body2" sx={{ minWidth: 190 }}>{label}</Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
                      {presets.map((preset) => (
                        <Tooltip key={preset} title={preset}>
                          <Box
                            role="button"
                            aria-label={`Use ${preset}`}
                            onClick={() => set(preset)}
                            sx={{
                              width: 26, height: 26, borderRadius: '50%', bgcolor: preset, cursor: 'pointer',
                              outline: value.toUpperCase() === preset ? '3px solid' : 'none', outlineColor: 'text.primary', outlineOffset: 2
                            }}
                          />
                        </Tooltip>
                      ))}
                      <Box
                        component="input"
                        type="color"
                        aria-label={`Custom ${label}`}
                        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#0F2A44'}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => set(event.target.value.toUpperCase())}
                        sx={{ width: 32, height: 28, border: 'none', bgcolor: 'transparent', cursor: 'pointer' }}
                      />
                      {value && <Button size="small" onClick={() => set('')}>Default</Button>}
                    </Stack>
                  </Stack>
                ))}
              </Box>

              <TextField label="Business Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} multiline minRows={2} />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} fullWidth />
                <TextField label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} fullWidth />
              </Stack>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Invoice details</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, textTransform: 'none' }}>
                  Printed on event invoices, quotations and receipts: where guests pay, and who signs.
                </Typography>
                <Grid container spacing={2}>
                  {([
                    ['bankName', 'Bank name'],
                    ['accountName', 'Account name'],
                    ['accountNumber', 'Account number'],
                    ['contactEmail', 'Email on documents'],
                    ['website', 'Website'],
                    ['tagline', 'Tagline (optional)'],
                    ['signatoryName', 'Signed by (name)'],
                    ['signatoryTitle', 'Their title, e.g. General Manager']
                  ] as Array<[keyof typeof invoice, string]>).map(([key, label]) => (
                    <Grid item xs={12} sm={6} key={key}>
                      <TextField
                        label={label}
                        value={invoice[key]}
                        onChange={(e) => setInvoice({ ...invoice, [key]: e.target.value })}
                        fullWidth
                        inputProps={key === 'accountNumber' ? { inputMode: 'numeric' } : undefined}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
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

/** Prefers the server's explanation over axios's generic status message. */
const userActionError = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } }).response?.data?.message
  ?? (err as { response?: { data?: { error?: string } } }).response?.data?.error
  ?? (err instanceof Error ? err.message : fallback);

export const UsersSettingsPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  /**
   * HR reaches this page through MANAGE_USERS. The server will not let a
   * delegated manager create or manage manager accounts, so those options are
   * not offered to anyone but the owner.
   */
  const isOwner = useAuthStore((state) => String(state.user?.role || '').toUpperCase() === 'BUSINESS_ADMIN');
  const [pendingRotate, setPendingRotate] = useState<SettingUserRecord | null>(null);
  const [pendingRemove, setPendingRemove] = useState<SettingUserRecord | null>(null);
  const [pendingEmail, setPendingEmail] = useState<SettingUserRecord | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const theme = useTheme();
  const [rows, setRows] = useState<SettingUserRecord[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  /*
   * Empty by default. This was pre-filled with 'TempPass123!', so every staff
   * account created without retyping it shared one guessable password. Left
   * blank, the server generates a unique one.
   */
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('RECEPTION');
  const [autoAssignCode, setAutoAssignCode] = useState(true);
  const [issuedCode, setIssuedCode] = useState<{
    user: SettingUserRecord;
    userCode: string | null;
    temporaryPassword?: string;
    emailError?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = async () => setRows(await settingsOpsService.listUsers());

  useEffect(() => {
    void reload();
  }, []);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
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

      // When the invitation email did not go out, the dialog is the only
      // place the password exists — it is never shown again.
      const emailFailed = created.welcomeEmailSent === false;
      if (userCode || emailFailed) {
        setIssuedCode({
          user: { ...created, userCode },
          userCode,
          temporaryPassword: emailFailed ? created.temporaryPassword : undefined,
          emailError: emailFailed ? created.welcomeEmailError : undefined
        });
      }
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to create user'));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Ran as `void toggle(id)` with no catch, so a rejected request left the row
   * unchanged and produced no message — the button simply appeared dead.
   */
  const toggle = async (user: SettingUserRecord) => {
    try {
      await settingsOpsService.toggleUserActive(user.id);
      enqueueSnackbar(
        `${user.name} ${user.isActive ? 'deactivated' : 'reactivated'}`,
        { variant: 'success' }
      );
      await reload();
    } catch (err) {
      enqueueSnackbar(userActionError(err, 'Could not change this user\'s status'), {
        variant: 'error'
      });
    }
  };

  /** Throws on failure so the password dialog stays open and shows why. */
  const runEmailChange = async (user: SettingUserRecord, password: string) => {
    const result = await settingsOpsService.changeUserEmail(user.id, newEmail.trim(), password);
    setPendingEmail(null);
    await reload();
    enqueueSnackbar(`${result.message} ${user.email} is free to use again.`, { variant: 'success' });
  };

  /** Throws on failure so the password dialog stays open and shows why. */
  const runRemove = async (user: SettingUserRecord, password: string) => {
    await settingsOpsService.removeUser(user.id, password);
    setPendingRemove(null);
    await reload();
    enqueueSnackbar(`${user.name} has been removed. ${user.email} can be used for someone else.`, { variant: 'success' });
  };

  const runRotate = async (user: SettingUserRecord) => {
    try {
      const issued = await settingsOpsService.assignUserCode(user.id);
      await reload();
      setIssuedCode({ user: { ...user, userCode: issued.userCode }, userCode: issued.userCode });
      enqueueSnackbar(`New sign-in code issued for ${user.name}`, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(userActionError(err, 'Could not issue a sign-in code'), {
        variant: 'error'
      });
    } finally {
      setPendingRotate(null);
    }
  };

  /** Issuing a first code is harmless; rotating an existing one signs them out. */
  const rotateCode = (user: SettingUserRecord) => {
    if (user.userCode) {
      setPendingRotate(user);
      return;
    }
    void runRotate(user);
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
              minWidth: 90,
              render: (row) => (
                <RowActionsMenu
                  subject={row.name}
                  actions={[
                    {
                      key: 'code',
                      label: row.userCode ? 'Rotate sign-in code' : 'Issue sign-in code',
                      icon: <KeyRounded fontSize="small" />,
                      destructive: Boolean(row.userCode),
                      onClick: () => rotateCode(row)
                    },
                    {
                      key: 'email',
                      label: 'Change email',
                      icon: <AlternateEmailRounded fontSize="small" />,
                      onClick: () => {
                        setNewEmail(row.email);
                        setPendingEmail(row);
                      }
                    },
                    {
                      key: 'toggle',
                      label: row.isActive ? 'Deactivate user' : 'Reactivate user',
                      destructive: row.isActive,
                      onClick: () => void toggle(row)
                    },
                    {
                      /*
                       * Deactivating pauses a login; this ends the working
                       * relationship — access revoked and the HR record
                       * terminated in one step, so a leaver does not linger on
                       * the roster because two screens had to be visited.
                       */
                      key: 'remove',
                      label: 'Remove from business',
                      icon: <PersonRemoveRounded fontSize="small" />,
                      destructive: true,
                      onClick: () => setPendingRemove(row)
                    }
                  ]}
                />
              )
            }
          ]}
        />

        {/* Replaces window.confirm — a browser dialog cannot be styled, is not
            accessible to the app's theme, and is blocked outright in some
            embedded webviews, which made the action appear to do nothing. */}
        <PasswordConfirmDialog
          open={Boolean(pendingRemove)}
          title={`Remove ${pendingRemove?.name ?? ''} from this business?`}
          confirmLabel="Remove"
          onClose={() => setPendingRemove(null)}
          onConfirm={(password) => (pendingRemove ? runRemove(pendingRemove, password) : Promise.resolve())}
        >
          <Typography variant="body2">
            They are removed from the business for good: they disappear from staff and HR lists,
            can no longer sign in, and <strong>{pendingRemove?.email}</strong> can be used for someone else.
            Past records (shifts, orders, payroll) still show their name. This cannot be undone.
          </Typography>
        </PasswordConfirmDialog>

        <PasswordConfirmDialog
          open={Boolean(pendingEmail)}
          title={`Change ${pendingEmail?.name ?? ''}'s email`}
          confirmLabel="Change email"
          confirmColor="primary"
          onClose={() => setPendingEmail(null)}
          onConfirm={(password) => (pendingEmail ? runEmailChange(pendingEmail, password) : Promise.resolve())}
        >
          <TextField
            fullWidth
            type="email"
            label="New email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            sx={{ mt: 1, mb: 1.5 }}
          />
          <Typography variant="body2" color="text.secondary">
            They sign in with the new address from now on. <strong>{pendingEmail?.email}</strong> stops working at once
            and can be used for someone else.
          </Typography>
        </PasswordConfirmDialog>

        <Dialog open={Boolean(pendingRotate)} onClose={() => setPendingRotate(null)}>
          <DialogTitle>Rotate this sign-in code?</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              <strong>{pendingRotate?.name}</strong> will be signed out and must use
              the new code from then on. Their existing code stops working immediately.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPendingRotate(null)}>Cancel</Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => pendingRotate && void runRotate(pendingRotate)}
            >
              Rotate code
            </Button>
          </DialogActions>
        </Dialog>

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
                <TextField fullWidth type="password" label="Temporary password (optional)" value={password} onChange={(e) => setPassword(e.target.value)} helperText="Leave blank to generate a unique one. It is emailed to them, and they must change it at first sign-in." />
                <TextField select fullWidth label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
                  <MenuItem value="RECEPTION">Receptionist</MenuItem>
                  <MenuItem value="POS_STAFF">POS staff</MenuItem>
                  <MenuItem value="HOUSEKEEPING">Housekeeping</MenuItem>
                  {isOwner && [
                    <MenuItem key="MANAGER" value="MANAGER">Manager</MenuItem>,
                    <MenuItem key="MANAGER_RECEPTION" value="MANAGER_RECEPTION">Manager — Reception</MenuItem>,
                    <MenuItem key="MANAGER_POS" value="MANAGER_POS">Manager — POS</MenuItem>,
                    <MenuItem key="MANAGER_HOUSEKEEPING" value="MANAGER_HOUSEKEEPING">Manager — Housekeeping</MenuItem>,
                    <MenuItem key="MANAGER_ACCOUNTING" value="MANAGER_ACCOUNTING">Manager — Accounting</MenuItem>
                  ]}
                  <MenuItem value="SUPPORT_STAFF">Support staff (HR self-service)</MenuItem>
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
              <span>{issuedCode?.temporaryPassword ? 'Account created' : 'Usercode issued'}</span>
            </Stack>
          </DialogTitle>
          <DialogContent sx={{ textAlign: 'center', pb: 1 }}>
            {issuedCode && (
              <>
                {issuedCode.temporaryPassword && (
                  <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>
                    The invitation email did not send, so pass these on yourself.
                    {issuedCode.emailError && (
                      <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>{issuedCode.emailError}</Typography>
                    )}
                    <Box sx={{ mt: 1, fontFamily: 'monospace' }}>
                      Email: {issuedCode.user.email}<br />
                      Temporary password: {issuedCode.temporaryPassword}
                    </Box>
                  </Alert>
                )}
                {issuedCode.userCode && (
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Share this code securely with <b>{issuedCode.user.name}</b>. It is shown only once.
                </Typography>
                )}
                <Typography
                  variant="h1"
                  sx={{
                    display: issuedCode.userCode ? 'block' : 'none',
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
                {issuedCode.userCode && (
                <Button
                  variant="outlined"
                  startIcon={<ContentCopyRounded />}
                  onClick={() => void copyCode(issuedCode.userCode!)}
                >
                  {copied ? 'Copied' : 'Copy to clipboard'}
                </Button>
                )}
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
        <SettingsTabs />
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
        <SettingsTabs />
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

/**
 * PaymentGatewaysSettingsPage lived here and wrote both keys — including the
 * secret — into localStorage. That put live payment credentials somewhere any
 * cross-site script or browser extension could read, and the server never saw
 * them, so no payment could actually be taken with them.
 *
 * It has been replaced by Settings/PaymentGateways.tsx, which stores the secret
 * encrypted on the server and never reads it back.
 */


type BackupRow = { key: string; kind: 'NIGHT_AUDIT' | 'DAILY' | 'MANUAL'; size: number; createdAt: string };
const BACKUP_KIND_LABEL: Record<BackupRow['kind'], string> = {
  NIGHT_AUDIT: 'After night audit',
  DAILY: 'Daily automatic',
  MANUAL: 'Taken by you'
};
const fileSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * The hotel's real backups: taken after each night audit, every day for all
 * hotels, and whenever the owner asks. Any of them can be downloaded; a
 * restore replaces live data, so HotelOpX support carries it out.
 */
export const BackupRestoreSettingsPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<BackupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/backups');
      setRows(Array.isArray(data?.backups) ? data.backups : []);
      setError('');
    } catch (err) {
      setError(userActionError(err, 'Could not load your backups'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createBackup = async () => {
    setBusy('create');
    try {
      const { data } = await apiClient.post('/backups', {});
      enqueueSnackbar(data?.message || 'Backup started', { variant: 'success' });
      // It runs in the background; check back for it shortly.
      window.setTimeout(() => void load(), 20000);
    } catch (err) {
      enqueueSnackbar(userActionError(err, 'Could not start a backup'), { variant: 'error' });
    } finally {
      setBusy('');
    }
  };

  const download = async (row: BackupRow) => {
    setBusy(row.key);
    try {
      const { data } = await apiClient.get('/backups/download', { params: { key: row.key } });
      // A short-lived link straight to the file; the browser saves it.
      window.location.assign(data.url);
    } catch (err) {
      enqueueSnackbar(userActionError(err, 'Could not download this backup'), { variant: 'error' });
    } finally {
      setBusy('');
    }
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <SettingsTabs />
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>Backup & Restore</Typography>
            <Typography variant="body2" color="text.secondary">
              Your data is backed up after every night audit and once a day. Take one now, or download any backup to keep a copy yourself.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button onClick={() => void load()} disabled={loading}>Refresh</Button>
            <Button variant="contained" onClick={() => void createBackup()} disabled={busy === 'create'}>
              {busy === 'create' ? 'Starting…' : 'Back up now'}
            </Button>
          </Stack>
        </Stack>

        {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

        <DataTable
          rows={rows}
          rowKey={(row) => row.key}
          defaultRowsPerPage={10}
          emptyText={loading ? 'Loading backups…' : 'No backups yet. One is taken after your next night audit, or take one now.'}
          columns={[
            { key: 'createdAt', label: 'Taken', minWidth: 190, render: (row) => new Date(row.createdAt).toLocaleString() },
            { key: 'kind', label: 'Type', minWidth: 170, render: (row) => <Chip size="small" label={BACKUP_KIND_LABEL[row.kind]} color={row.kind === 'MANUAL' ? 'secondary' : 'default'} /> },
            { key: 'size', label: 'Size', minWidth: 90, render: (row) => fileSize(row.size) },
            {
              key: 'action',
              label: '',
              minWidth: 150,
              render: (row) => (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Button size="small" variant="outlined" onClick={() => void download(row)} disabled={busy === row.key}>
                    {busy === row.key ? 'Preparing…' : 'Download'}
                  </Button>
                  <RowActionsMenu subject="backup" actions={[{ key: 'restore', label: 'Restore…', onClick: () => setRestoreTarget(row.key) }]} />
                </Stack>
              )
            }
          ]}
        />

        {/*
          A restore overwrites a property's live data, so it is carried out by
          HotelOpX support rather than by a button, and the dialog says so.
        */}
        <Dialog open={Boolean(restoreTarget)} onClose={() => setRestoreTarget(null)} fullWidth maxWidth="sm">
          <DialogTitle>Restore this backup?</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 2 }}>
              Restoring replaces your property&apos;s current data with this backup. Anything recorded since it was
              taken (bookings, payments, orders) would be lost, so restores are carried out by HotelOpX support
              after confirming with you.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Contact support at info@hotelopx.com or on WhatsApp and quote this reference:
            </Typography>
            <Typography sx={{ fontFamily: 'monospace', mt: 1, wordBreak: 'break-all' }}>{restoreTarget}</Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                if (restoreTarget) void navigator.clipboard?.writeText(restoreTarget).catch(() => undefined);
              }}
            >
              Copy reference
            </Button>
            <Button variant="contained" onClick={() => setRestoreTarget(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export const BusinessAuditTrailPage = () => (
  /*
   * Replaced a flat, unpaginated list whose only controls were two dropdowns
   * filtering whatever had already been fetched. On a property with thousands
   * of entries, answering "who changed that price last Tuesday" meant
   * scrolling. The viewer searches and filters server-side, pages properly,
   * and expands each row to show what actually changed.
   */
  <Layout>
    <Container maxWidth="xl" sx={{ py: 4, overflowX: 'hidden' }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Business Audit Trail</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Every recorded action on this property — who did it, when, from where, and what changed.
      </Typography>
      <AuditTrailViewer />
    </Container>
  </Layout>
);
