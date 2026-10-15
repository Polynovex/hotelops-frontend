import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * An offline-unlocked session holds no server token, so once the connection
 * is back the person signs in properly (with the emailed code) before
 * anything syncs. Work recorded while offline stays queued on the device and
 * goes up after that sign-in.
 */
export function OfflineSessionGuard() {
  const navigate = useNavigate();
  const offlineUnlocked = useAuthStore((state) => state.offlineUnlocked);

  useEffect(() => {
    if (!offlineUnlocked) return;
    const backOnline = () => {
      useAuthStore.getState().logout();
      navigate('/login', { replace: true, state: { reason: 'reconnected' } });
    };
    // Already online (e.g. the app was reopened after the outage).
    if (navigator.onLine) {
      backOnline();
      return;
    }
    window.addEventListener('online', backOnline);
    return () => window.removeEventListener('online', backOnline);
  }, [offlineUnlocked, navigate]);

  return null;
}
