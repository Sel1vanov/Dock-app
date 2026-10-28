import type { EntityManager } from '@mikro-orm/postgresql';

import { type DocumentType, VerificationDocument } from '../models/index.js';

/** Документы водителя для верификации (verification_documents). */
export class DocumentRepository {
  constructor(private readonly em: EntityManager) {}

  listByUser(userId: string): Promise<VerificationDocument[]> {
    return this.em.find(VerificationDocument, { user: userId }, { orderBy: { docType: 'asc' } });
  }

  findByUserAndType(userId: string, docType: DocumentType): Promise<VerificationDocument | null> {
    return this.em.findOne(VerificationDocument, { user: userId, docType });
  }

  create(data: Pick<VerificationDocument, 'user' | 'docType' | 'fileKey'>): VerificationDocument {
    return this.em.create(VerificationDocument, data);
  }
}
