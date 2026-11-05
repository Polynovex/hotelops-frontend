import { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography } from '@mui/material';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import { useSnackbar } from 'notistack';
import { printReceipt, receiptApi } from '../../utils/receipt';
import { formatCurrency } from '../../utils/formatters';
import { getApiErrorMessage } from '../../utils/apiError';

type Row = { id: string; receiptNumber: string; amount: number; paymentMethod: string; createdAt: string };

/** Every payment on a stay, each with its numbered receipt to print or email. */
const StayReceipts = ({ bookingId, guestEmail }: { bookingId: string; guestEmail?: string | null }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [emailing, setEmailing] = useState<Row | null>(null);
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    receiptApi.forBooking(bookingId).then(setRows).catch(() => setRows([]));
  }, [bookingId]);

  const print = async (row: Row) => {
    try {
      await printReceipt(await receiptApi.forTransaction(row.id));
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not print the receipt'), { variant: 'error' });
    }
  };

  const send = async () => {
    if (!emailing) return;
    setBusy(true);
    try {
      await receiptApi.email(emailing.id, to.trim());
      enqueueSnackbar(`Receipt ${emailing.receiptNumber} sent to ${to.trim()}`, { variant: 'success' });
      setEmailing(null);
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not send the receipt'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (!rows) return null;
  return (
    <Paper sx={{ p: 3 }}>
      <Typography fontWeight={800} sx={{ mb: 1 }}>Receipts</Typography>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No payments on this stay yet.</Typography>
      ) : (
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {rows.map((row) => (
            <Stack key={row.id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ py: 1 }}>
              <Box>
                <Typography variant="body2" fontWeight={700}>{row.receiptNumber}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(row.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · {row.paymentMethod.replace(/_/g, ' ').toLowerCase()}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" fontWeight={700} sx={{ minWidth: 110, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(row.amount)}</Typography>
                <Button size="small" startIcon={<PrintRoundedIcon />} onClick={() => void print(row)}>Print</Button>
                <Button size="small" startIcon={<MailOutlineRoundedIcon />} onClick={() => { setTo(guestEmail ?? ''); setEmailing(row); }}>Email</Button>
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
      <Dialog open={Boolean(emailing)} onClose={() => setEmailing(null)} fullWidth maxWidth="xs">
        <DialogTitle>Email receipt {emailing?.receiptNumber}</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth type="email" label="Send to" value={to} onChange={(e) => setTo(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailing(null)}>Cancel</Button>
          <Button variant="contained" disabled={busy || !/^\S+@\S+\.\S+$/.test(to.trim())} onClick={() => void send()}>{busy ? 'Sending…' : 'Send'}</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default StayReceipts;
