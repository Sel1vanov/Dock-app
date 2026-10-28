import type { Opt } from '@mikro-orm/core';
import { Entity, Enum, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';

import { DocumentType } from './enums.js';
import { User } from './User.js';

/**
 * Скан документа водителя для верификации (UC-01): паспорт, ВУ, СТС.
 * По одному документу каждого типа — повторная загрузка заменяет файл.
 */
@Entity({ tableName: 'verification_documents', rowLevelSecurity: true })
@Unique({ name: 'uk_verification_documents_user_type', properties: ['user', 'docType'] })
export class VerificationDocument {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  /** Персональные данные пользователя удаляются вместе с ним (CASCADE). */
  @ManyToOne(() => User, { deleteRule: 'cascade' })
  user!: User;

  @Enum({ items: () => DocumentType })
  docType!: DocumentType;

  @Unique({ name: 'uk_verification_documents_file_key' })
  @Property({ type: 'string', length: 255 })
  fileKey!: string;

  @Property({ type: 'datetime', defaultRaw: 'now()', onUpdate: () => new Date() })
  uploadedAt: Opt<Date> = new Date();
}
