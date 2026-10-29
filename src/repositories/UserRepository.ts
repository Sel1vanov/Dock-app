import { apiRequest } from '../core/api';
import type { ApiDocument, ApiDocumentType, ApiPage, ApiReceivedReview, ApiToken, ApiUser } from '../models/api';

/** Профиль текущего пользователя и документы для верификации (/users/me…). */
export const UserRepository = {
  getMe(): Promise<ApiUser> {
    return apiRequest('GET', '/users/me');
  },

  updateMe(patch: { fullName?: string; phone?: string }): Promise<ApiUser> {
    return apiRequest('PATCH', '/users/me', { body: patch });
  },

  /** Смена пароля: сервер отзывает прежние токены и возвращает новый. */
  changePassword(payload: {
    currentPassword: string;
    newPassword: string;
    newPasswordConfirm: string;
  }): Promise<ApiToken> {
    return apiRequest('POST', '/users/me/password', { body: payload });
  },

  listReviews(limit: number, offset: number): Promise<ApiPage<ApiReceivedReview>> {
    return apiRequest('GET', '/users/me/reviews', { query: { limit, offset } });
  },

  listDocuments(): Promise<ApiDocument[]> {
    return apiRequest('GET', '/users/me/documents');
  },

  uploadDocument(docType: ApiDocumentType, imageBase64: string): Promise<ApiDocument> {
    return apiRequest('PUT', `/users/me/documents/${docType}`, { body: { imageBase64 } });
  },

  submitVerification(): Promise<ApiUser> {
    return apiRequest('POST', '/users/me/verification');
  },
};
