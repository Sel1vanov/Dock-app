import { AppError } from '../core/errors';
import type { DocumentDTO, DocumentType, Page, ReviewDTO, UserDTO } from '../models/dto';
import { toDocumentDTO, toReviewDTO, toUserDTO } from '../models/mappers';
import { UserRepository } from '../repositories/UserRepository';

/** Документы для верификации водителя (UC-01). */
export const VERIFICATION_DOCS: { key: DocumentType; label: string; hint: string; icon: string }[] = [
  { key: 'passport', label: 'Паспорт', hint: 'Разворот с фото', icon: 'card-account-details' },
  { key: 'license', label: 'Водительское удостоверение', hint: 'Лицевая сторона', icon: 'steering' },
  { key: 'sts', label: 'СТС', hint: 'Свидетельство о регистрации ТС', icon: 'file-document-outline' },
];

export const ProfileService = {
  async updateProfile(patch: { fullName: string; phone: string }): Promise<UserDTO> {
    return toUserDTO(await UserRepository.updateMe(patch));
  },

  /** Отзывы обо мне, новые сверху (UC-19). */
  async getReviews(offset: number, limit = 10): Promise<Page<ReviewDTO>> {
    const page = await UserRepository.listReviews(limit, offset);
    return { items: page.items.map(toReviewDTO), total: page.total };
  },

  async getDocuments(): Promise<DocumentDTO[]> {
    return (await UserRepository.listDocuments()).map(toDocumentDTO);
  },

  async uploadDoc(key: DocumentType, base64: string): Promise<void> {
    await UserRepository.uploadDocument(key, base64);
  },

  /** Отправка на проверку: нужны все три документа (сервер проверит то же самое). */
  async submitForVerification(uploaded: DocumentType[]): Promise<UserDTO> {
    const missing = VERIFICATION_DOCS.filter((d) => !uploaded.includes(d.key));
    if (missing.length > 0) throw new AppError(`Загрузите: ${missing.map((d) => d.label).join(', ')}`);
    return toUserDTO(await UserRepository.submitVerification());
  },
};
