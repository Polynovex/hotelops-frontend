import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';
import { useNavigate } from 'react-router-dom';
import Layout from '../Layout';
import { FEATURE_LABEL, usePlanStore } from '../../store/planStore';

/** Shown in place of a page the business's plan does not include. */
const PlanUpgradeNotice = ({ feature }: { feature: string }) => {
  const navigate = useNavigate();
  const plan = usePlanStore((state) => state.plan);
  return (
    <Layout>
      <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
        <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, textAlign: 'center' }}>
          <Stack spacing={2} alignItems="center">
            <Box sx={{ width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'action.hover' }}>
              <WorkspacePremiumRounded color="secondary" sx={{ fontSize: 36 }} />
            </Box>
            <Typography variant="h5" fontWeight={800}>Available on Enterprise</Typography>
            <Typography color="text.secondary">
              {FEATURE_LABEL[feature] ?? 'This feature'} is part of the Enterprise plan
              {plan?.name ? `. Your business is on ${plan.name}.` : '.'} Contact HotelOpX to upgrade.
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
