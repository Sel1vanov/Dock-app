import { z } from 'zod';

import { NotificationType } from '../models/enums.js';
import { PaginationQuery, pageOf } from './common.js';

export const NotificationsQuery = PaginationQuery.extend({
  unreadOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true')
    .describe('true — только непрочитанные'),
});

export const NotificationResponse = z
  .object({
    id: z.uuid(),
    type: z.enum(NotificationType),
    title: z.string(),
    body: z.string(),
    orderId: z.uuid().nullable().describe('Заявка, к которой относится событие'),
    relatedUserId: z.uuid().nullable().describe('Пользователь, о котором сообщается администратору'),
    isRead: z.boolean(),
    createdAt: z.string(),
  })
  .meta({ id: 'NotificationResponse' });

export const NotificationPageResponse = pageOf(NotificationResponse)
  .extend({ unreadCount: z.number().int().describe('Всего непрочитанных') })
  .meta({ id: 'NotificationPageResponse' });

export const UnreadCountResponse = z.object({ count: z.number().int() }).meta({ id: 'UnreadCountResponse' });

export type NotificationsQueryT = z.output<typeof NotificationsQuery>;
export type NotificationResponseT = z.output<typeof NotificationResponse>;
