import { authService } from '../services/api';

export const authApi = {
  login: authService.login,
  register: authService.register,
  getMe: authService.getMe
};
