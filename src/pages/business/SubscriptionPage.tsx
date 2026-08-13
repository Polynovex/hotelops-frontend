import Layout from '../../components/Layout';
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
  LinearProgress,
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
import CheckIcon from '@mui/icons-material/Check';
import RemoveIcon from '@mui/icons-material/Remove';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import { api } from '../../services/api';
import { formatNaira } from '../../services/hr.service';
import { EmptyState } from '../../components/premium';

type FeatureMap = Record<string, boolean>;

interface Subscription {
  business: { name: string; status: string; trialEnd: string | null; billingCycle: string };
  plan: {
    code: string;
    name: string;
    monthlyPriceNgn: number;
    annualPriceNgn: number;
    isCustomPriced: boolean;
    supportLevel: string;
  } | null;
  usage: Record<string, { used: number; limit: number | null; percent: number | null }>;
  features: FeatureMap;
  modules: { pms: boolean; pos: boolean; finance: boolean };
}

interface PlanOption {
  code: string;
  name: string;
  monthlyPriceNgn: number;
  annualPriceNgn: number;
  maxRooms: number | null;
  maxUsers: number | null;
  maxPosTerminals: number | null;
  maxProperties: number | null;
  supportLevel: string;
  features: FeatureMap;
}

/** Features shown in the comparison table, in the order customers care about. */
const COMPARISON_FEATURES: Array<[key: string, label: string]> = [
  ['PMS', 'Property Management'],
  ['POS', 'Point of Sale'],
  ['FINANCE', 'Basic Finance'],
  ['FULL_FINANCE', 'Full Finance & Ledger'],
  ['HR', 'HR & Payroll'],
  ['INVENTORY', 'Inventory'],
  ['HOUSEKEEPING', 'Housekeeping'],
  ['ADVANCED_REPORTS', 'Advanced Reports'],
  ['MULTI_PROPERTY', 'Multi-Property'],
  ['CHANNEL_MANAGER', 'Channel Manager'],
  ['DYNAMIC_PRICING', 'Dynamic Pricing'],
  ['LOYALTY', 'Loyalty Programme'],
  ['WHITE_LABEL', 'White-Label Branding'],
  ['DEDICATED_SUPPORT', 'Dedicated Account Manager']
];

const USAGE_LABELS: Record<string, string> = {
  rooms: 'Rooms',
  users: 'Users',
  posTerminals: 'POS terminals',
  staff: 'Staff records'
};

