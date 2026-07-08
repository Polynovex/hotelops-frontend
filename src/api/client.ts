import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { useAuthStore } from '../store/authStore';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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

    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const refreshResponse = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
        const accessToken = refreshResponse.data?.accessToken || refreshResponse.data?.token;

        if (!accessToken) {
          throw new Error('No access token in refresh response');
        }

        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          useAuthStore.getState().setAuth(
            currentUser,
            accessToken,
            refreshResponse.data?.refreshToken || refreshToken
          );
        }

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (_refreshError) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);
