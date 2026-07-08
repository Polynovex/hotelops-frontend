import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,

  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { Add as AddIcon, History as HistoryIcon, Settings as SettingsIcon } from '@mui/icons-material';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSnackbar } from 'notistack';
import Layout from '../components/Layout';
import LogoLoader from '../components/LogoLoader';
import DataTable from '../components/common/DataTable';
import {
  BusinessModuleName,
  BusinessModuleStatus,
  BusinessSummary,
  PlanSummary,
  superAdminService,
  SystemAuditEntry,
  SystemMetrics
} from '../services/api';

const defaultMetrics: SystemMetrics = {
  totalBusinesses: 0,
  activeBusinesses: 0,
  trialBusinesses: 0,
  suspendedBusinesses: 0,
  recentSignups: 0,
  totalPlans: 0,
  mrr: 0
};

const statusColor = (status: BusinessSummary['status']) => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'TRIAL') return 'info';
  if (status === 'SUSPENDED') return 'warning';
  if (status === 'EXPIRED' || status === 'DELETED') return 'error';
  return 'default';
};

const moduleLabels: Record<BusinessModuleName, string> = {
  pms: 'PMS',
  pos: 'POS',
  finance: 'FINANCE'
};

const parseModuleFromAudit = (entry: SystemAuditEntry): BusinessModuleName | null => {
  const changes = (entry.changes || {}) as Record<string, unknown>;
  const value = typeof changes.module === 'string' ? changes.module.toLowerCase() : '';
  if (value === 'pms' || value === 'pos' || value === 'finance') {
    return value;
  }
  return null;
};

const parseReasonFromAudit = (entry: SystemAuditEntry) => {
  const changes = (entry.changes || {}) as Record<string, unknown>;
  return typeof changes.reason === 'string' && changes.reason.trim() ? changes.reason : null;
};

const SuperAdminPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics>(defaultMetrics);
  const [health, setHealth] = useState<{ status: string; services?: Record<string, string> } | null>(null);
  const [openModulesDialog, setOpenModulesDialog] = useState(false);
  const [moduleBusiness, setModuleBusiness] = useState<BusinessSummary | null>(null);
  const [moduleStatus, setModuleStatus] = useState<BusinessModuleStatus | null>(null);
  const [moduleHistory, setModuleHistory] = useState<SystemAuditEntry[]>([]);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleActionLoading, setModuleActionLoading] = useState<BusinessModuleName | null>(null);
  const [moduleError, setModuleError] = useState('');
  const [moduleReasons, setModuleReasons] = useState<Record<BusinessModuleName, string>>({
    pms: '',
    pos: '',
    finance: ''
  });

  const [newBusiness, setNewBusiness] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    planId: ''
  });

  const formatDateTime = (value?: string | null) => {
    if (!value) {
      return '—';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '—';
    }
    return parsed.toLocaleString();
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [businessData, planData, metricsData, healthData] = await Promise.all([
        superAdminService.getBusinesses(),
        superAdminService.listPlans(),
        superAdminService.getSystemMetrics(),
        superAdminService.getSystemHealth()
      ]);

      setBusinesses(businessData);
      setPlans(planData);
      setMetrics(metricsData);
      setHealth(healthData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load admin data';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const chartData = useMemo(() => {
    return businesses.slice(0, 8).map((business) => {
      const planPrice = business.plan?.monthlyPriceNgn || 0;
      return {
        name: business.name.slice(0, 14),
        mrr: planPrice
      };
    });
  }, [businesses]);

  const updateBusinessLocally = (id: string, patch: Partial<BusinessSummary>) => {
    setBusinesses((prev) => prev.map((business) => (business.id === id ? { ...business, ...patch } : business)));
  };

  const syncBusinessModules = (businessId: string, status: BusinessModuleStatus) => {
    updateBusinessLocally(businessId, {
      pmsEnabled: status.pms.enabled,
      posEnabled: status.pos.enabled,
      financeEnabled: status.finance.enabled
    });
  };

  const loadModuleManagerData = async (businessId: string) => {
    setModuleLoading(true);
    setModuleError('');
    try {
      const [status, auditLogs] = await Promise.all([
        superAdminService.getBusinessModuleStatus(businessId),
        superAdminService.getSystemAudit({ entity: 'BusinessModule' })
      ]);

      setModuleStatus(status);
      setModuleHistory(
        auditLogs
          .filter((entry) => entry.entity === 'BusinessModule' && entry.entityId === businessId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
      syncBusinessModules(businessId, status);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load module status';
      setModuleError(message);
    } finally {
      setModuleLoading(false);
    }
  };

  const openManageModules = async (business: BusinessSummary) => {
    setModuleBusiness(business);
    setModuleReasons({ pms: '', pos: '', finance: '' });
    setOpenModulesDialog(true);
    await loadModuleManagerData(business.id);
  };

  const closeManageModules = () => {
    setOpenModulesDialog(false);
    setModuleBusiness(null);
    setModuleStatus(null);
    setModuleHistory([]);
    setModuleError('');
    setModuleActionLoading(null);
  };

  const handleModuleAction = async (moduleName: BusinessModuleName, nextEnabled: boolean) => {
    if (!moduleBusiness) {
      return;
    }

    const reason = moduleReasons[moduleName].trim();
    if (!nextEnabled && !reason) {
      setModuleError(`Reason is required before deactivating ${moduleLabels[moduleName]}.`);
      return;
    }

    setModuleActionLoading(moduleName);
    setModuleError('');
    try {
      const updatedStatus = nextEnabled
        ? await superAdminService.reactivateBusinessModule(moduleBusiness.id, moduleName)
        : await superAdminService.deactivateBusinessModule(moduleBusiness.id, moduleName, reason);

      syncBusinessModules(moduleBusiness.id, updatedStatus);
      setModuleStatus(updatedStatus);
      setModuleReasons((prev) => ({ ...prev, [moduleName]: '' }));
      await loadModuleManagerData(moduleBusiness.id);
      enqueueSnackbar(
        `${moduleLabels[moduleName]} module ${nextEnabled ? 'reactivated' : 'deactivated'} successfully`,
        { variant: nextEnabled ? 'success' : 'warning' }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update module';
      setModuleError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setModuleActionLoading(null);
    }
  };

  const handlePlanChange = async (businessId: string, planId: string) => {
    setSaving(true);
    try {
      await superAdminService.assignPlan(businessId, planId);
      const assignedPlan = plans.find((plan) => plan.id === planId) || null;
      updateBusinessLocally(businessId, {
        planId,
        plan: assignedPlan,
        subscriptionTier: assignedPlan?.code || 'S'
      });
      enqueueSnackbar('Plan assigned successfully', { variant: 'success' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to assign plan';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (business: BusinessSummary) => {
    setSaving(true);
    try {
      if (business.status === 'ACTIVE' || business.status === 'TRIAL') {
        await superAdminService.suspendBusiness(business.id);
        updateBusinessLocally(business.id, { status: 'SUSPENDED' });
        enqueueSnackbar('Business suspended', { variant: 'warning' });
      } else {
        await superAdminService.activateBusiness(business.id);
        updateBusinessLocally(business.id, { status: 'ACTIVE' });
        enqueueSnackbar('Business activated', { variant: 'success' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Status update failed';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBusiness = async () => {
    if (!newBusiness.name || !newBusiness.email || !newBusiness.phone || !newBusiness.address) {
      enqueueSnackbar('Fill all required fields', { variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const created = await superAdminService.createBusiness({
        ...newBusiness,
        pmsEnabled: true,
        posEnabled: true,
        financeEnabled: true
      });
      setBusinesses((prev) => [created, ...prev]);
      setOpenCreateDialog(false);
      setNewBusiness({ name: '', email: '', phone: '', address: '', planId: '' });
      enqueueSnackbar('Business created', { variant: 'success' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create business';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Container maxWidth={false} sx={{ py: 4, overflowX: 'hidden' }}>
        <Box
          sx={{
            mb: 4,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', md: 'center' },
            gap: 2
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Super Admin
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Business lifecycle, plan assignment, and platform health.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="outlined" onClick={() => void loadData()} disabled={loading || saving}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenCreateDialog(true)} disabled={saving}>
              Create Business
            </Button>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {(loading || saving) && (
          <LogoLoader inline minHeight={160} label={saving ? 'Saving business' : 'Loading businesses'} />
        )}

        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent><Typography color="textSecondary">Businesses</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{metrics.totalBusinesses}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent><Typography color="textSecondary">Active</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{metrics.activeBusinesses}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent><Typography color="textSecondary">MRR</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>₦{metrics.mrr.toLocaleString()}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary">System Health</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                  {health?.status || 'unknown'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  DB: {health?.services?.database || '-'} | Cache: {health?.services?.cache || '-'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
                MRR by Business
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `₦${Number(value).toLocaleString()}`} />
                  <Bar dataKey="mrr" fill="#0B4F6C" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
                Plans
              </Typography>
              <Stack spacing={1.2}>
                {plans.map((plan) => (
                  <Box key={plan.id} sx={{ p: 1.5, border: '1px solid #e3e8ef', borderRadius: 2 }}>
                    <Typography sx={{ fontWeight: 700 }}>{plan.name} ({plan.code})</Typography>
                    <Typography variant="body2" color="text.secondary">
                      ₦{plan.monthlyPriceNgn.toLocaleString()} / month
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        <DataTable
          rows={businesses}
          rowKey={(business) => business.id}
          emptyText={loading ? 'Loading businesses...' : 'No businesses available.'}
          defaultRowsPerPage={10}
          columns={[
            {
              key: 'name',
              label: 'Business',
              minWidth: 280,
              render: (business) => (
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{business.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{business.email}</Typography>
                </Box>
              )
            },
            {
              key: 'status',
              label: 'Status',
              minWidth: 140,
              render: (business) => (
                <Chip size="small" label={business.status} color={statusColor(business.status)} />
              )
            },
            {
              key: 'plan',
              label: 'Plan',
              minWidth: 220,
              render: (business) => (
                <Select
                  size="small"
                  value={business.planId || ''}
                  displayEmpty
                  sx={{ minWidth: 180 }}
                  onChange={(event) => void handlePlanChange(business.id, event.target.value)}
                >
                  <MenuItem value="">No plan</MenuItem>
                  {plans.map((plan) => (
                    <MenuItem key={plan.id} value={plan.id}>{plan.name} ({plan.code})</MenuItem>
                  ))}
                </Select>
              )
            },
            {
              key: 'modules',
              label: 'Modules',
              minWidth: 320,
              render: (business) => (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" color={business.pmsEnabled ? 'success' : 'default'} label={`PMS ${business.pmsEnabled ? 'ON' : 'OFF'}`} />
                  <Chip size="small" color={business.posEnabled ? 'success' : 'default'} label={`POS ${business.posEnabled ? 'ON' : 'OFF'}`} />
                  <Chip size="small" color={business.financeEnabled ? 'success' : 'default'} label={`FIN ${business.financeEnabled ? 'ON' : 'OFF'}`} />
                </Stack>
              )
            },
            {
              key: 'actions',
              label: 'Actions',
              minWidth: 280,
              render: (business) => (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<SettingsIcon />}
                    onClick={() => void openManageModules(business)}
                  >
                    Manage Modules
                  </Button>
                  <Button size="small" onClick={() => void handleStatusChange(business)}>
                    {business.status === 'ACTIVE' || business.status === 'TRIAL' ? 'Suspend' : 'Activate'}
                  </Button>
                </Stack>
              )
            }
          ]}
        />
      </Container>

      <Dialog
        open={openModulesDialog}
        onClose={closeManageModules}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon fontSize="small" />
          Manage Modules - {moduleBusiness?.name || 'Business'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {(moduleLoading || moduleActionLoading) && (
            <LogoLoader inline minHeight={140} label="Updating modules" />
          )}
          {moduleError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {moduleError}
            </Alert>
          )}

          {moduleStatus && (
            <Stack spacing={2.5}>
              {(['pms', 'pos', 'finance'] as BusinessModuleName[]).map((moduleName) => {
                const status = moduleStatus[moduleName];
                return (
                  <Paper key={moduleName} variant="outlined" sx={{ p: 2 }}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                      spacing={2}
                    >
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {moduleLabels[moduleName]} MODULE
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                          <Chip
                            size="small"
                            color={status.enabled ? 'success' : 'default'}
                            label={status.enabled ? 'ACTIVE' : 'INACTIVE'}
                          />
                          {!status.enabled && status.deactivatedAt && (
                            <Typography variant="caption" color="text.secondary">
                              Deactivated: {formatDateTime(status.deactivatedAt)}
                            </Typography>
                          )}
                        </Stack>
                        {!status.enabled && (
                          <Stack spacing={0.25} sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              By: {status.deactivatedBy || 'Unknown'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Reason: {status.reason || 'No reason provided'}
                            </Typography>
                          </Stack>
                        )}
                      </Box>

                      <Stack spacing={1} sx={{ minWidth: { md: 340 }, width: { xs: '100%', md: 'auto' } }}>
                        <TextField
                          label="Deactivation reason"
                          size="small"
                          value={moduleReasons[moduleName]}
                          onChange={(event) =>
                            setModuleReasons((prev) => ({
                              ...prev,
                              [moduleName]: event.target.value
                            }))
                          }
                          placeholder={`Reason for ${moduleLabels[moduleName]} deactivation`}
                          disabled={moduleActionLoading !== null}
                          fullWidth
                        />
                        <Button
                          variant={status.enabled ? 'outlined' : 'contained'}
                          color={status.enabled ? 'warning' : 'success'}
                          onClick={() => void handleModuleAction(moduleName, !status.enabled)}
                          disabled={moduleActionLoading !== null}
                        >
                          {status.enabled ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}

              <Divider />

              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <HistoryIcon fontSize="small" />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Module History
                  </Typography>
                </Stack>
                {moduleHistory.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No module history available for this business.
                  </Typography>
                ) : (
                  <List dense sx={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e3e8ef', borderRadius: 1 }}>
                    {moduleHistory.map((entry) => {
                      const moduleName = parseModuleFromAudit(entry);
                      const reason = parseReasonFromAudit(entry);
                      return (
                        <ListItem key={entry.id} divider>
                          <ListItemText
                            primary={`${entry.action} ${moduleName ? `(${moduleLabels[moduleName]})` : ''}`}
                            secondary={
                              <>
                                <Typography component="span" variant="caption" color="text.secondary">
                                  {formatDateTime(entry.createdAt)} • by {entry.user?.email || entry.userId}
                                </Typography>
                                {reason && (
                                  <Typography component="span" variant="caption" sx={{ display: 'block', mt: 0.4 }}>
                                    Reason: {reason}
                                  </Typography>
                                )}
                              </>
                            }
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => moduleBusiness && void loadModuleManagerData(moduleBusiness.id)} disabled={moduleLoading || moduleActionLoading !== null}>
            Refresh
          </Button>
          <Button onClick={closeManageModules} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Business</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField label="Business Name" value={newBusiness.name} onChange={(event) => setNewBusiness((prev) => ({ ...prev, name: event.target.value }))} fullWidth />
            <TextField label="Email" value={newBusiness.email} onChange={(event) => setNewBusiness((prev) => ({ ...prev, email: event.target.value }))} fullWidth />
            <TextField label="Phone" value={newBusiness.phone} onChange={(event) => setNewBusiness((prev) => ({ ...prev, phone: event.target.value }))} fullWidth />
            <TextField label="Address" value={newBusiness.address} onChange={(event) => setNewBusiness((prev) => ({ ...prev, address: event.target.value }))} fullWidth />
            <TextField
              select
              label="Plan"
              value={newBusiness.planId}
              onChange={(event) => setNewBusiness((prev) => ({ ...prev, planId: event.target.value }))}
              fullWidth
            >
              <MenuItem value="">No plan</MenuItem>
              {plans.map((plan) => (
                <MenuItem key={plan.id} value={plan.id}>
                  {plan.name} ({plan.code})
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateBusiness()} disabled={saving}>
            {saving ? <CircularProgress size={20} color="inherit" /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default SuperAdminPage;
