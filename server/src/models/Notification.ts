import type { Opt } from '@mikro-orm/core';
import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es';

import { NotificationType } from './enums.js';
import { Order } from './Order.js';
import { User } from './User.js';

/**
 * Уведомление пользователю о событии: новый отклик, выбор исполнителя, смена статуса рейса и т. д.
 * Создаётся в той же транзакции, что и само событие: если операция откатилась, уведомления тоже нет.
 */
@Entity({ tableName: 'notifications', rowLevelSecurity: true })
// Список уведомлений пользователя: WHERE user_id = ? ORDER BY created_at DESC
@Index({ name: 'idx_notifications_user_created', columns: [{ name: 'user_id' }, { name: 'created_at', sort: 'desc' }] })
// Счётчик непрочитанных на колокольчике: WHERE user_id = ? AND NOT is_read
@Index({ name: 'idx_notifications_user_unread', properties: ['user'], where: 'not is_read' })
export class Notification {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  /** Получатель. Уведомления — часть аккаунта и удаляются вместе с ним (CASCADE). */
  @ManyToOne(() => User, { deleteRule: 'cascade' })
  user!: User;

  @Enum({ items: () => NotificationType })
  type!: NotificationType;

  @Property({ type: 'string', length: 120 })
  title!: string;

  @Property({ type: 'string', length: 300 })
  body!: string;

  /** Заявка, к которой относится событие. Удалили заявку — уведомление о ней теряет смысл (CASCADE). */
  @ManyToOne(() => Order, { nullable: true, deleteRule: 'cascade' })
  order: Order | null = null;

  /** Пользователь, о котором сообщается администратору (документы на проверке, сброс пароля). */
  @ManyToOne(() => User, { nullable: true, deleteRule: 'cascade' })
  relatedUser: User | null = null;

  @Property({ type: 'boolean', default: false })
  isRead: Opt<boolean> = false;

  @Property({ type: 'datetime', defaultRaw: 'now()' })
  createdAt: Opt<Date> = new Date();
}
