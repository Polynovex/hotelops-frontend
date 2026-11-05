import { authService } from '../services/api';

/**
 * Looked up when called, not when this module loads: services/api imports the
 * auth store, which imports this file, so reading authService at load time
 * failed ("Cannot access 'authService' before initialization") whenever a page
 * happened to load the store before services/api.
 */
export const authApi = {
  login: (...args: Parameters<typeof authService.login>) => authService.login(...args),
  getMe: (...args: Parameters<typeof authService.getMe>) => authService.getMe(...args)
};
