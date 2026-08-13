import { useEffect, useMemo, useState } from 'react';
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
import { ReceiptLongOutlined } from '@mui/icons-material';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import { accountingService, ChartOfAccount, Journal } from '../../../services/api';
import { JournalEntrySchema, journalEntrySchema } from '../../../validation/accounting.schema';

const JournalsPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [journals, setJournals] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<JournalEntrySchema>({
    resolver: zodResolver(journalEntrySchema),
    defaultValues: {
      description: 'Manual adjustment',
      reference: '',
      amount: 0,
      debitAccount: '',
      creditAccount: ''
    }
  });

  const form = watch();

  const canSubmit = useMemo(() => {
    return Number(form.amount) > 0 && Boolean(form.debitAccount) && Boolean(form.creditAccount);
  }, [form]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [journalData, accountData] = await Promise.all([
        accountingService.getJournals(),
        accountingService.getChartOfAccounts()
      ]);
      setJournals(journalData);
      setAccounts(accountData);
      if (!form.debitAccount && accountData[0]) {
        setValue('debitAccount', accountData[0].accountCode);
        setValue('creditAccount', accountData[1]?.accountCode || accountData[0].accountCode);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load journals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createJournal = async (data: JournalEntrySchema) => {
    const amount = Number(data.amount);
    await accountingService.createJournal({
      journalDate: new Date().toISOString(),
      reference: data.reference,
      description: data.description,
      lines: [
        { accountCode: data.debitAccount, debit: amount, credit: 0, description: data.description },
        { accountCode: data.creditAccount, debit: 0, credit: amount, description: data.description }
      ]
    });
    reset({
      description: data.description,
      reference: '',
      amount: 0,
      debitAccount: data.debitAccount,
      creditAccount: data.creditAccount
    });
    await load();
  };

  const postJournal = async (journalId: string) => {
    await accountingService.postJournal(journalId);
    await load();
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Journals</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Create balanced manual journals and post drafts.</Typography>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Paper sx={{ p: 2, mb: 3 }}>
          <Box component="form" onSubmit={handleSubmit(createJournal)}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label="Description" error={Boolean(errors.description)} helperText={errors.description?.message} fullWidth {...register('description')} />
              <TextField label="Reference" error={Boolean(errors.reference)} helperText={errors.reference?.message} {...register('reference')} />
              <TextField type="number" label="Amount" error={Boolean(errors.amount)} helperText={errors.amount?.message} {...register('amount')} />
              <TextField select label="Debit" error={Boolean(errors.debitAccount)} helperText={errors.debitAccount?.message} value={form.debitAccount || ''} onChange={(e) => setValue('debitAccount', e.target.value)} sx={{ minWidth: 160 }}>
                {accounts.map((account) => <MenuItem key={account.id} value={account.accountCode}>{account.accountCode} - {account.accountName}</MenuItem>)}
              </TextField>
              <TextField select label="Credit" error={Boolean(errors.creditAccount)} helperText={errors.creditAccount?.message} value={form.creditAccount || ''} onChange={(e) => setValue('creditAccount', e.target.value)} sx={{ minWidth: 160 }}>
                {accounts.map((account) => <MenuItem key={account.id} value={account.accountCode}>{account.accountCode} - {account.accountName}</MenuItem>)}
              </TextField>
              <Button type="submit" variant="contained" disabled={!canSubmit}>Save Draft</Button>
            </Stack>
          </Box>
        </Paper>

        <Paper>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f7fa' }}>
                <TableCell sx={{ fontWeight: 700 }}>Number</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Debit</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Credit</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {journals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={<ReceiptLongOutlined />}
                      title="No journals yet"
                      description="Posted journal entries will appear here."
                    />
                  </TableCell>
                </TableRow>
              )}
              {journals.map((journal) => (
                <TableRow key={journal.id} hover>
                  <TableCell>{journal.journalNumber}</TableCell>
                  <TableCell>{new Date(journal.journalDate).toLocaleDateString()}</TableCell>
                  <TableCell>{journal.description || '—'}</TableCell>
                  <TableCell>{journal.status}</TableCell>
                  <TableCell>₦{Number(journal.totalDebit).toLocaleString()}</TableCell>
                  <TableCell>₦{Number(journal.totalCredit).toLocaleString()}</TableCell>
                  <TableCell>
                    {journal.status === 'DRAFT' ? (
                      <Button size="small" onClick={() => void postJournal(journal.id)}>Post</Button>
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

export default JournalsPage;
