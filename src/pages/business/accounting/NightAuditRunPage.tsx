import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,

  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import { accountingService, NightAuditRunResult, NightAuditStatus } from '../../../services/api';

const NightAuditRunPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<NightAuditStatus | null>(null);
  const [result, setResult] = useState<NightAuditRunResult | null>(null);
  const [form, setForm] = useState({
    auditDate: '',
    outstandingAR: 0,
    notes: ''
  });

  const loadStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const currentStatus = await accountingService.getNightAuditStatus();
      setStatus(currentStatus);
      setForm((prev) => ({
        ...prev,
        auditDate: currentStatus.businessDate ? currentStatus.businessDate.slice(0, 10) : prev.auditDate
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load night audit status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const runAudit = async () => {
    if (!form.auditDate) {
      setError('Audit date is required');
      return;
    }

    setRunning(true);
    setError('');
    try {
      const validation = await accountingService.validateNightAudit({ auditDate: form.auditDate });
      if (!validation.valid) {
        throw new Error(validation.errors.join(' | ') || 'Validation failed');
      }

      const runResult = await accountingService.runNightAudit({
        auditDate: form.auditDate,
        verification: {
          outstandingAR: Number(form.outstandingAR || 0),
          notes: form.notes.trim()
        }
      });
      setResult(runResult);
      await loadStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Night audit run failed');
    } finally {
      setRunning(false);
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
              Run Night Audit
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Posts daily journals, closes current day, and opens next business day.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.2}>
            <Button variant="outlined" onClick={() => void loadStatus()} disabled={loading || running}>
              Refresh
            </Button>
            <Button variant="outlined" onClick={() => navigate('/business/accounting/night-audit/history')}>
              View History
            </Button>
          </Stack>
        </Stack>

        {(loading || running) && <LogoLoader inline minHeight={160} label={running ? 'Running night audit' : 'Loading'} />}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Alert severity="warning" sx={{ mb: 2 }}>
          Running night audit locks transactions on or before the audit date and advances the business date.
        </Alert>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack spacing={2}>
              <TextField
                type="date"
                label="Audit Date"
                value={form.auditDate}
                onChange={(event) => setForm((prev) => ({ ...prev, auditDate: event.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                type="number"
                label="Outstanding AR"
                value={form.outstandingAR}
                onChange={(event) => setForm((prev) => ({ ...prev, outstandingAR: Number(event.target.value || 0) }))}
                helperText="Optional manual AR adjustment included in closing."
              />
              <TextField
                label="Notes"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                multiline
                minRows={3}
              />
              <Button variant="contained" onClick={() => void runAudit()} disabled={running}>
                Run Night Audit
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Current Lock State
            </Typography>
            <Typography variant="body2">
              Locked Until: {status?.lockedUntil ? new Date(status.lockedUntil).toLocaleString() : '—'}
            </Typography>
            <Typography variant="body2">
              Business Date: {status?.businessDate ? new Date(status.businessDate).toLocaleString() : '—'}
            </Typography>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                Audit Completed
              </Typography>
              <Typography variant="body2">Audit ID: {result.auditId}</Typography>
              <Typography variant="body2">Journal ID: {result.journalId || '—'}</Typography>
              <Typography variant="body2">Date Closed: {new Date(result.dateClosed).toLocaleString()}</Typography>
              <Typography variant="body2">New Business Date: {new Date(result.newBusinessDate).toLocaleString()}</Typography>
            </CardContent>
          </Card>
        )}
      </Container>
    </Layout>
  );
};

export default NightAuditRunPage;
