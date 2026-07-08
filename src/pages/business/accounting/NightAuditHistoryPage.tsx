import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,

  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import { accountingService, NightAuditHistoryRecord } from '../../../services/api';

const NightAuditHistoryPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(30);
  const [history, setHistory] = useState<NightAuditHistoryRecord[]>([]);

  const load = async (nextLimit = limit) => {
    setLoading(true);
    setError('');
    try {
      setHistory(await accountingService.getNightAuditHistory(nextLimit));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load night audit history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString();
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Night Audit History
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Completed audits with journal references and daily totals.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.2}>
            <Button variant="outlined" onClick={() => navigate('/business/accounting/night-audit/status')}>
              Back To Status
            </Button>
          </Stack>
        </Stack>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <TextField
              type="number"
              label="History Limit"
              value={limit}
              onChange={(event) => setLimit(Math.max(1, Number(event.target.value || 1)))}
              sx={{ maxWidth: 200 }}
            />
            <Button variant="contained" onClick={() => void load(limit)} disabled={loading}>
              Load
            </Button>
          </Stack>
        </Paper>

        <Paper>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f7fa' }}>
                <TableCell sx={{ fontWeight: 700 }}>Audit Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Closed At</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Closed By</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Revenue</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>POS Total</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Difference</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Journal</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((audit) => (
                <TableRow key={audit.id} hover>
                  <TableCell>{formatDate(audit.auditDate)}</TableCell>
                  <TableCell>{formatDate(audit.closedAt)}</TableCell>
                  <TableCell>{audit.closedBy || '—'}</TableCell>
                  <TableCell>₦{Number(audit.totalRevenue || 0).toLocaleString()}</TableCell>
                  <TableCell>₦{Number(audit.totalPosSales || audit.posTotal || 0).toLocaleString()}</TableCell>
                  <TableCell>₦{Number(audit.difference || 0).toLocaleString()}</TableCell>
                  <TableCell>{audit.revenueJournalId || '—'}</TableCell>
                </TableRow>
              ))}
              {history.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="body2" color="text.secondary">
                      No night audit history available.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      </Container>
    </Layout>
  );
};

export default NightAuditHistoryPage;
