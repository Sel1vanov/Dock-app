import { apiRequest } from '../core/api';
import type {
  ApiAdminDispute,
  ApiAdminUser,
  ApiDisputeStatus,
  ApiPage,
  ApiUser,
  ApiUserRole,
  ApiVerificationStatus,
} from '../models/api';

/** Модерация (роль Admin): /admin/users…, /admin/disputes… */
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

  /** Споры: очередь (status=Open) или все. */
  listDisputes(query: { status?: ApiDisputeStatus; limit: number; offset: number }): Promise<ApiPage<ApiAdminDispute>> {
    return apiRequest('GET', '/admin/disputes', { query: { ...query } });
  },

  /** UC-21: решение по спору. */
  resolveDispute(
    id: string,
    body: { status: 'ResolvedClient' | 'ResolvedDriver'; resolutionComment: string },
  ): Promise<ApiAdminDispute> {
    return apiRequest('PATCH', `/admin/disputes/${id}`, { body });
  },
};
