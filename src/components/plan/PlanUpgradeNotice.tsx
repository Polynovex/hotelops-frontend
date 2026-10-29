import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';
import { useNavigate } from 'react-router-dom';
import Layout from '../Layout';
import { FEATURE_LABEL, usePlanStore } from '../../store/planStore';

/** Shown in place of a page the business's plan does not include. */
/** Add-ons are switched on per business; the rest come with a plan. */
const ADD_ON_FEATURES = new Set(['EVENTS', 'MINIBAR', 'HR']);
const PLANS_WITH: Record<string, string> = { PROMOTIONS: 'Professional and Enterprise plans', FULL_FINANCE: 'Enterprise plan' };

const PlanUpgradeNotice = ({ feature }: { feature: string }) => {
  const navigate = useNavigate();
  const plan = usePlanStore((state) => state.plan);
  const isAddOn = ADD_ON_FEATURES.has(feature);
  const title = feature === 'HR' ? 'HR & payroll is not switched on' : isAddOn ? 'Add-on not switched on' : feature === 'PROMOTIONS' ? 'Available on Professional' : 'Available on Enterprise';
  return (
    <Layout>
      <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
        <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, textAlign: 'center' }}>
          <Stack spacing={2} alignItems="center">
            <Box sx={{ width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'action.hover' }}>
              <WorkspacePremiumRounded color="secondary" sx={{ fontSize: 36 }} />
            </Box>
            <Typography variant="h5" fontWeight={800}>{title}</Typography>
            <Typography color="text.secondary">
              {isAddOn
                ? `${FEATURE_LABEL[feature] ?? 'This add-on'} is not switched on for your business. Contact HotelOpX to add it.`
                : `${FEATURE_LABEL[feature] ?? 'This feature'} comes with the ${PLANS_WITH[feature] ?? 'Enterprise plan'}${plan?.name ? `. Your business is on ${plan.name}` : ''}. Contact HotelOpX to upgrade.`}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="contained" onClick={() => navigate('/business/subscription')}>See plans</Button>
              <Button onClick={() => navigate(-1)}>Go back</Button>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Layout>
  );
};

export default PlanUpgradeNotice;
