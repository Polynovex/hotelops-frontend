import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField
} from '@mui/material';
import { hrService, myHrService, type AttendanceRecord } from '../../services/hr.service';

/**
 * Clock-in / clock-out for the signed-in user, with the two prompts the
 * approval workflow needs:
 *
 *  - Late clock-in. The server refuses with LATE_REASON_REQUIRED and says how
 *    late; the user is asked why and the clock-in is retried with the reason.
 *    Asking only after the server says "late" keeps the rule (work period,
 *    grace, timezone) in one place.
 *  - Overtime at clock-out. If the day accrued overtime the user may explain
 *    it for HR. Optional — overtime is pending HR approval either way.
 *
 * Returns the action and the dialog element to render.
 */

type ClockDirection = 'in' | 'out';

/** GPS when the browser offers it within 5s; never blocks the clock action. */
const getPosition = () =>
  new Promise<{ lat?: number; lng?: number; method: string }>((resolve) => {
    if (!navigator.geolocation) {
      resolve({ method: 'MANUAL' });
      return;
    }
    const timer = setTimeout(() => resolve({ method: 'MANUAL' }), 5000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude, method: 'GPS' });
      },
      () => {
        clearTimeout(timer);
        resolve({ method: 'MANUAL' });
      },
      { timeout: 5000 }
    );
  });

type ApiError = { response?: { data?: { error?: string; message?: string; lateMinutes?: number } } };

export const useClockAction = ({
  onDone,
  onError
}: {
  onDone: (message: string) => void | Promise<void>;
  onError: (message: string) => void;
}) => {
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<
    | { kind: 'late'; message: string; position: Awaited<ReturnType<typeof getPosition>> }
    | { kind: 'overtime'; record: AttendanceRecord }
    | null
  >(null);
  const [reason, setReason] = useState('');
  const [promptError, setPromptError] = useState('');

  const closePrompt = () => {
    setPrompt(null);
    setReason('');
    setPromptError('');
  };

  const clockIn = async (position: Awaited<ReturnType<typeof getPosition>>, lateReason?: string) => {
    await hrService.clockIn({ method: position.method, lat: position.lat, lng: position.lng, lateReason });
    closePrompt();
    await onDone(lateReason ? 'Clocked in — your reason was sent to HR' : 'Clocked in');
  };

  const clock = async (direction: ClockDirection) => {
    setBusy(true);
    const position = await getPosition();
    try {
      if (direction === 'in') {
        await clockIn(position);
      } else {
        const record = await hrService.clockOut({ method: position.method, lat: position.lat, lng: position.lng });
        if (record.overtimeHours > 0) {
          setPrompt({ kind: 'overtime', record });
        }
        await onDone(
          record.overtimeHours > 0
            ? `Clocked out — ${record.overtimeHours.toFixed(2)}h overtime is pending HR approval`
            : 'Clocked out'
        );
      }
    } catch (err) {
      const data = (err as ApiError).response?.data;
      if (direction === 'in' && data?.error === 'LATE_REASON_REQUIRED') {
        setPrompt({ kind: 'late', message: data.message ?? 'You are late. Give a reason to clock in.', position });
      } else {
        onError(data?.message || data?.error || `Could not clock ${direction}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const submitPrompt = async () => {
    if (!prompt) return;
    const text = reason.trim();
    setBusy(true);
    setPromptError('');
    try {
      if (prompt.kind === 'late') {
        if (!text) {
          setPromptError('A reason is required for a late clock-in.');
          return;
        }
        await clockIn(prompt.position, text);
      } else {
        if (text) {
          await myHrService.requestOvertime(prompt.record.id, text);
          await onDone('Overtime reason sent to HR');
        }
        closePrompt();
      }
    } catch (err) {
      const data = (err as ApiError).response?.data;
      setPromptError(data?.message || data?.error || 'Could not submit');
    } finally {
      setBusy(false);
    }
  };

  const dialog = (
    <Dialog open={Boolean(prompt)} onClose={() => !busy && closePrompt()} fullWidth maxWidth="xs">
      <DialogTitle>{prompt?.kind === 'late' ? 'Late clock-in' : 'Overtime recorded'}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {prompt?.kind === 'late'
            ? prompt.message
            : prompt?.kind === 'overtime'
              ? `You worked ${prompt.record.overtimeHours.toFixed(2)}h beyond the standard day. Tell HR why so it can be approved.`
              : ''}
        </DialogContentText>
        {promptError && <Alert severity="error" sx={{ mb: 2 }}>{promptError}</Alert>}
        <TextField
          fullWidth
          autoFocus
          multiline
          minRows={2}
          label={prompt?.kind === 'late' ? 'Reason for lateness' : 'Reason for overtime (optional)'}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          inputProps={{ maxLength: 500 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={closePrompt} disabled={busy}>
          {prompt?.kind === 'late' ? 'Cancel' : 'Skip'}
        </Button>
        <Button variant="contained" onClick={() => void submitPrompt()} disabled={busy}>
          {prompt?.kind === 'late' ? 'Clock in' : 'Send to HR'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return { clock, busy, dialog };
};
