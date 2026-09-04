import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
  TextField,
  Typography
} from '@mui/material';
import { useSnackbar } from 'notistack';
import Layout from '../../components/Layout';
import LogoLoader from '../../components/LogoLoader';
import DataTable from '../../components/common/DataTable';
import { PlanPayload, PlanSummary, superAdminService } from '../../services/api';
import RowActionsMenu from '../../components/common/RowActionsMenu';

const blankPlan: PlanPayload = {
  code: '',
  name: '',
  monthlyPriceNgn: 0,
  annualPriceNgn: 0,
  maxRooms: null,
  maxPosTerminals: null,
  hasPms: true,
  hasPos: true,
  hasBasicFinance: true,
  hasFullFinance: false,
  hasOffline: true,
  hasMultiProperty: false,
  hasAdvancedAnalytics: false,
  hasApiAccess: false,
  supportLevel: 'EMAIL'
};

const PlansPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanPayload>(blankPlan);

  const [addon, setAddon] = useState({ planId: '', name: '', code: '', priceNgn: '0' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const planData = await superAdminService.listPlans();
      setPlans(planData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const totals = useMemo(() => {
    return plans.reduce(
      (acc, plan) => {
        acc.totalPlans += 1;
        acc.activePlans += plan.isActive ? 1 : 0;
        acc.mrr += Number((plan._count?.hotels || 0) * (plan.monthlyPriceNgn || 0));
        return acc;
      },
      { totalPlans: 0, activePlans: 0, mrr: 0 }
    );
  }, [plans]);

  const openCreate = () => {
    setEditingId(null);
    setForm(blankPlan);
    setOpenDialog(true);
  };

  const openEdit = (plan: PlanSummary) => {
    setEditingId(plan.id);
    setForm({
      code: plan.code,
      name: plan.name,
      monthlyPriceNgn: Number(plan.monthlyPriceNgn || 0),
      annualPriceNgn: Number(plan.annualPriceNgn || 0),
      maxRooms: plan.maxRooms ?? null,
      maxPosTerminals: plan.maxPosTerminals ?? null,
      hasPms: Boolean(plan.hasPms),
      hasPos: Boolean(plan.hasPos),
      hasBasicFinance: Boolean(plan.hasBasicFinance),
      hasFullFinance: Boolean(plan.hasFullFinance),
      hasOffline: Boolean(plan.hasOffline),
      hasMultiProperty: Boolean(plan.hasMultiProperty),
      hasAdvancedAnalytics: Boolean(plan.hasAdvancedAnalytics),
      hasApiAccess: Boolean(plan.hasApiAccess),
      supportLevel: (plan.supportLevel as PlanPayload['supportLevel']) || 'EMAIL'
    });
    setOpenDialog(true);
  };

  const savePlan = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await superAdminService.updatePlan(editingId, form);
        enqueueSnackbar('Plan updated', { variant: 'success' });
      } else {
        await superAdminService.createPlan(form);
        enqueueSnackbar('Plan created', { variant: 'success' });
      }
      setOpenDialog(false);
      await load();
    } catch (err: unknown) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Failed to save plan', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const activatePlan = async (plan: { id: string; name: string }) => {
    setSaving(true);
    try {
      await superAdminService.activatePlan(plan.id);
      enqueueSnackbar(`${plan.name} reactivated`, { variant: 'success' });
      await load();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message
        ?? (err instanceof Error ? err.message : 'Failed to reactivate plan');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deactivatePlan = async (planId: string) => {
    setSaving(true);
    try {
      await superAdminService.deletePlan(planId);
      enqueueSnackbar('Plan deactivated', { variant: 'warning' });
      await load();
    } catch (err: unknown) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Failed to deactivate plan', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const addAddon = async () => {
    if (!addon.planId || !addon.name || !addon.code) {
      enqueueSnackbar('Provide plan, addon name and code', { variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      await superAdminService.addPlanAddon(addon.planId, {
        name: addon.name,
        code: addon.code,
        priceNgn: Number(addon.priceNgn || 0)
      });
      setAddon({ planId: '', name: '', code: '', priceNgn: '0' });
      enqueueSnackbar('Addon added', { variant: 'success' });
      await load();
    } catch (err: unknown) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Failed to add addon', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Plan Management</Typography>
            <Typography variant="body2" color="text.secondary">v3 plan CRUD, feature toggles and addon setup.</Typography>
          </Box>
          <Button variant="contained" onClick={openCreate} disabled={saving}>Create Plan</Button>
        </Box>

        {(loading || saving) && <LogoLoader inline minHeight={160} label={saving ? 'Saving plan' : 'Loading plans'} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}>
            <Card><CardContent><Typography color="textSecondary">Total Plans</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{totals.totalPlans}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card><CardContent><Typography color="textSecondary">Active Plans</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{totals.activePlans}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card><CardContent><Typography color="textSecondary">Estimated MRR</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>₦{totals.mrr.toLocaleString()}</Typography></CardContent></Card>
          </Grid>
        </Grid>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Quick Add Addon</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              select
              label="Plan"
              value={addon.planId}
              onChange={(event) => setAddon((prev) => ({ ...prev, planId: event.target.value }))}
              sx={{ minWidth: 180 }}
            >
              {plans.map((plan) => (
                <MenuItem key={plan.id} value={plan.id}>{plan.name}</MenuItem>
              ))}
            </TextField>
            <TextField label="Addon Name" value={addon.name} onChange={(event) => setAddon((prev) => ({ ...prev, name: event.target.value }))} />
            <TextField label="Code" value={addon.code} onChange={(event) => setAddon((prev) => ({ ...prev, code: event.target.value }))} />
            <TextField type="number" label="Price (NGN)" value={addon.priceNgn} onChange={(event) => setAddon((prev) => ({ ...prev, priceNgn: event.target.value }))} />
            <Button variant="outlined" onClick={() => void addAddon()} disabled={saving}>Add Addon</Button>
          </Stack>
        </Paper>

        <DataTable
          rows={plans}
          rowKey={(plan) => plan.id}
          defaultRowsPerPage={10}
          emptyText={loading ? 'Loading plans...' : 'No plans configured.'}
          columns={[
            { key: 'name', label: 'Plan', minWidth: 170 },
            { key: 'code', label: 'Code', minWidth: 90 },
            {
              key: 'monthly',
              label: 'Monthly',
              minWidth: 120,
              render: (plan) => `₦${Number(plan.monthlyPriceNgn || 0).toLocaleString()}`
            },
            {
              key: 'annual',
              label: 'Annual',
              minWidth: 120,
              render: (plan) => `₦${Number(plan.annualPriceNgn || 0).toLocaleString()}`
            },
            {
              key: 'businesses',
              label: 'Businesses',
              minWidth: 110,
              render: (plan) => plan._count?.hotels || 0
            },
            {
              key: 'features',
              label: 'Features',
              minWidth: 260,
              render: (plan) => (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {plan.hasPms && <Chip label="PMS" size="small" />}
                  {plan.hasPos && <Chip label="POS" size="small" />}
                  {plan.hasFullFinance ? <Chip label="FULL FIN" size="small" color="success" /> : plan.hasBasicFinance && <Chip label="BASIC FIN" size="small" color="warning" />}
                  {plan.hasApiAccess && <Chip label="API" size="small" />}
                </Stack>
              )
            },
            {
              key: 'addons',
              label: 'Addons',
              minWidth: 90,
              render: (plan) => plan.addons?.length || 0
            },
            {
              key: 'actions',
              label: 'Actions',
              minWidth: 190,
              render: (plan) => (
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                  {!plan.isActive && <Chip size="small" label="Inactive" />}
                  <RowActionsMenu
                    subject={plan.name}
                    actions={[
                      {
                        key: 'edit',
                        label: 'Edit plan',
                        onClick: () => openEdit(plan)
                      },
                      {
                        key: 'activate',
                        label: 'Reactivate plan',
                        hidden: plan.isActive,
                        onClick: () => void activatePlan(plan)
                      },
                      {
                        key: 'deactivate',
                        label: 'Deactivate plan',
                        destructive: true,
                        hidden: !plan.isActive,
                        onClick: () => void deactivatePlan(plan.id)
                      }
                    ]}
                  />
                </Stack>
              )
            }
          ]}
        />

        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>{editingId ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Box component="form" id="plan-form" onSubmit={savePlan}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField label="Code" value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} required fullWidth />
                  <TextField label="Name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required fullWidth />
                </Stack>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField type="number" label="Monthly (NGN)" value={form.monthlyPriceNgn} onChange={(event) => setForm((prev) => ({ ...prev, monthlyPriceNgn: Number(event.target.value || 0) }))} fullWidth />
                  <TextField type="number" label="Annual (NGN)" value={form.annualPriceNgn} onChange={(event) => setForm((prev) => ({ ...prev, annualPriceNgn: Number(event.target.value || 0) }))} fullWidth />
                </Stack>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField type="number" label="Max Rooms" value={form.maxRooms ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, maxRooms: event.target.value ? Number(event.target.value) : null }))} fullWidth />
                  <TextField type="number" label="Max POS Terminals" value={form.maxPosTerminals ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, maxPosTerminals: event.target.value ? Number(event.target.value) : null }))} fullWidth />
                </Stack>

                <Paper sx={{ p: 2, backgroundColor: '#f9fbfd' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Feature Toggles</Typography>
                  <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                    <Button variant={form.hasPms ? 'contained' : 'outlined'} onClick={() => setForm((prev) => ({ ...prev, hasPms: !prev.hasPms }))}>PMS</Button>
                    <Button variant={form.hasPos ? 'contained' : 'outlined'} onClick={() => setForm((prev) => ({ ...prev, hasPos: !prev.hasPos }))}>POS</Button>
                    <Button variant={form.hasBasicFinance ? 'contained' : 'outlined'} onClick={() => setForm((prev) => ({ ...prev, hasBasicFinance: !prev.hasBasicFinance }))}>Basic Finance</Button>
                    <Button variant={form.hasFullFinance ? 'contained' : 'outlined'} onClick={() => setForm((prev) => ({ ...prev, hasFullFinance: !prev.hasFullFinance }))}>Full Finance</Button>
                    <Button variant={form.hasApiAccess ? 'contained' : 'outlined'} onClick={() => setForm((prev) => ({ ...prev, hasApiAccess: !prev.hasApiAccess }))}>API Access</Button>
                  </Stack>
                </Paper>
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button variant="contained" type="submit" form="plan-form" disabled={saving}>
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default PlansPage;
