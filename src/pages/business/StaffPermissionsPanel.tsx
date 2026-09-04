import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import { useSnackbar } from 'notistack';
import LogoLoader from '../../components/LogoLoader';
import {
  userPermissionService,
  type UserPermissionMatrix,
  type UserPermissionRow
} from '../../services/permission.service';
import { settingsOpsService, type SettingUserRecord } from '../../services/operations';

/**
 * Per-person permissions, layered on the role.
 *
 * Roles stay the default: a new staff member inherits their department's
 * template. This screen adjusts one individual afterwards — granting a
 * receptionist the ability to approve discounts, say — without inventing a
 * bespoke role for one person, which is how role lists become unmanageable.
 *
 * A permission is in one of three states, and the distinction matters:
 *   follows role  — no override stored; changes with the role
 *   added         — granted to this person specifically
 *   removed       — revoked from this person specifically
 *
 * "Removed" is not the same as "follows a role that happens not to grant it":
 * if the role later gains the permission, a removal still holds.
 */
const StaffPermissionsPanel = () => {
  const { enqueueSnackbar } = useSnackbar();

  const [staff, setStaff] = useState<SettingUserRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<UserPermissionMatrix | null>(null);

  const [loadingStaff, setLoadingStaff] = useState(true);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  /** Working copy: code -> override state. */
  const [draft, setDraft] = useState<Record<string, boolean | null>>({});

  const loadStaff = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const rows = await settingsOpsService.listUsers();
      setStaff(rows);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
      setError('');
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? 'Could not load staff'
      );
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const loadMatrix = useCallback(async (userId: string) => {
    setLoadingMatrix(true);
    try {
      const data = await userPermissionService.getMatrix(userId);
      setMatrix(data);
      setDraft(
        Object.fromEntries(data.permissions.map((row) => [row.code, row.override]))
      );
      setError('');
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? 'Could not load this person’s permissions'
      );
      setMatrix(null);
    } finally {
      setLoadingMatrix(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadMatrix(selectedId);
    }
  }, [selectedId, loadMatrix]);

  const byCategory = useMemo(() => {
    const groups = new Map<string, UserPermissionRow[]>();
    for (const row of matrix?.permissions ?? []) {
      const list = groups.get(row.category) ?? [];
      list.push(row);
      groups.set(row.category, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [matrix]);

  const visibleStaff = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return staff;
    return staff.filter(
      (person) =>
        person.name.toLowerCase().includes(term) ||
        person.email.toLowerCase().includes(term)
    );
  }, [staff, search]);

  /** Effective value for a permission given the current draft. */
  const isEffective = (row: UserPermissionRow) => {
    const override = draft[row.code];
    return override === null || override === undefined ? row.viaRole : override;
  };

  /**
   * Toggling sets an override only where it departs from the role. Returning a
   * permission to its role value clears the override rather than storing a
   * redundant one, so the record shows genuine exceptions and nothing else.
   */
  const toggle = (row: UserPermissionRow) => {
    const next = !isEffective(row);
    setDraft((prev) => ({
      ...prev,
      [row.code]: next === row.viaRole ? null : next
    }));
  };

  const changes = useMemo(() => {
    const granted: string[] = [];
    const revoked: string[] = [];
    for (const [code, value] of Object.entries(draft)) {
      if (value === true) granted.push(code);
      if (value === false) revoked.push(code);
    }
    return { granted, revoked };
  }, [draft]);

  const dirty = useMemo(() => {
    if (!matrix) return false;
    return matrix.permissions.some((row) => (draft[row.code] ?? null) !== row.override);
  }, [matrix, draft]);

  const save = async () => {
    if (!selectedId) return;

    setSaving(true);
    try {
      await userPermissionService.setOverrides(selectedId, changes.granted, changes.revoked);
      enqueueSnackbar('Permissions updated', { variant: 'success' });
      await loadMatrix(selectedId);
    } catch (err) {
      const response = (err as {
        response?: { data?: { message?: string; error?: string } };
      }).response;
      enqueueSnackbar(
        response?.data?.message ?? response?.data?.error ?? 'Could not save permissions',
        { variant: 'error' }
      );
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    if (!matrix) return;
    setDraft(Object.fromEntries(matrix.permissions.map((row) => [row.code, row.override])));
  };

  return (
    <Grid container spacing={2}>
      {/* People */}
      <Grid item xs={12} md={4}>
        <Paper sx={{ p: 2, height: '100%' }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
            Staff
          </Typography>
          <TextField
            size="small"
            fullWidth
            placeholder="Search by name or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ mb: 1.5 }}
          />

          {loadingStaff ? (
            <LogoLoader inline minHeight={140} />
          ) : (
            <List dense disablePadding sx={{ maxHeight: 520, overflowY: 'auto' }}>
              {visibleStaff.map((person) => (
                <ListItemButton
                  key={person.id}
                  selected={person.id === selectedId}
                  onClick={() => setSelectedId(person.id)}
                  sx={{ borderRadius: 1, mb: 0.5 }}
                >
                  <ListItemText
                    primary={person.name}
                    secondary={person.email}
                    primaryTypographyProps={{ fontWeight: 600 }}
                  />
                  {!person.isActive && <Chip size="small" label="Inactive" />}
                </ListItemButton>
              ))}
              {visibleStaff.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                  No staff match that search.
                </Typography>
              )}
            </List>
          )}
        </Paper>
      </Grid>

      {/* Permissions for the selected person */}
      <Grid item xs={12} md={8}>
        <Paper sx={{ p: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {loadingMatrix && <LogoLoader inline minHeight={200} />}

          {!loadingMatrix && matrix && (
            <>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={1}
                sx={{ mb: 1 }}
              >
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {matrix.user.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {matrix.user.roleName
                      ? `Starts from the ${matrix.user.roleName} role`
                      : 'No role assigned — nothing is granted by default'}
                  </Typography>
                </Box>

                {dirty && (
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={reset} disabled={saving}>
                      Discard
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => void save()}
                      disabled={saving}
                    >
                      {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                  </Stack>
                )}
              </Stack>

              {matrix.user.implicitAll && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  This role already has unrestricted access, so individual permissions
                  have no effect and cannot be edited.
                </Alert>
              )}

              {!matrix.user.roleName && !matrix.user.implicitAll && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  No role is assigned, so this person starts with nothing. Assign a role
                  first, then adjust here — otherwise every permission has to be granted
                  one at a time.
                </Alert>
              )}

              <Divider sx={{ mb: 2 }} />

              {byCategory.map(([category, rows]) => (
                <Box key={category} sx={{ mb: 2.5 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, textTransform: 'capitalize', mb: 1 }}
                  >
                    {category.replace(/_/g, ' ').toLowerCase()}
                  </Typography>

                  <Grid container spacing={1}>
                    {rows.map((row) => {
                      const override = draft[row.code] ?? null;
                      return (
                        <Grid item xs={12} sm={6} key={row.code}>
                          <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{
                              px: 1,
                              py: 0.5,
                              borderRadius: 1,
                              // Highlight only genuine departures from the role,
                              // so exceptions stand out from inherited defaults.
                              bgcolor: override === null ? 'transparent' : 'action.hover'
                            }}
                          >
                            <FormControlLabel
                              control={
                                <Switch
                                  size="small"
                                  checked={isEffective(row)}
                                  disabled={matrix.user.implicitAll || saving}
                                  onChange={() => toggle(row)}
                                />
                              }
                              label={
                                <Box>
                                  <Typography variant="body2">{row.name}</Typography>
                                  {row.description && (
                                    <Typography variant="caption" color="text.secondary">
                                      {row.description}
                                    </Typography>
                                  )}
                                </Box>
                              }
                              sx={{ mr: 0 }}
                            />

                            {override !== null && (
                              <Chip
                                size="small"
                                label={override ? 'Added' : 'Removed'}
                                color={override ? 'success' : 'warning'}
                                variant="outlined"
                              />
                            )}
                          </Stack>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>
              ))}
            </>
          )}

          {!loadingMatrix && !matrix && !error && (
            <Typography variant="body2" color="text.secondary">
              Select a staff member to review their permissions.
            </Typography>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
};

export default StaffPermissionsPanel;
