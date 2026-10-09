import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress
} from '@mui/material';
import { useAuthStore } from '../store/authStore';

/**
 * Signs a user out after a period of inactivity.
 *
 * Front-desk and POS screens are shared and left unattended; a session that
 * outlives the person who opened it lets the next person at the counter act
 * under their name. The window is set per hotel by the owner (Settings →
 * Security) and arrives on /auth/me as `idleTimeoutMinutes`; 15 minutes until
 * it does.
 *
 * Activity is tracked across tabs through localStorage, so someone working in
 * one tab is not signed out by an idle second tab — and signing out in one tab
 * is picked up by the others through the persisted auth store. A warning gives
 * a minute's notice before the sign-out, because losing a half-typed folio to
 * a timer is worse than the risk the timer exists to close.
 */

const ACTIVITY_KEY = 'hotelopx.lastActivity';
const DEFAULT_MINUTES = 15;
const WARNING_SECONDS = 60;
const CHECK_INTERVAL_MS = 5_000;
/** Recording every mousemove would write to storage hundreds of times a second. */
const RECORD_THROTTLE_MS = 15_000;

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'wheel'
];

const readLastActivity = (): number => {
  try {
    const value = Number(window.localStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 ? value : Date.now();
  } catch {
    return Date.now();
  }
};

const writeLastActivity = (time: number) => {
  try {
    window.localStorage.setItem(ACTIVITY_KEY, String(time));
  } catch {
    // Blocked storage only loses the cross-tab sync; this tab still tracks
    // its own activity in memory.
  }
};

export function IdleLogoutGuard() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const minutes = useAuthStore((state) => state.user?.idleTimeoutMinutes) ?? DEFAULT_MINUTES;
  const logout = useAuthStore((state) => state.logout);

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivity = useRef(Date.now());
  const lastRecorded = useRef(0);

  const timeoutMs = Math.max(minutes, 1) * 60_000;

  const recordActivity = useCallback((force = false) => {
    const now = Date.now();
    lastActivity.current = now;
    if (force || now - lastRecorded.current > RECORD_THROTTLE_MS) {
      lastRecorded.current = now;
      writeLastActivity(now);
    }
  }, []);

  const signOut = useCallback(() => {
    setSecondsLeft(null);
    logout();
    navigate('/login', { replace: true, state: { reason: 'idle' } });
  }, [logout, navigate]);

  // Start a fresh window on sign-in.
  useEffect(() => {
    if (token) {
      recordActivity(true);
    }
  }, [token, recordActivity]);

  // Activity listeners. While the warning is showing, ordinary movement does
  // not dismiss it: the user confirms with the button, so a cat walking over
  // the keyboard does not silently extend an abandoned session.
  useEffect(() => {
    if (!token || secondsLeft !== null) {
      return;
    }

    const onActivity = () => recordActivity();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, [token, secondsLeft, recordActivity]);

  // The clock. Compares against the newest activity from any tab.
  useEffect(() => {
    if (!token) {
      setSecondsLeft(null);
      return;
    }

    const tick = () => {
      const latest = Math.max(lastActivity.current, readLastActivity());
      lastActivity.current = latest;
      const remainingMs = latest + timeoutMs - Date.now();

      if (remainingMs <= 0) {
        signOut();
      } else if (remainingMs <= WARNING_SECONDS * 1000) {
        setSecondsLeft(Math.ceil(remainingMs / 1000));
      } else {
        setSecondsLeft(null);
      }
    };

    tick();
    // Faster ticks while counting down so the number moves every second.
    const id = window.setInterval(tick, secondsLeft !== null ? 1_000 : CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [token, timeoutMs, signOut, secondsLeft !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token || secondsLeft === null) {
    return null;
  }

  return (
    <Dialog open maxWidth="xs" fullWidth aria-labelledby="idle-logout-title">
      <DialogTitle id="idle-logout-title">Still there?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          You have been inactive for a while. For security you will be signed out in{' '}
          <strong>{secondsLeft}</strong> second{secondsLeft === 1 ? '' : 's'}.
        </DialogContentText>
        <LinearProgress
          variant="determinate"
          value={(secondsLeft / WARNING_SECONDS) * 100}
          color="warning"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={signOut} color="inherit">
          Sign out now
        </Button>
        <Button
          variant="contained"
          autoFocus
          onClick={() => {
            recordActivity(true);
            setSecondsLeft(null);
          }}
        >
          Stay signed in
        </Button>
      </DialogActions>
    </Dialog>
  );
}
