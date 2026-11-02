import { randomUUID } from 'node:crypto';

import { ConflictError, ForbiddenError } from '../core/errors.js';
import { DocumentType, NotificationType, type User, UserRole, VerificationStatus } from '../models/index.js';
import { DocumentRepository, ReviewRepository, UserRepository } from '../repositories/index.js';
import type { UserUpdateInput } from '../schemas/users.js';
import type { ServiceContext } from './context.js';
import { decodeImage } from './FileStorage.js';
import { toDocumentResponse, toUserResponse } from './mappers.js';
import { NotificationService } from './NotificationService.js';

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  [DocumentType.Passport]: 'паспорт',
  [DocumentType.License]: 'водительское удостоверение',
  [DocumentType.Sts]: 'СТС',
};

/** Профиль текущего пользователя и документы для верификации водителя (UC-01). */
export class UserService {
  private readonly users: UserRepository;
  private readonly documents: DocumentRepository;

  constructor(private readonly ctx: ServiceContext) {
    this.users = new UserRepository(ctx.em);
    this.documents = new DocumentRepository(ctx.em);
  }

  async getProfile(user: User) {
    const rating = (await this.users.getRatings([user.id])).get(user.id) ?? null;
    return toUserResponse(user, rating);
  }

  async updateProfile(user: User, input: UserUpdateInput) {
    this.ctx.em.assign(user, input);
    await this.ctx.em.flush();
    return this.getProfile(user);
  }

  /** Отзывы, которые оставили пользователю (UC-19), с пагинацией. */
  async listMyReviews(user: User, page: { limit: number; offset: number }) {
    const [reviews, total] = await new ReviewRepository(this.ctx.em).listByTarget(user.id, page);
    return {
      items: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        authorName: r.author.fullName,
        authorRole: r.author.role,
        orderId: r.order.id,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      limit: page.limit,
      offset: page.offset,
    };
  }

  async listDocuments(user: User) {
    this.requireDriver(user);
    const docs = await this.documents.listByUser(user.id);
    return docs.map((d) => toDocumentResponse(d, this.ctx.config));
  }

  /** Загрузка или замена документа. Пока документы на проверке — менять их нельзя. */
  async uploadDocument(user: User, docType: DocumentType, imageBase64: string) {
    this.requireDriver(user);
    if (user.verificationStatus === VerificationStatus.Pending) {
      throw new ConflictError('Документы уже на проверке — дождитесь решения администратора');
    }
    if (user.verificationStatus === VerificationStatus.Verified) {
      throw new ConflictError('Документы уже подтверждены');
    }
    const image = decodeImage(imageBase64);
    const fileKey = `documents/${user.id}/${docType}-${randomUUID()}.${image.ext}`;
    await this.ctx.storage.save(fileKey, image.data);

    const existing = await this.documents.findByUserAndType(user.id, docType);
    const oldKey = existing?.fileKey;
    const doc = existing ?? this.documents.create({ user, docType, fileKey });
    doc.fileKey = fileKey;
    doc.uploadedAt = new Date();
    try {
      await this.ctx.em.flush();
    } catch (e) {
      await this.ctx.storage.remove(fileKey); // запись не сохранилась — не оставляем «осиротевший» файл
      throw e;
    }
    if (oldKey) await this.ctx.storage.remove(oldKey);
    return { document: toDocumentResponse(doc, this.ctx.config), created: !existing };
  }

  /** Отправка на проверку: нужны все три документа. */
  async submitForVerification(user: User) {
    this.requireDriver(user);
    if (user.verificationStatus === VerificationStatus.Pending) throw new ConflictError('Документы уже на проверке');
    if (user.verificationStatus === VerificationStatus.Verified) throw new ConflictError('Документы уже подтверждены');
    const uploaded = new Set((await this.documents.listByUser(user.id)).map((d) => d.docType));
    const missing = Object.values(DocumentType).filter((t) => !uploaded.has(t));
    if (missing.length > 0) {
      throw new ConflictError(`Загрузите: ${missing.map((t) => DOCUMENT_LABELS[t]).join(', ')}`);
    }
    user.verificationStatus = VerificationStatus.Pending;
    user.verifiedAt = null;
    user.verifiedBy = null;
    await new NotificationService(this.ctx).notifyAdmins(
      NotificationType.VerificationRequested,
      'Документы на проверку',
      `Водитель ${user.fullName} загрузил паспорт, ВУ и СТС и ждёт проверки.`,
      { relatedUser: user },
    );
    await this.ctx.em.flush();
    return this.getProfile(user);
  }

  private requireDriver(user: User) {
    if (user.role !== UserRole.Driver) throw new ForbiddenError('Верификация документов нужна только водителям');
  }
}
