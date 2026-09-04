import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Layout from '../../../components/Layout';
import RowActionsMenu from '../../../components/common/RowActionsMenu';
import { formatNaira } from '../../../services/hr.service';
import financeService, {
  PAYMENT_METHODS,
  type Expense,
  type ExpenseStatus,
  type ExpenseTotals
} from '../../../services/finance.service';

const STATUS_COLOR: Record<ExpenseStatus, 'warning' | 'success' | 'error'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error'
};

const today = () => new Date().toISOString().slice(0, 10);

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } }).response?.data?.message
  ?? (err as { response?: { data?: { error?: string } } }).response?.data?.error
  ?? fallback;

type FormState = {
  expenseDate: string;
  category: string;
  description: string;
  amount: string;
  paymentMethod: string;
  vendor: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  expenseDate: today(),
  category: '',
  description: '',
  amount: '',
  paymentMethod: 'CASH',
  vendor: '',
  notes: ''
});

/**
 * Daily operating expenditure for the accountant. Recording is quick — this is
 * filled in many times a day — while approval is a separate, deliberate step.
 */
const DailyExpensesPage = () => {
  const [rows, setRows] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<ExpenseTotals>({ pending: 0, approved: 0, rejected: 0, net: 0 });
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | ''>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [editing, setEditing] = useState<Expense | null>(null);
  const [pendingReject, setPendingReject] = useState<Expense | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);

  const setField = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await financeService.listExpenses({
        from,
        to,
        status: statusFilter,
        limit: rowsPerPage,
        offset: page * rowsPerPage
      });
      setRows(result.data);
      setTotal(result.total);
      setTotals(result.totals);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load expenses'));
    } finally {
      setLoading(false);
    }
  }, [from, to, statusFilter, page, rowsPerPage]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    financeService
      .listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!form.category || !form.description.trim()) {
      setError('Category and description are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        expenseDate: form.expenseDate,
        category: form.category,
        description: form.description.trim(),
        amount,
        paymentMethod: form.paymentMethod,
        vendor: form.vendor.trim() || undefined,
        notes: form.notes.trim() || undefined
      } as Partial<Expense>;

      if (editing) {
        await financeService.updateExpense(editing.id, payload);
        setToast('Expense updated');
        setEditing(null);
      } else {
        await financeService.createExpense(payload);
        setToast('Expense recorded');
      }

      // Keep the date so a run of entries for the same day stays quick.
      setForm((prev) => ({ ...emptyForm(), expenseDate: prev.expenseDate }));
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not save the expense'));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setForm({
      expenseDate: expense.expenseDate.slice(0, 10),
      category: expense.category,
      description: expense.description,
      amount: String(expense.amount),
      paymentMethod: expense.paymentMethod,
      vendor: expense.vendor ?? '',
      notes: expense.notes ?? ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const approve = async (expense: Expense) => {
    try {
      await financeService.approveExpense(expense.id);
      setToast(`${expense.reference} approved`);
      await load();
    } catch (err) {
      // The server refuses self-approval; surface that reason verbatim.
      setError(errorMessage(err, 'Could not approve the expense'));
    }
  };

  const confirmReject = async () => {
    if (!pendingReject || !rejectReason.trim()) {
      return;
    }
    try {
      await financeService.rejectExpense(pendingReject.id, rejectReason.trim());
      setToast(`${pendingReject.reference} rejected`);
      setPendingReject(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not reject the expense'));
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    try {
      await financeService.deleteExpense(pendingDelete.id);
      setToast('Expense deleted');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the expense'));
    } finally {
      setPendingDelete(null);
    }
  };

  /**
   * The field set, shared by the inline create form and the edit dialog.
   *
   * Editing used to reuse the same card at the top of the page, so the only
   * signal you were amending an existing entry rather than recording a new one
   * was a changed heading well above the fields — easy to miss, and easy to
   * overwrite an expense by accident.
   */
  const expenseFields = (
    <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  label="Date"
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setField('expenseDate', e.target.value)}
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ max: today() }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select
                  label="Category"
                  value={form.category}
                  onChange={(e) => setField('category', e.target.value)}
                  fullWidth
                  required
                >
                  {categories.map((entry) => (
                    <MenuItem key={entry} value={entry}>{entry}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Description"
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  fullWidth
                  required
                  placeholder="e.g. 200 litres diesel for generator"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Amount (₦)"
                  type="number"
                  value={form.amount}
                  onChange={(e) => setField('amount', e.target.value)}
                  fullWidth
                  required
                  inputProps={{ min: 0, step: '0.01' }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select
                  label="Paid by"
                  value={form.paymentMethod}
                  onChange={(e) => setField('paymentMethod', e.target.value)}
                  fullWidth
                >
                  {PAYMENT_METHODS.map((entry) => (
                    <MenuItem key={entry} value={entry}>{entry.replace('_', ' ')}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Vendor (optional)"
                  value={form.vendor}
                  onChange={(e) => setField('vendor', e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Notes (optional)"
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  fullWidth
                />
              </Grid>
    </Grid>
  );
  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>Daily Expenditure</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Record what the business spends each day. Entries stay pending until someone
          else approves them, so no single person can both spend and sign off.
        </Typography>

        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          {[
            { label: 'Pending approval', value: totals.pending, color: 'warning.main' },
            { label: 'Approved', value: totals.approved, color: 'success.main' },
            { label: 'Total for period', value: totals.net, color: 'text.primary' }
          ].map((card) => (
            <Grid item xs={12} sm={4} key={card.label}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">{card.label}</Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ color: card.color }}>
                    {formatNaira(card.value)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Recording is inline; editing opens a dialog so an amendment can never
            be mistaken for a new entry. */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            Record an expense
          </Typography>
          <form onSubmit={submit}>
            {expenseFields}
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? 'Saving…' : 'Record'}
              </Button>
            </Stack>
          </form>
        </Paper>

        <Dialog
          open={Boolean(editing)}
          onClose={() => { setEditing(null); setForm(emptyForm()); }}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle>Edit {editing?.reference}</DialogTitle>
          <DialogContent>
            <Box component="form" id="edit-expense-form" onSubmit={submit} sx={{ pt: 1 }}>
              {expenseFields}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => { setEditing(null); setForm(emptyForm()); }}>
              Cancel
            </Button>
            <Button type="submit" form="edit-expense-form" variant="contained" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogActions>
        </Dialog>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="From"
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(0); }}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To"
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(0); }}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              select
              label="Status"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as ExpenseStatus | ''); setPage(0); }}
              size="small"
              sx={{ minWidth: { md: 180 } }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="PENDING">Pending</MenuItem>
              <MenuItem value="APPROVED">Approved</MenuItem>
              <MenuItem value="REJECTED">Rejected</MenuItem>
            </TextField>
          </Stack>
        </Paper>

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Reference</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Paid by</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              )}

              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No expenses recorded for this period.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {!loading && rows.map((expense) => (
                <TableRow key={expense.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {expense.reference}
                    </Typography>
                  </TableCell>
                  <TableCell>{new Date(expense.expenseDate).toLocaleDateString()}</TableCell>
                  <TableCell>{expense.category}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{expense.description}</Typography>
                    {expense.vendor && (
                      <Typography variant="caption" color="text.secondary">
                        {expense.vendor}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>
                      {formatNaira(expense.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell>{expense.paymentMethod.replace('_', ' ')}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={expense.status}
                      color={STATUS_COLOR[expense.status]}
                    />
                    {expense.rejectionReason && (
                      <Typography variant="caption" color="error" display="block">
                        {expense.rejectionReason}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <RowActionsMenu
                      subject={expense.reference}
                      actions={[
                        {
                          key: 'approve',
                          label: 'Approve',
                          icon: <CheckCircleIcon fontSize="small" />,
                          hidden: expense.status !== 'PENDING',
                          onClick: () => void approve(expense)
                        },
                        {
                          key: 'edit',
                          label: 'Edit',
                          icon: <EditIcon fontSize="small" />,
                          disabled: expense.status === 'APPROVED',
                          disabledReason: 'Approved expenses cannot be edited',
                          onClick: () => openEdit(expense)
                        },
                        {
                          key: 'reject',
                          label: 'Reject',
                          icon: <CancelIcon fontSize="small" />,
                          destructive: true,
                          hidden: expense.status !== 'PENDING',
                          onClick: () => { setRejectReason(''); setPendingReject(expense); }
                        },
                        {
                          key: 'delete',
                          label: 'Delete',
                          icon: <DeleteOutlineIcon fontSize="small" />,
                          destructive: true,
                          disabled: expense.status === 'APPROVED',
                          disabledReason: 'Approved expenses cannot be deleted',
                          onClick: () => setPendingDelete(expense)
                        }
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_e, next) => setPage(next)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
            rowsPerPageOptions={[25, 50, 100]}
          />
        </TableContainer>

        <Dialog open={Boolean(pendingReject)} onClose={() => setPendingReject(null)} fullWidth maxWidth="sm">
          <DialogTitle>Reject {pendingReject?.reference}?</DialogTitle>
          <DialogContent>
            <TextField
              label="Reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              fullWidth
              required
              multiline
              rows={3}
              sx={{ mt: 1 }}
              helperText="Shown to whoever recorded the expense, and kept in the audit log."
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPendingReject(null)}>Cancel</Button>
            <Button
              color="error"
              variant="contained"
              disabled={!rejectReason.trim()}
              onClick={() => void confirmReject()}
            >
              Reject expense
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
          <DialogTitle>Delete this expense?</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              <strong>{pendingDelete?.reference}</strong> will be removed permanently.
              To keep a record of a spend that was refused, reject it instead.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={Boolean(toast)}
          autoHideDuration={3000}
          onClose={() => setToast('')}
          message={toast}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Container>
    </Layout>
  );
};

export default DailyExpensesPage;
