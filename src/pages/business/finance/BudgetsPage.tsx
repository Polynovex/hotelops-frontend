import React, { useEffect, useMemo, useState } from 'react';
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
import Layout from '../../../components/Layout';
import { api } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * Monthly operating-expense budgets. Finance reports compare each line's
 * budget with what the approved daily records actually spent.
 */

type Category = { key: string; label: string };
type BudgetRow = { category: string; amount: number };
type Comparison = { category: string; budget: number; actual: number; difference: number };

const money = (value: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value || 0);

const BudgetsPage: React.FC = () => {
  const isOwner = useAuthStore((state) => state.user?.role === 'BUSINESS_ADMIN');
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [categories, setCategories] = useState<Category[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [comparison, setComparison] = useState<Comparison[]>([]);
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus({});
    api
      .get<{ categories: Category[]; budgets: BudgetRow[] }>('/finance/budgets', { params: { period } })
      .then(({ data }) => {
        setCategories(data.categories);
        setAmounts(Object.fromEntries(data.budgets.map((row) => [row.category, String(row.amount)])));
      })
      .catch((err) => setStatus({ error: getApiErrorMessage(err, 'Could not load budgets') }));

    const [year, month] = period.split('-').map(Number);
    const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    api
      .get('/finance/reports/summary', { params: { from: `${period}-01`, to: last, period: 'monthly' } })
      .then(({ data }) => setComparison(data?.periods?.find((row: { period: string }) => row.period === period)?.budgetVsActual ?? []))
      .catch(() => setComparison([]));
  }, [period]);

  const labelOf = useMemo(() => new Map(categories.map((c) => [c.key, c.label])), [categories]);
  const total = Object.values(amounts).reduce((sum, value) => sum + (Number(value) || 0), 0);

  const save = async () => {
    setSaving(true);
    setStatus({});
    try {
      await api.put('/finance/budgets', {
        period,
        budgets: categories.map((c) => ({ category: c.key, amount: Number(amounts[c.key] || 0) }))
      });
      setStatus({ ok: `Budget for ${period} saved.` });
    } catch (err) {
      setStatus({ error: getApiErrorMessage(err, 'Could not save budgets') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800}>Operating expense budgets</Typography>
            <Typography variant="body2" color="text.secondary">Set each month's budget; reports show budget, actual and the difference.</Typography>
          </Box>
          <TextField size="small" type="month" label="Month" InputLabelProps={{ shrink: true }} value={period} onChange={(e) => setPeriod(e.target.value)} />
        </Stack>
        {status.ok && <Alert severity="success" sx={{ mb: 2 }}>{status.ok}</Alert>}
        {status.error && <Alert severity="error" sx={{ mb: 2 }}>{status.error}</Alert>}

        <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Expense</TableCell>
                <TableCell align="right" sx={{ width: 200 }}>Budget</TableCell>
                <TableCell align="right">Actual</TableCell>
                <TableCell align="right">Difference</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories.map((category) => {
                const row = comparison.find((c) => c.category === category.key);
                const budget = Number(amounts[category.key] || 0);
                const actual = row?.actual ?? 0;
                const difference = budget - actual;
                return (
                  <TableRow key={category.key}>
                    <TableCell>{category.label}</TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={amounts[category.key] ?? ''}
                        onChange={(e) => setAmounts({ ...amounts, [category.key]: e.target.value })}
                        disabled={!isOwner}
                        inputProps={{ min: 0, style: { textAlign: 'right' } }}
                      />
                    </TableCell>
                    <TableCell align="right">{money(actual)}</TableCell>
                    <TableCell align="right" sx={{ color: difference < 0 ? 'error.main' : 'success.main', fontWeight: 700 }}>
                      {money(difference)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {comparison
                .filter((row) => !labelOf.has(row.category))
                .map((row) => (
                  <TableRow key={row.category}>
                    <TableCell>{row.category}</TableCell>
                    <TableCell align="right">—</TableCell>
                    <TableCell align="right">{money(row.actual)}</TableCell>
                    <TableCell align="right">{money(-row.actual)}</TableCell>
                  </TableRow>
                ))}
              <TableRow>
                <TableCell><strong>Total</strong></TableCell>
                <TableCell align="right"><strong>{money(total)}</strong></TableCell>
                <TableCell align="right"><strong>{money(comparison.reduce((s, r) => s + r.actual, 0))}</strong></TableCell>
                <TableCell align="right"><strong>{money(total - comparison.reduce((s, r) => s + r.actual, 0))}</strong></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Paper>
        {isOwner ? (
          <Button variant="contained" sx={{ mt: 2 }} onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save budget'}
          </Button>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Only the Business Admin sets budgets.</Typography>
        )}
      </Container>
    </Layout>
  );
};

export default BudgetsPage;
