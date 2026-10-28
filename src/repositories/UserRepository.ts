import { apiRequest } from '../core/api';
import type { ApiDocument, ApiDocumentType, ApiUser } from '../models/api';

/** Профиль текущего пользователя и документы для верификации (/users/me…). */
export const UserRepository = {
  getMe(): Promise<ApiUser> {
    return apiRequest('GET', '/users/me');
  },

  updateMe(patch: { fullName?: string; phone?: string }): Promise<ApiUser> {
    return apiRequest('PATCH', '/users/me', { body: patch });
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
