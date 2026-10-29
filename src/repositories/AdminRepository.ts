import { apiRequest } from '../core/api';
import type { ApiAdminUser, ApiPage, ApiUser, ApiUserRole, ApiVerificationStatus } from '../models/api';

/** Модерация (роль Admin): /admin/users… */
export const AdminRepository = {
  listUsers(query: {
    verificationStatus?: ApiVerificationStatus;
    role?: ApiUserRole;
    q?: string;
    limit: number;
    offset: number;
  }): Promise<ApiPage<ApiUser>> {
    return apiRequest('GET', '/admin/users', { query: { ...query } });
  },

  getUser(id: string): Promise<ApiAdminUser> {
    return apiRequest('GET', `/admin/users/${id}`);
  },

  /** Временный пароль по просьбе «Забыли пароль?». */
  issueTemporaryPassword(id: string): Promise<{ temporaryPassword: string }> {
    return apiRequest('POST', `/admin/users/${id}/temporary-password`);
  },

  updateUser(
    id: string,
    patch: { verificationStatus?: 'verified' | 'rejected'; isBlocked?: boolean },
  ): Promise<ApiAdminUser> {
    return apiRequest('PATCH', `/admin/users/${id}`, { body: patch });
  },
};
