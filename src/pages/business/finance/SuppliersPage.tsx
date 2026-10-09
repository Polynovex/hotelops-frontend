import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import { useSnackbar } from 'notistack';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/common/DataTable';
import { api } from '../../../services/api';
import { naira } from '../../../services/dailyRecords';
import { getApiErrorMessage } from '../../../utils/apiError';

/** Suppliers and creditors: debts, due dates, payments and what is outstanding. */

interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  overdue: number;
}
interface Bill {
  id: string;
  supplierId: string;
  supplier: { name: string };
  reference: string | null;
  description: string;
  amount: number;
  amountPaid: number;
  outstanding: number;
  dueDate: string;
  status: 'OPEN' | 'PART_PAID' | 'PAID';
  isOverdue: boolean;
}

export default function SuppliersPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState<'bills' | 'suppliers'>('bills');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [summary, setSummary] = useState<{ totalOutstanding: number; overdue: number; dueThisWeek: number } | null>(null);
  const [error, setError] = useState('');
  const [supplierForm, setSupplierForm] = useState<{ id?: string; name: string; contactName: string; phone: string; email: string } | null>(null);
  const [billForm, setBillForm] = useState<{ supplierId: string; description: string; reference: string; amount: string; dueDate: string } | null>(null);
  const [paying, setPaying] = useState<{ bill: Bill; amount: string; method: string; reference: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, b, sum] = await Promise.all([
        api.get('/finance/suppliers'),
        api.get('/finance/supplier-bills'),
        api.get('/finance/creditors/summary')
      ]);
      setSuppliers(s.data);
      setBills(b.data);
      setSummary(sum.data);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load suppliers'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, success: string, close: () => void) => {
    try {
      await action();
      enqueueSnackbar(success, { variant: 'success' });
      close();
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'That did not work'), { variant: 'error' });
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Suppliers & creditors</Typography>
            <Typography variant="body2" color="text.secondary">What the hotel owes, when it is due, and what has been paid.</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => setSupplierForm({ name: '', contactName: '', phone: '', email: '' })}>Add supplier</Button>
            <Button variant="contained" disabled={suppliers.length === 0} onClick={() => setBillForm({ supplierId: suppliers[0]?.id ?? '', description: '', reference: '', amount: '', dueDate: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10) })}>Record bill</Button>
          </Stack>
        </Stack>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {summary && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {[
              ['Total owed', summary.totalOutstanding, undefined],
              ['Overdue', summary.overdue, 'error.main'],
              ['Due this week', summary.dueThisWeek, 'warning.main']
            ].map(([label, value, colour]) => (
              <Grid item xs={12} sm={4} key={String(label)}>
                <Card><CardContent>
                  <Typography variant="body2" color="text.secondary">{label}</Typography>
                  <Typography variant="h5" fontWeight={800} color={colour as string | undefined}>{naira(Number(value))}</Typography>
                </CardContent></Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Tabs value={tab} onChange={(_event, value) => setTab(value)} sx={{ mb: 2 }}>
          <Tab value="bills" label="Bills" />
          <Tab value="suppliers" label="Suppliers" />
        </Tabs>

        {tab === 'bills' ? (
          <DataTable
            rows={bills}
            rowKey={(bill) => bill.id}
            defaultRowsPerPage={20}
            emptyText="No bills recorded."
            columns={[
              { key: 'supplier', label: 'Supplier', minWidth: 160, render: (bill) => bill.supplier.name },
              { key: 'description', label: 'Description', minWidth: 200 },
              { key: 'dueDate', label: 'Due', minWidth: 120, render: (bill) => (
                <Typography variant="body2" color={bill.isOverdue ? 'error.main' : undefined} fontWeight={bill.isOverdue ? 700 : 400}>
                  {new Date(bill.dueDate).toLocaleDateString()}{bill.isOverdue ? ' · overdue' : ''}
                </Typography>
              ) },
              { key: 'amount', label: 'Amount', minWidth: 120, render: (bill) => naira(bill.amount) },
              { key: 'amountPaid', label: 'Paid', minWidth: 120, render: (bill) => naira(bill.amountPaid) },
              { key: 'outstanding', label: 'Outstanding', minWidth: 120, render: (bill) => <strong>{naira(bill.outstanding)}</strong> },
              { key: 'status', label: 'Status', minWidth: 110, render: (bill) => <Chip size="small" label={bill.status.replace('_', ' ').toLowerCase()} color={bill.status === 'PAID' ? 'success' : bill.isOverdue ? 'error' : 'warning'} /> },
              { key: 'pay', label: '', minWidth: 100, render: (bill) => bill.status !== 'PAID' && (
                <Button size="small" onClick={() => setPaying({ bill, amount: String(bill.outstanding), method: 'TRANSFER', reference: '' })}>Pay</Button>
              ) }
            ]}
          />
        ) : (
          <DataTable
            rows={suppliers}
            rowKey={(supplier) => supplier.id}
            emptyText="No suppliers yet."
            columns={[
              { key: 'name', label: 'Supplier', minWidth: 180 },
              { key: 'contact', label: 'Contact', minWidth: 180, render: (s) => [s.contactName, s.phone, s.email].filter(Boolean).join(' · ') || '—' },
              { key: 'totalBilled', label: 'Billed', minWidth: 120, render: (s) => naira(s.totalBilled) },
              { key: 'totalPaid', label: 'Paid', minWidth: 120, render: (s) => naira(s.totalPaid) },
              { key: 'outstanding', label: 'Outstanding', minWidth: 120, render: (s) => <strong>{naira(s.outstanding)}</strong> },
              { key: 'overdue', label: 'Overdue', minWidth: 110, render: (s) => (s.overdue > 0 ? <Typography color="error.main" variant="body2" fontWeight={700}>{naira(s.overdue)}</Typography> : '—') },
              { key: 'edit', label: '', minWidth: 160, render: (s) => (
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => setSupplierForm({ id: s.id, name: s.name, contactName: s.contactName ?? '', phone: s.phone ?? '', email: s.email ?? '' })}>Edit</Button>
                  <Button size="small" color="error" onClick={() => void run(() => api.delete(`/finance/suppliers/${s.id}`), 'Supplier removed', () => undefined)}>Remove</Button>
                </Stack>
              ) }
            ]}
          />
        )}

        <Dialog open={Boolean(supplierForm)} onClose={() => setSupplierForm(null)} fullWidth maxWidth="xs">
          <DialogTitle>{supplierForm?.id ? 'Edit supplier' : 'Add supplier'}</DialogTitle>
          <DialogContent>
            {supplierForm && (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField label="Name" value={supplierForm.name} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} />
                <TextField label="Contact person" value={supplierForm.contactName} onChange={(event) => setSupplierForm({ ...supplierForm, contactName: event.target.value })} />
                <TextField label="Phone" value={supplierForm.phone} onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })} />
                <TextField label="Email" value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} />
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSupplierForm(null)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!supplierForm?.name.trim()}
              onClick={() => supplierForm && void run(
                () => {
                  const { id, ...body } = supplierForm;
                  return id ? api.put(`/finance/suppliers/${id}`, body) : api.post('/finance/suppliers', body);
                },
                'Supplier saved',
                () => setSupplierForm(null)
              )}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(billForm)} onClose={() => setBillForm(null)} fullWidth maxWidth="xs">
          <DialogTitle>Record a bill</DialogTitle>
          <DialogContent>
            {billForm && (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField select label="Supplier" value={billForm.supplierId} onChange={(event) => setBillForm({ ...billForm, supplierId: event.target.value })}>
                  {suppliers.filter((s) => s.isActive).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
                <TextField label="Description" value={billForm.description} onChange={(event) => setBillForm({ ...billForm, description: event.target.value })} />
                <TextField label="Invoice reference" value={billForm.reference} onChange={(event) => setBillForm({ ...billForm, reference: event.target.value })} />
                <TextField type="number" label="Amount (₦)" value={billForm.amount} onChange={(event) => setBillForm({ ...billForm, amount: event.target.value })} />
                <TextField type="date" label="Due date" value={billForm.dueDate} onChange={(event) => setBillForm({ ...billForm, dueDate: event.target.value })} InputLabelProps={{ shrink: true }} />
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBillForm(null)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!billForm?.description.trim() || !(Number(billForm?.amount) > 0)}
              onClick={() => billForm && void run(
                () => api.post('/finance/supplier-bills', { ...billForm, amount: Number(billForm.amount), reference: billForm.reference || undefined }),
                'Bill recorded',
                () => setBillForm(null)
              )}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(paying)} onClose={() => setPaying(null)} fullWidth maxWidth="xs">
          <DialogTitle>Pay {paying?.bill.supplier.name}</DialogTitle>
          <DialogContent>
            {paying && (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Typography variant="body2">{paying.bill.description} · {naira(paying.bill.outstanding)} outstanding</Typography>
                <TextField type="number" label="Amount (₦)" value={paying.amount} onChange={(event) => setPaying({ ...paying, amount: event.target.value })} />
                <TextField select label="Method" value={paying.method} onChange={(event) => setPaying({ ...paying, method: event.target.value })}>
                  {['TRANSFER', 'CASH', 'CARD', 'CHEQUE'].map((method) => <MenuItem key={method} value={method}>{method.charAt(0) + method.slice(1).toLowerCase()}</MenuItem>)}
                </TextField>
                <TextField label="Reference" value={paying.reference} onChange={(event) => setPaying({ ...paying, reference: event.target.value })} />
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPaying(null)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!(Number(paying?.amount) > 0)}
              onClick={() => paying && void run(
                () => api.post(`/finance/supplier-bills/${paying.bill.id}/payments`, { amount: Number(paying.amount), method: paying.method, reference: paying.reference || undefined }),
                'Payment recorded',
                () => setPaying(null)
              )}
            >
              Record payment
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
}
