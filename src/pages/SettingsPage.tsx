import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  FormControlLabel,
  Switch,
  TextField,
  Button,
  Chip,
  Grid,
} from '@mui/material';
import Layout from '../components/Layout';
import { mockApiResponse } from '../services/dummyData';
import { useSnackbar } from 'notistack';

const SettingsPage: React.FC = () => {
  const [autoBackup, setAutoBackup] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [auditLogging, setAuditLogging] = useState(false);
  const [dataRetention, setDataRetention] = useState('5');
  const { enqueueSnackbar } = useSnackbar();

  const saveSettings = async () => {
    await mockApiResponse(true, 600);
    enqueueSnackbar('Settings saved', { variant: 'success' });
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            System Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage notification preferences, backups, and compliance controls.
          </Typography>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Platform Controls
                </Typography>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={<Switch checked={autoBackup} onChange={(e) => setAutoBackup(e.target.checked)} />}
                    label="Automatic Backups"
                  />
                  <FormControlLabel
                    control={<Switch checked={notifications} onChange={(e) => setNotifications(e.target.checked)} />}
                    label="Notifications"
                  />
                  <FormControlLabel
                    control={<Switch checked={auditLogging} onChange={(e) => setAuditLogging(e.target.checked)} />}
                    label="Audit Logging"
                  />
                </Stack>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Data Retention
                </Typography>
                <TextField
                  label="Keep data for (months)"
                  type="number"
                  value={dataRetention}
                  onChange={(e) => setDataRetention(e.target.value)}
                  InputProps={{ inputProps: { min: 1, max: 48 } }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Data older than the configured window is archived to cold storage.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Compliance Log
                </Typography>
                <Stack spacing={1}>
                  {['PCI Compliant payments', 'GDPR Data requests', 'Storage encryption'].map((item) => (
                    <Box key={item} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">{item}</Typography>
                      <Chip label="Active" color="success" size="small" />
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Scheduled Actions
                </Typography>
                <Stack spacing={2}>
                  <Button variant="outlined" onClick={() => mockApiResponse(true, 300).then(() => enqueueSnackbar('Reports refreshed', { variant: 'info' }))}>
                    Refresh Insights
                  </Button>
                  <Button variant="contained" onClick={saveSettings}>
                    Save Settings
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Layout>
  );
};

export default SettingsPage;
