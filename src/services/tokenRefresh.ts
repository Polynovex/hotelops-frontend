import axios from 'axios';
import { useAuthStore } from '../store/authStore';

/**
 * One refresh at a time, shared by every axios instance in the app.
 *
 * The server rotates refresh tokens: /auth/refresh revokes the token it was
 * given and issues a new one. That makes a second, concurrent refresh fail by
 * design — it presents a token that no longer exists — and a failed refresh is
 * what signs the user out.
 *
 * This was reachable with two clients on the same page. After a 15-minute
 * idle, the first request from each client returned 401, each client refreshed
 * with its own copy of the refresh token, the first rotated it, and the second
 * was thrown out to the login screen mid-session. The promise below is held at
 * module scope, so whichever client asks second waits for the first answer
 * instead of starting a competing rotation.
 */

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

let refreshInFlight: Promise<string | null> | null = null;

export const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const { refreshToken, user } = useAuthStore.getState();
      // `remember-…` placeholders are not real refresh tokens.
      if (!refreshToken || refreshToken.startsWith('remember-') || !user) {
        return null;
      }

      try {
        // Plain axios, not an app client: a 401 here must not re-enter an
        // interceptor and start this over.
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const accessToken: string | undefined = data?.accessToken ?? data?.token;
        if (!accessToken) {
          return null;
        }

        useAuthStore.getState().setAuth(user, accessToken, data?.refreshToken ?? refreshToken);
        return accessToken;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
};

/**
 * The token to retry a failed request with.
 *
 * Checks the store first: another client may already have refreshed while this
 * request was in flight, in which case there is a usable token and no reason
 * to rotate again.
 */
export const tokenForRetry = async (staleToken?: string): Promise<string | null> => {
  const current = useAuthStore.getState().token;
  if (current && current !== staleToken) {
    return current;
  }
  return refreshAccessToken();
};

export default { refreshAccessToken, tokenForRetry };
