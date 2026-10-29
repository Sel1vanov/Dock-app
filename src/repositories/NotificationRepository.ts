import { apiRequest } from '../core/api';
import type { ApiNotificationPage } from '../models/api';

/** Уведомления текущего пользователя: /notifications… */
export const NotificationRepository = {
  list(limit: number, offset: number): Promise<ApiNotificationPage> {
    return apiRequest('GET', '/notifications', { query: { limit, offset } });
  },

  unreadCount(): Promise<{ count: number }> {
    return apiRequest('GET', '/notifications/unread-count');
  },

  markRead(id: string): Promise<void> {
    return apiRequest('POST', `/notifications/${id}/read`);
  },

  markAllRead(): Promise<void> {
    return apiRequest('POST', '/notifications/read-all');
  },
};
