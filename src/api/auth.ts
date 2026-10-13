import { authService } from '../services/api';

export const authApi = {
  login: authService.login,
  getMe: authService.getMe
};
