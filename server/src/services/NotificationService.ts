import { ForbiddenError, NotFoundError } from '../core/errors.js';
import type { Notification, NotificationType, Order, User } from '../models/index.js';
import { NotificationRepository } from '../repositories/index.js';
import type { NotificationResponseT, NotificationsQueryT } from '../schemas/notifications.js';
import type { ServiceContext } from './context.js';

/** Цена в тексте уведомления: «45 000 ₽». */
export const rub = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;

/** Короткое название заявки для текста уведомления: описание груза или его тип. */
export const orderTitle = (order: Order) => `«${order.description || order.cargoType.name}»`;

/**
 * Уведомления о событиях. Методы notify* только добавляют запись в Session текущего запроса:
 * она сохраняется тем же flush (в той же транзакции), что и изменение, о котором сообщает.
 */
export class NotificationService {
  private readonly notifications: NotificationRepository;

  constructor(private readonly ctx: ServiceContext) {
    this.notifications = new NotificationRepository(ctx.em);
  }

  notify(
    user: User,
    type: NotificationType,
    title: string,
    body: string,
    links: { order?: Order; relatedUser?: User } = {},
  ): void {
    this.notifications.create({
      user,
      type,
      title,
      body: body.length > 300 ? `${body.slice(0, 299)}…` : body,
      order: links.order ?? null,
      relatedUser: links.relatedUser ?? null,
    });
  }

  async notifyAdmins(type: NotificationType, title: string, body: string, relatedUser: User): Promise<void> {
    for (const admin of await this.notifications.listActiveAdmins()) {
      this.notify(admin, type, title, body, { relatedUser });
    }
  }

  async list(user: User, query: NotificationsQueryT) {
    const [[items, total], unreadCount] = await Promise.all([
      this.notifications.listByUser(user.id, query),
      this.notifications.countUnread(user.id),
    ]);
    return { items: items.map(toNotificationResponse), total, limit: query.limit, offset: query.offset, unreadCount };
  }

  async unreadCount(user: User) {
    return { count: await this.notifications.countUnread(user.id) };
  }

  async markRead(user: User, id: string): Promise<void> {
    const notification = await this.notifications.findById(id);
    if (!notification) throw new NotFoundError('Уведомление не найдено');
    if (notification.user.id !== user.id) throw new ForbiddenError('Это уведомление другого пользователя');
    notification.isRead = true;
    await this.ctx.em.flush();
  }

  async markAllRead(user: User): Promise<void> {
    await this.notifications.markAllRead(user.id);
  }
}

function toNotificationResponse(n: Notification): NotificationResponseT {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    orderId: n.order?.id ?? null,
    relatedUserId: n.relatedUser?.id ?? null,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  };
}
