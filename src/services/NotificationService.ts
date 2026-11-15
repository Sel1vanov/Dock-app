import type { NotificationDTO, NotificationPageDTO, UserRole } from '../models/dto';
import { toNotificationDTO } from '../models/mappers';
import { NotificationRepository } from '../repositories/NotificationRepository';

export const NOTIFICATIONS_PAGE_SIZE = 20;

// уведомления по заявке, торгу, рейсу и модерации
export const NotificationService = {
  async getPage(offset: number): Promise<NotificationPageDTO> {
    const page = await NotificationRepository.list(NOTIFICATIONS_PAGE_SIZE, offset);
    return { items: page.items.map(toNotificationDTO), total: page.total, unreadCount: page.unreadCount };
  },

  async getUnreadCount(): Promise<number> {
    return (await NotificationRepository.unreadCount()).count;
  },

  // самое свежее уведомление - для всплывашки, когда пришло новое
  async getLatest(): Promise<NotificationDTO | null> {
    const page = await NotificationRepository.list(1, 0);
    return page.items[0] ? toNotificationDTO(page.items[0]) : null;
  },

  markRead: (id: string) => NotificationRepository.markRead(id),

  markAllRead: () => NotificationRepository.markAllRead(),

  // какой экран открыть по уведомлению. null - уведомление чисто информационное
  targetRoute(n: NotificationDTO, role: UserRole): string | null {
    if (n.relatedUserId && role === 'Admin') return `/admin/user/${n.relatedUserId}`;
    if (n.type === 'VerificationResult') return '/verification';
    if (!n.orderId) return null;
    // админ решает спор на карточке заявки
    if (role === 'Admin') return `/order/${n.orderId}`;
    const tripEvents: NotificationDTO['type'][] = [
      'BidAccepted',
      'OrderPaid',
      'TripStatus',
      'OrderCompleted',
      'ReviewReceived',
      'DisputeOpened',
      'DisputeResolved',
    ];
    return tripEvents.includes(n.type) ? `/tracking/${n.orderId}` : `/order/${n.orderId}`;
  },
};
