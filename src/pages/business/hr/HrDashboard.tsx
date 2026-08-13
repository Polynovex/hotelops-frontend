import HrTabs from './HrTabs';
import Layout from '../../../components/Layout';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Grid,
  Stack,
  Typography
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import PaymentsIcon from '@mui/icons-material/Payments';
import { formatNaira, hrService, type HrDashboardData } from '../../../services/hr.service';

/** HR landing page: headline staff, attendance, leave, and payroll numbers. */
const HrDashboard = () => {
  const [data, setData] = useState<HrDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    hrService
      .getDashboard()
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          // A plan without HR returns FEATURE_DISABLED; show that plainly.
          const message =
            err?.response?.data?.error === 'FEATURE_DISABLED'
              ? 'The HR module is not included in your current plan.'
              : err?.response?.data?.message || 'Failed to load HR dashboard';
          setError(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <HrTabs />
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            HR & Payroll
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Staff, attendance, leave, and monthly payroll.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button component={RouterLink} to="/business/hr/staff" variant="outlined">
            Staff
          </Button>
          <Button component={RouterLink} to="/business/hr/payroll" variant="contained">
            Payroll
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {data && (
        <>
          <Grid container spacing={2.5}>
            <MetricCard
              label="Total staff"
              value={String(data.staff.total)}
              detail={`${data.staff.active} active · ${data.staff.onLeave} on leave`}
              icon={<PeopleIcon />}
              to="/business/hr/staff"
            />
            <MetricCard
              label="Present today"
              value={String(data.attendance.presentToday)}
              detail={`of ${data.staff.active} active staff`}
              icon={<EventAvailableIcon />}
              to="/business/hr/attendance"
            />
            <MetricCard
              label="Pending leave"
              value={String(data.leave.pending)}
              detail={data.leave.pending > 0 ? 'Awaiting your approval' : 'Nothing to review'}
              icon={<BeachAccessIcon />}
              to="/business/hr/leave"
            />
            <MetricCard
              label="Draft payroll"
              value={formatNaira(data.payroll.draftNetTotal)}
              detail={`${data.payroll.draftCount} run${data.payroll.draftCount === 1 ? '' : 's'} not yet processed`}
              icon={<PaymentsIcon />}
              to="/business/hr/payroll"
            />
          </Grid>

          {data.staff.total === 0 && (
            <Alert severity="info" sx={{ mt: 3 }}>
              No staff records yet. Add your first employee to start tracking attendance and payroll.
            </Alert>
          )}
        </>
      )}
    </Container>
  );
};

const MetricCard = ({
  label,
  value,
  detail,
  icon,
  to
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  to: string;
}) => (
  <Grid item xs={12} sm={6} lg={3}>
    <Card
      variant="outlined"
      component={RouterLink}
      to={to}
      sx={{
        borderRadius: 2,
        height: '100%',
        textDecoration: 'none',
        transition: 'all 200ms ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
      }}
    >
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'action.hover',
              color: 'primary.main'
            }}
          >
            {icon}
          </Box>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {label}
          </Typography>
        </Stack>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      </CardContent>
    </Card>
  </Grid>
);

/**
 * Wrapped in Layout so this page carries the same sidebar, header, and
 * page chrome as the rest of the dashboard. Wrapping at the export keeps
 * the loading and error early-returns inside the shell too.
 */
const HrDashboardWithLayout = () => (
  <Layout>
    <HrDashboard />
  </Layout>
);

export default HrDashboardWithLayout;
