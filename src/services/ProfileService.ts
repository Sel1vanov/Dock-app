import { AppError } from '../core/errors';
import type { RatingDTO, UserDTO } from '../models/dto';
import { toRatingDTO, toUserDTO } from '../models/mappers';
import { ReviewRepository } from '../repositories/ReviewRepository';
import { StorageRepository } from '../repositories/StorageRepository';
import { UserRepository } from '../repositories/UserRepository';

/** Документы для верификации водителя (UC-01). */
export const VERIFICATION_DOCS = [
  { key: 'passport', label: 'Паспорт', hint: 'Разворот с фото', icon: 'card-account-details' },
  { key: 'license', label: 'Водительское удостоверение', hint: 'Лицевая сторона', icon: 'steering' },
  { key: 'sts', label: 'СТС', hint: 'Свидетельство о регистрации ТС', icon: 'file-document-outline' },
] as const;

export type VerificationDocKey = (typeof VERIFICATION_DOCS)[number]['key'];

export const ProfileService = {
  async getRating(userId: string): Promise<RatingDTO | null> {
    const ratings = await ReviewRepository.getRatings([userId]);
    return toRatingDTO(userId, ratings);
  },

  /** Какие документы уже загружены: documents/{userId}/{docKey}-{время}.jpg */
  async getUploadedDocs(userId: string): Promise<VerificationDocKey[]> {
    const paths = await StorageRepository.listFolder('documents', userId);
    const keys = new Set<VerificationDocKey>();
    for (const path of paths) {
      const name = path.split('/').pop() ?? '';
      const doc = VERIFICATION_DOCS.find((d) => name.startsWith(`${d.key}-`));
      if (doc) keys.add(doc.key);
    }
    return [...keys];
  },

  async uploadDoc(userId: string, key: VerificationDocKey, base64: string): Promise<void> {
    await StorageRepository.uploadBase64('documents', `${userId}/${key}-${Date.now()}.jpg`, base64, 'image/jpeg');
  },

  /** Отправка на проверку: путь к папке с документами — признак статуса «На проверке». */
  async submitForVerification(userId: string): Promise<UserDTO> {
    const uploaded = await ProfileService.getUploadedDocs(userId);
    const missing = VERIFICATION_DOCS.filter((d) => !uploaded.includes(d.key));
    if (missing.length > 0) {
      throw new AppError(`Загрузите: ${missing.map((d) => d.label).join(', ')}`);
    }
    const row = await UserRepository.updateProfile(userId, { verification_doc_url: `documents/${userId}/` });
    return toUserDTO(row);
  },
};
