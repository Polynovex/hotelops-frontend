import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import CreditCardRounded from '@mui/icons-material/CreditCardRounded';
import { api } from '../../services/api';

/**
 * Starts a card payment for a booking or a restaurant order.
 *
 * Reusable rather than built into one page, because the same action is needed
 * at the front desk settling a folio and at the till closing a table, and the
 * awkward parts are identical in both: which providers this property has
 * actually connected, and what to do with the page the provider gives back.
 *
 * Two things it deliberately does not do. It never sends an amount — the
 * server reads that from the booking balance or order total, so nothing here
 * can influence what is charged. And it never marks anything paid; it opens
 * the provider's page and stops. Settlement comes from the signed webhook.
 */

interface Gateway {
  provider: 'PAYSTACK' | 'FLUTTERWAVE';
  publicKey: string | null;
  environment: 'TEST' | 'LIVE';
}

interface Props {
  bookingId?: string;
  posOrderId?: string;
  /** Shown for confirmation only; never sent to the server. */
  amount?: number;
  /** Prefills the receipt address where we already hold one. */
  defaultEmail?: string;
  onStarted?: () => void;
  size?: 'small' | 'medium' | 'large';
}

const LABEL: Record<Gateway['provider'], string> = {
  PAYSTACK: 'Paystack',
  FLUTTERWAVE: 'Flutterwave'
};

export function CardPaymentButton({
  bookingId,
  posOrderId,
  amount,
  defaultEmail,
  onStarted,
  size = 'small'
}: Props) {
  const [open, setOpen] = useState(false);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [provider, setProvider] = useState<string>('');
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadingGateways, setLoadingGateways] = useState(false);

  useEffect(() => {
    if (!open) return;

    setLoadingGateways(true);
    setError('');

    api
      .get('/payments/gateways/available')
      .then(({ data }) => {
        const list: Gateway[] = data ?? [];
        setGateways(list);
        // One provider is the common case; skip a choice with one option.
        if (list.length === 1) setProvider(list[0].provider);
      })
      .catch(() => setError('Could not load the payment providers for this property.'))
      .finally(() => setLoadingGateways(false));
  }, [open]);

  const start = async () => {
    setBusy(true);
    setError('');

    try {
      const { data } = await api.post('/payments/checkout', {
        bookingId,
        posOrderId,
        provider,
        email: email.trim() || undefined
      });

      /*
       * Opened in a new tab rather than navigating away. A receptionist has
       * the guest in front of them and a screen full of context; replacing it
       * with a payment page and hoping the back button restores everything is
       * how half-finished check-ins happen.
       */
      window.open(data.authorizationUrl, '_blank', 'noopener,noreferrer');
      setOpen(false);
      onStarted?.();
    } catch (err: any) {
      setError(
        err?.response?.data?.message
          ?? 'Could not start the payment. Nothing has been charged.'
      );
    } finally {
      setBusy(false);
    }
  };

  const noneConfigured = !loadingGateways && gateways.length === 0;

  return (
    <>
      <Button size={size} startIcon={<CreditCardRounded />} onClick={() => setOpen(true)}>
        Pay by card
      </Button>

      <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Take a card payment</DialogTitle>
        <DialogContent>
          {amount !== undefined && (
            <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
              &#8358;{amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </Typography>
          )}

          {noneConfigured ? (
            <Alert severity="info">
              No card provider is switched on for this property yet. A business
              admin can connect Paystack or Flutterwave under Settings &rarr;
              Payment Integrations.
            </Alert>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <DialogContentText sx={{ fontSize: 14 }}>
                The guest will be taken to the provider&apos;s secure page. The
                bill is only marked paid once the provider confirms it.
              </DialogContentText>

              <TextField
                select
                fullWidth
                label="Provider"
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                disabled={loadingGateways || busy}
              >
                {gateways.map((gateway) => (
                  <MenuItem key={gateway.provider} value={gateway.provider}>
                    {LABEL[gateway.provider]}
                    {gateway.environment === 'TEST' && ' — test mode'}
                  </MenuItem>
                ))}
              </TextField>

              {/*
                Required by both providers, and it is where the receipt goes.
                Asked for here rather than failing after the fact, because the
                guest is standing at the desk now and will not be later.
              */}
              <TextField
                fullWidth
                type="email"
                label="Guest email (for the receipt)"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
              />

              {gateways.some((g) => g.provider === provider && g.environment === 'TEST') && (
                <Alert severity="warning">
                  This provider is in test mode. No real money will move.
                </Alert>
              )}
            </Stack>
          )}

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void start()}
            disabled={busy || noneConfigured || !provider || !email.trim()}
          >
            {busy ? 'Starting…' : 'Open payment page'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