const SubscriptionPage = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [requestPlan, setRequestPlan] = useState<PlanOption | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subResponse, plansResponse] = await Promise.all([
        api.get('/subscription'),
        api.get('/subscription/plans')
      ]);
      setSubscription(subResponse.data as Subscription);
      setPlans(Array.isArray(plansResponse.data) ? plansResponse.data : []);
      setError('');
    } catch {
      setError('Failed to load your subscription');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitRequest = async () => {
    if (!requestPlan) {
      return;
    }

    setSending(true);
    try {
      const { data } = await api.post('/subscription/upgrade-request', {
        planCode: requestPlan.code,
        note: note.trim() || undefined
      });
      setToast(data?.message || 'Request submitted');
      setRequestPlan(null);
      setNote('');
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      setError(response?.data?.error || 'Failed to submit request');
    } finally {
      setSending(false);
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
      <Typography variant="h4" fontWeight={700}>
        Subscription
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Your current plan, usage, and what each tier includes.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {subscription && (
        <>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ md: 'center' }}
              spacing={2}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText'
                  }}
                >
                  <WorkspacePremiumIcon />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {subscription.plan?.name || 'No plan assigned'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {subscription.plan
                      ? `${formatNaira(subscription.plan.monthlyPriceNgn)}/month${
                          subscription.plan.isCustomPriced ? ' (custom pricing)' : ''
                        }`
                      : 'Contact support to choose a plan'}
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={subscription.business.status}
                  color={subscription.business.status === 'ACTIVE' ? 'success' : 'warning'}
                  size="small"
                />
                {subscription.business.trialEnd && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Trial ends ${new Date(subscription.business.trialEnd).toLocaleDateString()}`}
                  />
                )}
              </Stack>
            </Stack>
          </Paper>

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
            Usage
          </Typography>
          <Grid container spacing={2.5} sx={{ mb: 4 }}>
            {Object.entries(subscription.usage).map(([key, value]) => (
              <Grid item xs={12} sm={6} md={3} key={key}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {USAGE_LABELS[key] || key}
                  </Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {value.used}
                    {value.limit != null && (
                      <Typography component="span" variant="body2" color="text.secondary">
                        {' '}
                        / {value.limit}
                      </Typography>
                    )}
                  </Typography>
                  {value.percent != null ? (
                    <>
                      <LinearProgress
                        variant="determinate"
                        value={value.percent}
                        color={value.percent >= 90 ? 'error' : value.percent >= 75 ? 'warning' : 'primary'}
                        sx={{ mt: 1.5, height: 6, borderRadius: 3 }}
                      />
                      {value.percent >= 90 && (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                          Approaching your plan limit
                        </Typography>
                      )}
                    </>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      Unlimited
                    </Typography>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
            Your features
          </Typography>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 4 }}>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {COMPARISON_FEATURES.map(([key, label]) => (
                <Chip
                  key={key}
                  size="small"
                  label={label}
                  icon={subscription.features[key] ? <CheckIcon /> : <RemoveIcon />}
                  color={subscription.features[key] ? 'success' : 'default'}
                  variant={subscription.features[key] ? 'filled' : 'outlined'}
                />
              ))}
            </Stack>
          </Paper>
        </>
      )}

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
        Compare plans
      </Typography>
      {plans.length === 0 && (
        <Paper variant="outlined" sx={{ borderRadius: 2 }}>
          <EmptyState
            icon={<WorkspacePremiumIcon />}
            title="No plans available"
            description="Plan options could not be loaded. Please contact support."
          />
        </Paper>
      )}
      {plans.length > 0 && (
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 200 }}>Feature</TableCell>
              {plans.map((plan) => (
                <TableCell key={plan.code} align="center">
                  <Typography variant="body2" fontWeight={700}>
                    {plan.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {plan.monthlyPriceNgn > 0 ? `${formatNaira(plan.monthlyPriceNgn)}/mo` : 'Custom'}
                  </Typography>
                  {subscription?.plan?.code === plan.code ? (
                    <Chip size="small" label="Current" color="primary" sx={{ mt: 0.5 }} />
                  ) : (
                    <Button size="small" sx={{ mt: 0.5 }} onClick={() => setRequestPlan(plan)}>
                      Request
                    </Button>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Rooms</TableCell>
              {plans.map((plan) => (
                <TableCell key={plan.code} align="center">
                  {plan.maxRooms ?? 'Unlimited'}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell>Users</TableCell>
              {plans.map((plan) => (
                <TableCell key={plan.code} align="center">
                  {plan.maxUsers ?? 'Unlimited'}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell>POS terminals</TableCell>
              {plans.map((plan) => (
                <TableCell key={plan.code} align="center">
                  {plan.maxPosTerminals ?? 'Unlimited'}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell>Properties</TableCell>
              {plans.map((plan) => (
                <TableCell key={plan.code} align="center">
                  {plan.maxProperties ?? 'Unlimited'}
                </TableCell>
              ))}
            </TableRow>

            {COMPARISON_FEATURES.map(([key, label]) => (
              <TableRow key={key} hover>
                <TableCell>{label}</TableCell>
                {plans.map((plan) => (
                  <TableCell key={plan.code} align="center">
                    {plan.features[key] ? (
                      <CheckIcon fontSize="small" color="success" aria-label="Included" />
                    ) : (
                      <RemoveIcon fontSize="small" sx={{ color: 'text.disabled' }} aria-label="Not included" />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}

            <TableRow>
              <TableCell>Support</TableCell>
              {plans.map((plan) => (
                <TableCell key={plan.code} align="center">
                  <Typography variant="caption">{plan.supportLevel}</Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      )}

      <Dialog open={Boolean(requestPlan)} onClose={() => setRequestPlan(null)} fullWidth maxWidth="sm">
        <DialogTitle>Request {requestPlan?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            We will contact you to confirm billing before anything changes. Your current plan stays
            active until then.
          </Typography>
          <TextField
            label="Anything we should know? (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            fullWidth
            multiline
            minRows={3}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRequestPlan(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => void submitRequest()} disabled={sending}>
            {sending ? 'Sending…' : 'Send request'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={5000}
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
const SubscriptionPageWithLayout = () => (
  <Layout>
    <SubscriptionPage />
  </Layout>
);

export default SubscriptionPageWithLayout;
