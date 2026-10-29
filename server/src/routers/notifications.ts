import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { currentUser, services } from '../dependencies.js';
import { errorResponses, IdParams, NoContent } from '../schemas/common.js';
import { NotificationPageResponse, NotificationsQuery, UnreadCountResponse } from '../schemas/notifications.js';

/** Уведомления текущего пользователя: список, счётчик непрочитанных, отметка о прочтении. */
export const notificationsRouter: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['notifications'],
        summary: 'Мои уведомления, новые сверху (пагинация)',
        querystring: NotificationsQuery,
        response: { 200: NotificationPageResponse, ...errorResponses(401, 403, 422) },
      },
    },
    async (request) => services(request).notifications.list(currentUser(request), request.query),
  );

  app.get(
    '/unread-count',
    {
      schema: {
        tags: ['notifications'],
        summary: 'Число непрочитанных уведомлений (для значка на колокольчике)',
        response: { 200: UnreadCountResponse, ...errorResponses(401, 403) },
      },
    },
    async (request) => services(request).notifications.unreadCount(currentUser(request)),
  );

  app.post(
    '/read-all',
    {
      schema: {
        tags: ['notifications'],
        summary: 'Отметить все уведомления прочитанными',
        response: { 204: NoContent, ...errorResponses(401, 403) },
      },
    },
    async (request, reply) => {
      await services(request).notifications.markAllRead(currentUser(request));
      return reply.status(204).send();
    },
  );

  app.post(
    '/:id/read',
    {
      schema: {
        tags: ['notifications'],
        summary: 'Отметить уведомление прочитанным',
        params: IdParams,
        response: { 204: NoContent, ...errorResponses(401, 403, 404, 422) },
      },
    },
    async (request, reply) => {
      await services(request).notifications.markRead(currentUser(request), request.params.id);
      return reply.status(204).send();
    },
  );
};
