import type { AuthUser } from '../services/api';

export type User = AuthUser;

export interface LoginPayload {
  email: string;
  password: string;
}
