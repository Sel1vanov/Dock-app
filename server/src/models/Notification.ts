import type { Opt } from '@mikro-orm/core';
import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es';

import { NotificationType } from './enums.js';
import { Order } from './Order.js';
import { User } from './User.js';

// уведомление юзеру о событии: новый отклик, выбор исполнителя, смена статуса рейса и т.д.
// создается в той же транзакции, что и событие: откатилась операция - уведомления тоже нет
@Entity({ tableName: 'notifications' })
// список уведомлений юзера: WHERE user_id = ? ORDER BY created_at DESC
@Index({ name: 'idx_notifications_user_created', columns: [{ name: 'user_id' }, { name: 'created_at', sort: 'desc' }] })
// счетчик на колокольчике: WHERE user_id = ? AND NOT is_read
@Index({ name: 'idx_notifications_user_unread', properties: ['user'], where: 'not is_read' })
export class Notification {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  // получатель. уведомления удаляются вместе с аккаунтом (CASCADE)
  @ManyToOne(() => User, { deleteRule: 'cascade' })
  user!: User;

  @Enum({ items: () => NotificationType })
  type!: NotificationType;

  @Property({ type: 'string', length: 120 })
  title!: string;

  @Property({ type: 'string', length: 300 })
  body!: string;

  // заявка, про которую событие. удалили заявку - уведомление уже не нужно (CASCADE)
  @ManyToOne(() => Order, { nullable: true, deleteRule: 'cascade' })
  order: Order | null = null;

  // юзер, про которого сообщаем админу (документы на проверке, сброс пароля)
  @ManyToOne(() => User, { nullable: true, deleteRule: 'cascade' })
  relatedUser: User | null = null;

  @Property({ type: 'boolean', default: false })
  isRead: Opt<boolean> = false;

  @Property({ type: 'datetime', defaultRaw: 'now()' })
  createdAt: Opt<Date> = new Date();
}
