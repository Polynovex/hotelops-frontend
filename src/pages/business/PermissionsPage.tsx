import Layout from '../../components/Layout';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import ShieldIcon from '@mui/icons-material/Shield';
import {
  CATEGORY_LABEL,
  DEPARTMENTS,
  permissionService,
  type Department,
  type PermissionCategory,
  type PermissionDef,
  type RoleSummary
} from '../../services/permission.service';
import { EmptyState, PageHeader } from '../../components/premium';

/**
 * Permission matrix (Part 2).
 *
 * Left: roles for this business. Right: every permission grouped by category,
 * toggled for the selected role. Changes are staged locally and saved in one
 * request, so a half-applied permission set is never written.
 */
const PermissionsPage = () => {
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [catalogue, setCatalogue] = useState<PermissionDef[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [baseline, setBaseline] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [loadingRole, setLoadingRole] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [newRole, setNewRole] = useState<{ name: string; department: Department }>({
    name: '',
    department: 'FRONT_DESK'
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roleList, permissionData] = await Promise.all([
        permissionService.listRoles(),
        permissionService.listPermissions()
      ]);
      setRoles(roleList);
      setCatalogue(permissionData.permissions);
      setError('');

      if (roleList.length > 0) {
        setSelectedRoleId((current) => current ?? roleList[0].id);
      }
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string; message?: string } } }).response;
      setError(
        response?.data?.error === 'PERMISSION_DENIED'
          ? 'You do not have permission to manage roles.'
          : response?.data?.message || 'Failed to load roles and permissions'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Pull the selected role's current permission set.
  useEffect(() => {
    if (!selectedRoleId) {
      return;
    }

    let cancelled = false;
    setLoadingRole(true);

    permissionService
      .getRolePermissions(selectedRoleId)
      .then((detail) => {
        if (!cancelled) {
          const codes = new Set(detail.permissionCodes);
          setGranted(codes);
          setBaseline(new Set(codes));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load permissions for that role');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingRole(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRoleId]);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) || null,
    [roles, selectedRoleId]
  );

  const grouped = useMemo(() => {
    const map = new Map<PermissionCategory, PermissionDef[]>();
    for (const permission of catalogue) {
      map.set(permission.category, [...(map.get(permission.category) || []), permission]);
    }
    return map;
  }, [catalogue]);

  const dirty = useMemo(() => {
    if (granted.size !== baseline.size) {
      return true;
    }
    for (const code of granted) {
      if (!baseline.has(code)) {
        return true;
      }
    }
    return false;
  }, [granted, baseline]);

  const toggle = (code: string) => {
    setGranted((current) => {
      const next = new Set(current);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleCategory = (category: PermissionCategory, on: boolean) => {
    const codes = (grouped.get(category) || []).map((permission) => permission.code);
    setGranted((current) => {
      const next = new Set(current);
      codes.forEach((code) => (on ? next.add(code) : next.delete(code)));
      return next;
    });
  };

  const save = async () => {
    if (!selectedRoleId) {
      return;
    }

    setSaving(true);
    try {
      await permissionService.updateRolePermissions(selectedRoleId, [...granted]);
      setBaseline(new Set(granted));
      setToast(`Permissions updated for ${selectedRole?.name}`);
      await load();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      setError(response?.data?.error || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const createRole = async () => {
    if (!newRole.name.trim()) {
      return;
    }

    try {
      const created = await permissionService.createRole({
        name: newRole.name.trim(),
        department: newRole.department
      });
      setToast('Role created');
      setCreateOpen(false);
      setNewRole({ name: '', department: 'FRONT_DESK' });
      await load();
      setSelectedRoleId(created.id);
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      setError(response?.data?.error || 'Failed to create role');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Control exactly what each role can do. Changes apply within a minute."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            New Role
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
        <Paper variant="outlined" sx={{ borderRadius: 2, width: { xs: '100%', md: 280 }, flexShrink: 0 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ p: 2, pb: 1 }}>
            Roles
          </Typography>
          <Divider />
          <List dense disablePadding>
            {roles.map((role) => (
              <ListItemButton
                key={role.id}
                selected={role.id === selectedRoleId}
                onClick={() => setSelectedRoleId(role.id)}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" fontWeight={600}>
                        {role.name}
                      </Typography>
                      {role.isSystem && <Chip size="small" label="System" sx={{ height: 18, fontSize: 10 }} />}
                    </Stack>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {role.department.replace(/_/g, ' ')} · {role.permissionCount} perms ·{' '}
                      {role.userCount} user{role.userCount === 1 ? '' : 's'}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        <Box sx={{ flexGrow: 1, width: '100%' }}>
          {!selectedRole && (
            <EmptyState icon={<ShieldIcon />} title="Select a role" description="Pick a role to edit its permissions." />
          )}

          {selectedRole && (
            <>
              <Stack
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{ mb: 2, position: 'sticky', top: 0, zIndex: 1 }}
              >
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" fontWeight={700}>
                    {selectedRole.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {granted.size} of {catalogue.length} permissions granted
                    {selectedRole.isSystem && ' · system role (permissions editable, name locked)'}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={!dirty || saving}
                  onClick={() => void save()}
                >
                  {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
                </Button>
              </Stack>

              {dirty && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  You have unsaved changes. Users holding this role keep their current access until
                  you save.
                </Alert>
              )}

              {loadingRole ? (
                <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <Stack spacing={2.5}>
                  {[...grouped.entries()].map(([category, permissions]) => {
                    const allOn = permissions.every((permission) => granted.has(permission.code));
                    const someOn = permissions.some((permission) => granted.has(permission.code));

                    return (
                      <Paper key={category} variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>
                            {CATEGORY_LABEL[category] || category}
                          </Typography>
                          {/* Checkbox rather than Switch: only Checkbox can
                              show the indeterminate "some selected" state. */}
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={allOn}
                                indeterminate={someOn && !allOn}
                                onChange={(event) => toggleCategory(category, event.target.checked)}
                              />
                            }
                            label={<Typography variant="caption">All</Typography>}
                          />
                        </Stack>
                        <Divider sx={{ mb: 1 }} />

                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' },
                            gap: 0.5
                          }}
                        >
                          {permissions.map((permission) => (
                            <FormControlLabel
                              key={permission.code}
                              control={
                                <Checkbox
                                  size="small"
                                  checked={granted.has(permission.code)}
                                  onChange={() => toggle(permission.code)}
                                />
                              }
                              label={
                                <Box>
                                  <Typography variant="body2">{permission.name}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {permission.description}
                                  </Typography>
                                </Box>
                              }
                              sx={{ alignItems: 'flex-start', m: 0, py: 0.5 }}
                            />
                          ))}
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </>
          )}
        </Box>
      </Stack>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New role</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Role name"
              value={newRole.name}
              onChange={(event) => setNewRole((r) => ({ ...r, name: event.target.value }))}
              fullWidth
              autoFocus
              placeholder="e.g. Night Auditor"
            />
            <TextField
              select
              label="Department"
              value={newRole.department}
              onChange={(event) =>
                setNewRole((r) => ({ ...r, department: event.target.value as Department }))
              }
              fullWidth
            >
              {DEPARTMENTS.map((department) => (
                <MenuItem key={department} value={department}>
                  {department.replace(/_/g, ' ')}
                </MenuItem>
              ))}
            </TextField>
            <Typography variant="caption" color="text.secondary">
              The role starts with no permissions. Grant them after creating it.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void createRole()} disabled={!newRole.name.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3500}
        onClose={() => setToast('')}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
};

/**
 * Wrapped in Layout so this page carries the same sidebar, header, and
 * page chrome as the rest of the dashboard. Wrapping at the export keeps
 * the loading and error early-returns inside the shell too.
 */
const PermissionsPageWithLayout = () => (
  <Layout>
    <PermissionsPage />
  </Layout>
);

export default PermissionsPageWithLayout;
