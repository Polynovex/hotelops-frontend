import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import HourglassEmptyRounded from '@mui/icons-material/HourglassEmptyRounded';

/**
 * Where Paystack and Flutterwave send the payer once they are finished.
 *
 * Deliberately unauthenticated: the person landing here may be a guest who
 * scanned a QR code at a restaurant table and has no account. It is also
 * deliberately incapable of deciding anything — the page reports what the
 * server says, and the server asks the payment provider directly. A page
 * cannot mark a bill paid, however it was reached.
 *
 * The provider redirects the moment the payer finishes, which is often a
 * second or two before the payment actually settles. So this polls rather
 * than asking once: a single check would frequently show "not paid" for a
 * payment that was about to succeed, and send the guest back to the desk to
 * argue about it.
 */

/** Roughly a minute of polling. Beyond that, a person should look at it. */
const POLL_INTERVAL_MS = 2500;
const MAX_ATTEMPTS = 24;

type Status = 'checking' | 'paid' | 'pending' | 'failed' | 'unknown';

export default function PaymentReturn() {
  const [params] = useSearchParams();
  const reference = params.get('ref') ?? '';

  const [status, setStatus] = useState<Status>('checking');
  const [amount, setAmount] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const attempts = useRef(0);

  const check = useCallback(async () => {
    if (!reference) {
      setStatus('unknown');
      setMessage('This link is missing its payment reference.');
      return true;
    }

    try {
      /*
       * The public endpoint, not the authenticated one. Using `fetch` rather
       * than the shared api client on purpose: that client attaches a token
       * and redirects to the login page on a 401, which is exactly the wrong
       * behaviour for a guest who has no account.
       */
      const base = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${base}/public/payment/${encodeURIComponent(reference)}`);

      if (response.status === 404) {
        setStatus('unknown');
        setMessage('We have no record of this payment.');
        return true;
      }

      if (!response.ok) {
        // A provider check that failed is not a failed payment. Keep polling.
        return false;
      }

      const data = await response.json();
      if (typeof data.amount === 'number') setAmount(data.amount);

      if (data.status === 'COMPLETED') {
        setStatus('paid');
        return true;
      }

      if (data.status === 'FAILED') {
        setStatus('failed');
        return true;
      }

      return false;
    } catch {
      // Offline or a dropped connection; the payment is unaffected.
      return false;
    }
  }, [reference]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const run = async () => {
      const settled = await check();
      if (cancelled || settled) return;

      attempts.current += 1;
      if (attempts.current >= MAX_ATTEMPTS) {
        setStatus('pending');
        return;
      }

      timer = setTimeout(run, POLL_INTERVAL_MS);
    };

    void run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [check]);

  const view = {
    checking: {
      icon: <CircularProgress />,
      title: 'Confirming your payment',
      body: 'This usually takes a few seconds. Please do not close this page.',
      severity: 'info' as const
    },
    paid: {
      icon: <CheckCircleRounded sx={{ fontSize: 64, color: 'success.main' }} />,
      title: 'Payment received',
      body: 'Thank you. Your payment has been recorded against your bill.',
      severity: 'success' as const
    },
    pending: {
      icon: <HourglassEmptyRounded sx={{ fontSize: 64, color: 'warning.main' }} />,
      title: 'Still confirming',
      body:
        'Your bank has not confirmed this yet. If money has left your account it will be recorded automatically — show this page to a member of staff rather than paying again.',
      severity: 'warning' as const
    },
    failed: {
      icon: <ErrorOutlineRounded sx={{ fontSize: 64, color: 'error.main' }} />,
      title: 'Payment not completed',
      body: 'No money has been taken. You can try again, or pay at the desk.',
      severity: 'error' as const
    },
    unknown: {
      icon: <ErrorOutlineRounded sx={{ fontSize: 64, color: 'text.disabled' }} />,
      title: 'We could not find this payment',
      body: 'Please speak to a member of staff, who can look it up by your reference.',
      severity: 'error' as const
    }
  }[status];

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
        <Stack spacing={3} alignItems="center">
          {view.icon}

          <Box>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              {view.title}
            </Typography>
            <Typography color="text.secondary">{view.body}</Typography>
          </Box>

          {amount !== null && (
            <Typography variant="h4" fontWeight={700}>
              ₦{amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </Typography>
          )}

          {/*
            The reference is the only thing a guest can hand to staff when
            something needs looking up, so it is shown in every outcome —
            including success, where it is their receipt.
          */}
          {reference && (
            <Alert severity={view.severity} sx={{ width: '100%', textAlign: 'left' }}>
              <Typography variant="body2">
                Reference
                <Box component="span" sx={{ display: 'block', fontFamily: 'monospace', fontWeight: 700 }}>
                  {reference}
                </Box>
              </Typography>
            </Alert>
          )}

          {message && <Typography color="text.secondary">{message}</Typography>}

          {status === 'failed' && (
            <Button variant="contained" onClick={() => window.history.back()}>
              Try again
            </Button>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
