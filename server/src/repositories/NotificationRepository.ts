import type { EntityManager } from '@mikro-orm/postgresql';

import { Notification, NotificationType, User, UserRole } from '../models/index.js';

/** Уведомления пользователей (таблица notifications). */
export class NotificationRepository {
  constructor(private readonly em: EntityManager) {}

  /** Только добавляет в Session: запись уйдёт в БД тем же flush, что и событие. */
  create(data: Pick<Notification, 'user' | 'type' | 'title' | 'body' | 'order' | 'relatedUser'>): Notification {
    return this.em.create(Notification, data);
  }

  findById(id: string): Promise<Notification | null> {
    return this.em.findOne(Notification, { id });
  }

  /** Список с LIMIT/OFFSET; заявка подтягивается JOIN-ом в том же запросе. */
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

  /** Закрыть просьбы о сбросе пароля пользователя у всех администраторов. */
  markResetRequestsRead(relatedUserId: string): Promise<number> {
    return this.em.nativeUpdate(
      Notification,
      { relatedUser: relatedUserId, type: NotificationType.PasswordResetRequested, isRead: false },
      { isRead: true },
    );
  }

  /** Есть ли непрочитанная просьба о сбросе пароля — чтобы не дублировать её администраторам. */
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
