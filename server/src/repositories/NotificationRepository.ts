import type { EntityManager } from '@mikro-orm/postgresql';

import { Notification, NotificationType, User, UserRole } from '../models/index.js';

// уведомления (таблица notifications)
export class NotificationRepository {
  constructor(private readonly em: EntityManager) {}

  // только кладет в em, в базу уйдет тем же flush, что и само событие
  create(data: Pick<Notification, 'user' | 'type' | 'title' | 'body' | 'order' | 'relatedUser'>): Notification {
    return this.em.create(Notification, data);
  }

  findById(id: string): Promise<Notification | null> {
    return this.em.findOne(Notification, { id });
  }

  // список с LIMIT/OFFSET, заявка подтягивается JOIN-ом в том же запросе
  listByUser(userId: string, filter: { unreadOnly: boolean; limit: number; offset: number }) {
    return this.em.findAndCount(
      Notification,
      { user: userId, ...(filter.unreadOnly ? { isRead: false } : {}) },
      { orderBy: { createdAt: 'desc', id: 'asc' }, limit: filter.limit, offset: filter.offset },
    );
  }

  countUnread(userId: string): Promise<number> {
    return this.em.count(Notification, { user: userId, isRead: false });
  }

  markAllRead(userId: string): Promise<number> {
    return this.em.nativeUpdate(Notification, { user: userId, isRead: false }, { isRead: true });
  }

  // закрыть просьбы о сбросе пароля этого юзера у всех админов
  markResetRequestsRead(relatedUserId: string): Promise<number> {
    return this.em.nativeUpdate(
      Notification,
      { relatedUser: relatedUserId, type: NotificationType.PasswordResetRequested, isRead: false },
      { isRead: true },
    );
  }

  // пометить прочитанными уведомления этого типа по заказу (у всех получателей)
  markReadByOrder(orderId: string, type: NotificationType): Promise<number> {
    return this.em.nativeUpdate(Notification, { order: orderId, type, isRead: false }, { isRead: true });
  }

  // есть ли уже непрочитанная просьба о сбросе пароля - чтобы не дублировать ее админам
  async hasUnreadResetRequest(relatedUserId: string): Promise<boolean> {
    const count = await this.em.count(Notification, {
      relatedUser: relatedUserId,
      type: NotificationType.PasswordResetRequested,
      isRead: false,
    });
    return count > 0;
  }

  listActiveAdmins(): Promise<User[]> {
    return this.em.find(User, { role: UserRole.Admin, isBlocked: false });
  }
}
