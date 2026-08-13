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
import LoyaltyIcon from '@mui/icons-material/Loyalty';
import RedeemIcon from '@mui/icons-material/Redeem';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { formatNaira } from '../../services/hr.service';
import {
  loyaltyService,
  TIER_COLOR,
  type LoyaltyAccount,
  type LoyaltyProgram
} from '../../services/loyalty.service';
import { EmptyState, MetricCard, PageHeader } from '../../components/premium';

/**
 * Loyalty programme management. Outstanding points are shown as a naira
 * liability, since that is what they actually represent on the books.
 */
const LoyaltyPage = () => {
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [detail, setDetail] = useState<LoyaltyAccount | null>(null);
  const [action, setAction] = useState<{ account: LoyaltyAccount; mode: 'earn' | 'redeem' } | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [programData, accountList] = await Promise.all([
        loyaltyService.getProgram(),
        loyaltyService.listAccounts()
      ]);
      setProgram(programData);
      setAccounts(accountList);
      setError('');
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string; message?: string } } }).response;
      setError(
        response?.data?.error === 'FEATURE_DISABLED'
          ? 'The loyalty programme is not included in your current plan.'
          : response?.data?.message || 'Failed to load loyalty data'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (account: LoyaltyAccount) => {
    try {
      setDetail(await loyaltyService.getAccount(account.id));
    } catch {
      setError('Failed to load member history');
    }
  };

  const submitAction = async () => {
    if (!action) {
      return;
    }

    const points = Number(amount);
    if (!Number.isFinite(points) || points <= 0) {
      setError('Enter a positive number');
      return;
    }

    setBusy(true);
    try {
      if (action.mode === 'earn') {
        await loyaltyService.earn(action.account.id, { points });
        setToast(`${points} points awarded`);
      } else {
        const result = await loyaltyService.redeem(action.account.id, points);
        setToast(`${points} points redeemed (${formatNaira(result?.valueNgn || 0)})`);
      }
      setAction(null);
      setAmount('');
      await load();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      setError(response?.data?.error || 'Action failed');
    } finally {
      setBusy(false);
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
      <PageHeader title="Loyalty" subtitle="Guest rewards, points balances, and redemption." />

      {error && (
        <Alert severity={error.includes('plan') ? 'warning' : 'error'} sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {program && (
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} lg={3}>
            <MetricCard label="Members" value={program.stats.members} icon={<LoyaltyIcon />} />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <MetricCard
              label="Points outstanding"
              value={program.stats.pointsOutstanding.toLocaleString()}
              detail="Unredeemed across all members"
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <MetricCard
              label="Liability"
              value={formatNaira(program.stats.liabilityNgn)}
              detail="If every point were redeemed today"
              variant="navy"
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <MetricCard
              label="Earn rate"
              value={`${program.pointsPerNaira} pt/₦`}
              detail={`${formatNaira(program.nairaPerPoint)} per point · min ${program.minRedemption}`}
            />
          </Grid>
        </Grid>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Member</TableCell>
              <TableCell>Number</TableCell>
              <TableCell>Tier</TableCell>
              <TableCell align="right">Balance</TableCell>
              <TableCell align="right">Lifetime</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={<LoyaltyIcon />}
                    title="No members yet"
                    description="Enrol guests from their profile to start awarding points."
                  />
                </TableCell>
              </TableRow>
            )}

            {accounts.map((account) => (
              <TableRow key={account.id} hover>
                <TableCell>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => void openDetail(account)}
                  >
                    {account.guest ? `${account.guest.firstName} ${account.guest.lastName}` : '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {account.guest?.phone || account.guest?.email || ''}
                  </Typography>
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{account.memberNumber}</TableCell>
                <TableCell>
                  <Chip size="small" label={account.tier} color={TIER_COLOR[account.tier]} />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={700}>
                    {account.pointsBalance.toLocaleString()}
                  </Typography>
                </TableCell>
                <TableCell align="right">{account.lifetimePoints.toLocaleString()}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      size="small"
                      startIcon={<AddCircleIcon />}
                      onClick={() => {
                        setAction({ account, mode: 'earn' });
                        setAmount('');
                      }}
                    >
                      Award
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<RedeemIcon />}
                      disabled={program ? account.pointsBalance < program.minRedemption : true}
                      onClick={() => {
                        setAction({ account, mode: 'redeem' });
                        setAmount('');
                      }}
                    >
                      Redeem
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(action)} onClose={() => setAction(null)} fullWidth maxWidth="xs">
        <DialogTitle>{action?.mode === 'earn' ? 'Award points' : 'Redeem points'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {action?.account.guest
              ? `${action.account.guest.firstName} ${action.account.guest.lastName}`
              : ''}{' '}
            · balance {action?.account.pointsBalance.toLocaleString()}
          </Typography>
          <TextField
            label="Points"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            fullWidth
            autoFocus
            helperText={
              action?.mode === 'redeem' && program
                ? `Minimum ${program.minRedemption} · worth ${formatNaira(
                    (Number(amount) || 0) * program.nairaPerPoint
                  )}`
                : undefined
            }
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAction(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => void submitAction()} disabled={busy}>
            {busy ? 'Working…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} fullWidth maxWidth="sm">
        <DialogTitle>Points history</DialogTitle>
        <DialogContent>
          <Stack spacing={0.5}>
            {(detail?.transactions || []).length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                No transactions yet.
              </Typography>
            )}
            {(detail?.transactions || []).map((txn) => (
              <Stack
                key={txn.id}
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <Chip
                  size="small"
                  label={txn.type}
                  color={txn.type === 'EARN' || txn.type === 'ADJUST' ? 'success' : 'default'}
                />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    {txn.description || '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(txn.createdAt).toLocaleString()}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  fontWeight={700}
                  color={txn.type === 'EARN' || txn.type === 'ADJUST' ? 'success.main' : 'text.primary'}
                >
                  {txn.type === 'EARN' || txn.type === 'ADJUST' ? '+' : '−'}
                  {txn.points}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 56, textAlign: 'right' }}>
                  {txn.balanceAfter}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDetail(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3500}
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
const LoyaltyPageWithLayout = () => (
  <Layout>
    <LoyaltyPage />
  </Layout>
);

export default LoyaltyPageWithLayout;
