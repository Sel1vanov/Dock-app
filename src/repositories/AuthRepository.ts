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

/** POST /auth/register, /auth/login, /auth/password-reset-request — публичные, токен не передаётся. */
export const AuthRepository = {
  register(payload: RegisterPayload): Promise<ApiToken> {
    return apiRequest('POST', '/auth/register', { body: payload, auth: false });
  },

  login(email: string, password: string): Promise<ApiToken> {
    return apiRequest('POST', '/auth/login', { body: { email, password }, auth: false });
  },

  /** «Забыли пароль?»: просьба администратору выдать временный пароль. */
  requestPasswordReset(email: string): Promise<{ message: string }> {
    return apiRequest('POST', '/auth/password-reset-request', { body: { email }, auth: false });
  },
};
