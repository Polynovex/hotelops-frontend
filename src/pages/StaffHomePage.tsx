import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Grid, Paper, Stack, Typography } from '@mui/material';
import Layout from '../components/Layout';
import ShiftOvertimeCard from '../components/hr/ShiftOvertimeCard';
import { useAuthStore } from '../store/authStore';
import { scheduleService, type ShiftScheduleRecord } from '../services/loyalty.service';

/**
 * Dashboard for staff who only provide services (security, laundry,
 * grounds…): their shifts and a way into Staff Hub, nothing operational.
 */
const StaffHomePage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [shifts, setShifts] = useState<ShiftScheduleRecord[]>([]);

  useEffect(() => {
    scheduleService.mine().then(({ schedules }) => setShifts(schedules.filter((s) => new Date(s.endsAt) > new Date()).slice(0, 7))).catch(() => setShifts([]));
  }, []);

  const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography variant="h4" fontWeight={800}>Hello, {user?.firstName ?? ''}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Your shifts and your Staff Hub.</Typography>
        <ShiftOvertimeCard />
        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography fontWeight={800} sx={{ mb: 1 }}>Upcoming shifts</Typography>
              {shifts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No shifts planned.</Typography>
              ) : (
                <Stack spacing={0.75}>
                  {shifts.map((s) => (
                    <Stack key={s.id} direction="row" justifyContent="space-between">
                      <Typography variant="body2">{when(s.startsAt)}</Typography>
                      <Typography variant="body2" color="text.secondary">until {new Date(s.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={5}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography fontWeight={800} sx={{ mb: 1 }}>Staff Hub</Typography>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Clock in and out, payslips, leave and your attendance.</Typography>
                <Button variant="contained" onClick={() => navigate('/my-hr')}>Open Staff Hub</Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Layout>
  );
};

export default StaffHomePage;
