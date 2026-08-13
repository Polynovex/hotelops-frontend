import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { EmptyState } from '../../../components/premium';
import { AccountTreeOutlined } from '@mui/icons-material';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import { accountingService, ChartOfAccount } from '../../../services/api';
import { ChartOfAccountSchema, chartOfAccountSchema } from '../../../validation/accounting.schema';

const ChartOfAccountsPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ChartOfAccountSchema>({
    resolver: zodResolver(chartOfAccountSchema),
    defaultValues: {
      accountCode: '',
      accountName: '',
      accountType: 'EXPENSE',
      openingBalance: 0
    }
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setAccounts(await accountingService.getChartOfAccounts());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async (data: ChartOfAccountSchema) => {
    await accountingService.createChartOfAccount({
      accountCode: data.accountCode,
      accountName: data.accountName,
      accountType: data.accountType,
      openingBalance: data.openingBalance
    });
    reset();
    await load();
  };

  const handleDeactivate = async (accountCode: string) => {
    await accountingService.deactivateChartOfAccount(accountCode);
    await load();
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Chart of Accounts</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>v3 accounting endpoint wiring for account setup and maintenance.</Typography>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Paper sx={{ p: 2, mb: 3 }}>
          <Box component="form" onSubmit={handleSubmit(handleCreate)}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label="Code" error={Boolean(errors.accountCode)} helperText={errors.accountCode?.message} {...register('accountCode')} />
              <TextField label="Name" error={Boolean(errors.accountName)} helperText={errors.accountName?.message} fullWidth {...register('accountName')} />
              <TextField select label="Type" error={Boolean(errors.accountType)} helperText={errors.accountType?.message} defaultValue="EXPENSE" {...register('accountType')}>
                <MenuItem value="ASSET">ASSET</MenuItem>
                <MenuItem value="LIABILITY">LIABILITY</MenuItem>
                <MenuItem value="EQUITY">EQUITY</MenuItem>
                <MenuItem value="INCOME">INCOME</MenuItem>
                <MenuItem value="EXPENSE">EXPENSE</MenuItem>
              </TextField>
              <TextField type="number" label="Opening" error={Boolean(errors.openingBalance)} helperText={errors.openingBalance?.message} {...register('openingBalance')} />
              <Button type="submit" variant="contained">Add</Button>
            </Stack>
          </Box>
        </Paper>

        <Paper>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f7fa' }}>
                <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Balance</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Active</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={<AccountTreeOutlined />}
                      title="No accounts yet"
                      description="Add a chart of accounts to start posting transactions."
                    />
                  </TableCell>
                </TableRow>
              )}
              {accounts.map((account) => (
                <TableRow key={account.id} hover>
                  <TableCell>{account.accountCode}</TableCell>
                  <TableCell>{account.accountName}</TableCell>
                  <TableCell>{account.accountType}</TableCell>
                  <TableCell>₦{Number(account.currentBalance || 0).toLocaleString()}</TableCell>
                  <TableCell>{account.isActive ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    {account.isActive ? (
                      <Button size="small" color="error" onClick={() => void handleDeactivate(account.accountCode)}>
                        Deactivate
                      </Button>
                    ) : '—'}
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

export default ChartOfAccountsPage;
