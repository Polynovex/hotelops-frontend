import { FormEvent, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,

  MenuItem,
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
import LogoLoader from '../../../components/LogoLoader';
import { accountingService, Budget, ChartOfAccount } from '../../../services/api';

const BudgetsPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [variance, setVariance] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({ budgetName: 'FY 2026', fiscalYear: '2026', accountCode: '', monthly: '100000' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [budgetData, accountData] = await Promise.all([
        accountingService.getBudgets(),
        accountingService.getChartOfAccounts()
      ]);
      setBudgets(budgetData);
      setAccounts(accountData);
      if (!form.accountCode && accountData[0]) {
        setForm((prev) => ({ ...prev, accountCode: accountData[0].accountCode }));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load budgets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createBudget = async (event: FormEvent) => {
    event.preventDefault();
    const monthly = Number(form.monthly || 0);
    await accountingService.createBudget({
      budgetName: form.budgetName,
      fiscalYear: Number(form.fiscalYear),
      accountCode: form.accountCode,
      period1: monthly,
      period2: monthly,
      period3: monthly,
      period4: monthly,
      period5: monthly,
      period6: monthly,
      period7: monthly,
      period8: monthly,
      period9: monthly,
      period10: monthly,
      period11: monthly,
      period12: monthly
    });
    await load();
  };

  const viewVariance = async (budgetId: string) => {
    setVariance(await accountingService.getBudgetVariance(budgetId));
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Budgets</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Manage annual budgets and variance analysis.</Typography>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Paper sx={{ p: 2, mb: 3 }}>
          <Box component="form" onSubmit={createBudget}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label="Budget Name" value={form.budgetName} onChange={(e) => setForm((prev) => ({ ...prev, budgetName: e.target.value }))} required />
              <TextField label="Fiscal Year" value={form.fiscalYear} onChange={(e) => setForm((prev) => ({ ...prev, fiscalYear: e.target.value }))} required />
              <TextField select label="Account" value={form.accountCode} onChange={(e) => setForm((prev) => ({ ...prev, accountCode: e.target.value }))} sx={{ minWidth: 220 }}>
                {accounts.map((account) => <MenuItem key={account.id} value={account.accountCode}>{account.accountCode} - {account.accountName}</MenuItem>)}
              </TextField>
              <TextField type="number" label="Monthly Amount" value={form.monthly} onChange={(e) => setForm((prev) => ({ ...prev, monthly: e.target.value }))} required />
              <Button type="submit" variant="contained">Save Budget</Button>
            </Stack>
          </Box>
        </Paper>

        {variance && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Variance loaded for {String((variance.budget as Record<string, unknown>)?.budgetName || 'budget')}.
          </Alert>
        )}

        <Paper>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f7fa' }}>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Year</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Account</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Version</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {budgets.map((budget) => (
                <TableRow key={budget.id} hover>
                  <TableCell>{budget.budgetName}</TableCell>
                  <TableCell>{budget.fiscalYear}</TableCell>
                  <TableCell>{budget.accountCode}</TableCell>
                  <TableCell>{budget.version}</TableCell>
                  <TableCell>₦{Number(budget.total).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => void viewVariance(budget.id)}>Variance</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Container>
    </Layout>
  );
};

export default BudgetsPage;
