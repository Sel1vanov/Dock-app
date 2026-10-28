import { apiRequest } from '../core/api';
import type { ApiToken } from '../models/api';

export interface RegisterPayload {
  email: string;
  password: string;
  passwordConfirm: string;
  fullName: string;
  phone: string;
  role: 'Client' | 'Driver';
}

/** POST /auth/register, POST /auth/login — публичные эндпоинты, токен не передаётся. */
export const AuthRepository = {
  register(payload: RegisterPayload): Promise<ApiToken> {
    return apiRequest('POST', '/auth/register', { body: payload, auth: false });
  },

  login(email: string, password: string): Promise<ApiToken> {
    return apiRequest('POST', '/auth/login', { body: { email, password }, auth: false });
  },
};
