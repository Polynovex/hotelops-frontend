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
import { accountingService, BankAccount, BankTransaction } from '../../../services/api';

const BankReconciliationPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [statementBalance, setStatementBalance] = useState('0');
  const [newAccount, setNewAccount] = useState({ accountName: '', accountNumber: '', bankName: '', openingBalance: '0' });

  const loadAccounts = async () => {
    const data = await accountingService.getBankAccounts();
    setAccounts(data);
    if (!selectedAccountId && data[0]) {
      setSelectedAccountId(data[0].id);
    }
  };

  const loadTransactions = async (accountId: string) => {
    if (!accountId) return;
    const data = await accountingService.getBankTransactions(accountId);
    setTransactions(data.transactions || []);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      await loadAccounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load bank data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      void loadTransactions(selectedAccountId);
    }
  }, [selectedAccountId]);

  const createAccount = async (event: FormEvent) => {
    event.preventDefault();
    await accountingService.createBankAccount({
      accountName: newAccount.accountName,
      accountNumber: newAccount.accountNumber,
      bankName: newAccount.bankName,
      currency: 'NGN',
      openingBalance: Number(newAccount.openingBalance || 0)
    });
    setNewAccount({ accountName: '', accountNumber: '', bankName: '', openingBalance: '0' });
    await load();
  };

  const importSampleStatement = async () => {
    if (!selectedAccountId) return;
    await accountingService.importBankStatement({
      bankAccountId: selectedAccountId,
      rows: [
        {
          transactionDate: new Date().toISOString(),
          description: 'Sample imported settlement',
          reference: `IMP-${Date.now()}`,
          amount: 45000,
          transactionType: 'DEPOSIT'
        }
      ]
    });
    await loadTransactions(selectedAccountId);
  };

  const reconcile = async () => {
    if (!selectedAccountId) return;
    await accountingService.reconcileBank({
      bankAccountId: selectedAccountId,
      statementDate: new Date().toISOString(),
      statementBalance: Number(statementBalance || 0),
      transactionIds: transactions.map((item) => item.id)
    });
    await loadTransactions(selectedAccountId);
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Bank Reconciliation</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Wire statement import and reconciliation to v3 accounting endpoints.</Typography>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Paper sx={{ p: 2, mb: 3 }}>
          <Box component="form" onSubmit={createAccount}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label="Account Name" value={newAccount.accountName} onChange={(e) => setNewAccount((prev) => ({ ...prev, accountName: e.target.value }))} required />
              <TextField label="Account Number" value={newAccount.accountNumber} onChange={(e) => setNewAccount((prev) => ({ ...prev, accountNumber: e.target.value }))} required />
              <TextField label="Bank Name" value={newAccount.bankName} onChange={(e) => setNewAccount((prev) => ({ ...prev, bankName: e.target.value }))} required />
              <TextField type="number" label="Opening" value={newAccount.openingBalance} onChange={(e) => setNewAccount((prev) => ({ ...prev, openingBalance: e.target.value }))} />
              <Button type="submit" variant="contained">Add Account</Button>
            </Stack>
          </Box>
        </Paper>

        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            <TextField select label="Bank Account" value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} sx={{ minWidth: 260 }}>
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>{account.bankName} - {account.accountNumber}</MenuItem>
              ))}
            </TextField>
            <TextField type="number" label="Statement Balance" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} />
            <Button variant="outlined" onClick={() => void importSampleStatement()} disabled={!selectedAccountId}>Import Sample Statement</Button>
            <Button variant="contained" onClick={() => void reconcile()} disabled={!selectedAccountId}>Reconcile</Button>
          </Stack>
        </Paper>

        <Paper>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f7fa' }}>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id} hover>
                  <TableCell>{new Date(transaction.transactionDate).toLocaleDateString()}</TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell>{transaction.reference || '—'}</TableCell>
                  <TableCell>{transaction.transactionType}</TableCell>
                  <TableCell>₦{Number(transaction.amount).toLocaleString()}</TableCell>
                  <TableCell>{transaction.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Container>
    </Layout>
  );
};

export default BankReconciliationPage;
