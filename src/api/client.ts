import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { useAuthStore } from '../store/authStore';
import { tokenForRetry } from '../services/tokenRefresh';

const baseURL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

export const apiClient = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.headers['X-Client-Version'] = import.meta.env.VITE_APP_VERSION || '2.0.0';
  config.headers['X-Request-ID'] = uuidv4();

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isRefreshCall = originalRequest?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !isRefreshCall && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      /*
        Shared with the main api client rather than refreshing here.

        This instance used to run its own refresh. The server rotates refresh
        tokens, so when both clients saw a 401 on the same page — which is what
        a 15-minute idle produces — the first rotation revoked the token the
        second was holding, the second refresh returned 401, and this handler
        logged the user out in the middle of their session. The Menu
        Engineering page was where it showed up, because it is one of the only
        screens served by this client.
      */
      const sentWith = String(originalRequest.headers?.Authorization ?? '').replace(/^Bearer /, '');
      const fresh = await tokenForRetry(sentWith);

      if (fresh) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${fresh}`;
        return apiClient(originalRequest);
      }

      useAuthStore.getState().logout();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);
