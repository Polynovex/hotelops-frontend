import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,

  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import { accountingService, NightAuditStatus, NightAuditValidationResult } from '../../../services/api';

const NightAuditValidatePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<NightAuditStatus | null>(null);
  const [auditDate, setAuditDate] = useState('');
  const [result, setResult] = useState<NightAuditValidationResult | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const currentStatus = await accountingService.getNightAuditStatus();
      setStatus(currentStatus);
      if (currentStatus.businessDate) {
        setAuditDate(currentStatus.businessDate.slice(0, 10));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load night audit status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const validate = async () => {
    if (!auditDate) {
      setError('Audit date is required');
      return;
    }

    setValidating(true);
    setError('');
    try {
      const validation = await accountingService.validateNightAudit({ auditDate });
      setResult(validation);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Night audit validation failed');
    } finally {
      setValidating(false);
    }
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Validate Night Audit
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Verify prerequisites and compare reception/POS snapshot before closing day.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.2}>
            <Button variant="outlined" onClick={() => void loadStatus()} disabled={loading || validating}>
              Refresh
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate('/business/accounting/night-audit/run')}
            >
              Go To Run
            </Button>
          </Stack>
        </Stack>

        {(loading || validating) && <LogoLoader inline minHeight={160} label={validating ? 'Validating audit' : 'Loading'} />}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <TextField
                type="date"
                label="Audit Date"
                value={auditDate}
                onChange={(event) => setAuditDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <Typography variant="body2" color="text.secondary">
                Current business date: {status?.businessDate ? new Date(status.businessDate).toLocaleDateString() : '—'}
              </Typography>
              <Button variant="contained" onClick={() => void validate()} disabled={validating}>
                Validate
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Validation Result
                </Typography>
                <Chip size="small" color={result.valid ? 'success' : 'error'} label={result.valid ? 'VALID' : 'INVALID'} />
              </Stack>

              {!result.valid && result.errors.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {result.errors.join(' | ')}
                </Alert>
              )}

              {result.snapshot && (
                <Grid container spacing={1.5}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2">Total Revenue: ₦{Number(result.snapshot.totalRevenue).toLocaleString()}</Typography>
                    <Typography variant="body2">POS Total: ₦{Number(result.snapshot.posTotal).toLocaleString()}</Typography>
                    <Typography variant="body2">Check-outs: {result.snapshot.checkoutCount}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2">Cash: ₦{Number(result.snapshot.receptionTotals.cash).toLocaleString()}</Typography>
                    <Typography variant="body2">Card: ₦{Number(result.snapshot.receptionTotals.card).toLocaleString()}</Typography>
                    <Typography variant="body2">Transfer: ₦{Number(result.snapshot.receptionTotals.transfer).toLocaleString()}</Typography>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        )}
      </Container>
    </Layout>
  );
};

export default NightAuditValidatePage;
