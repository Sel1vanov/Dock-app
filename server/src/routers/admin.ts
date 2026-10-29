import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { currentUser, requireRole, services } from '../dependencies.js';
import { UserRole } from '../models/index.js';
import {
  AdminUserDetailsResponse,
  AdminUserPageResponse,
  AdminUsersQuery,
  AdminUserUpdateRequest,
  TemporaryPasswordResponse,
} from '../schemas/admin.js';
import { errorResponses, IdParams } from '../schemas/common.js';

/** Модерация (только роль Admin): проверка документов водителей, блокировка, временный пароль. */
export const adminRouter: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', requireRole(UserRole.Admin));

  app.get(
    '/users',
    {
      schema: {
        tags: ['admin'],
        summary: 'Пользователи: фильтр по статусу проверки и роли, поиск, пагинация',
        querystring: AdminUsersQuery,
        response: { 200: AdminUserPageResponse, ...errorResponses(401, 403, 422) },
      },
    },
    async (request) => services(request).admin.listUsers(request.query),
  );

  app.get(
    '/users/:id',
    {
      schema: {
        tags: ['admin'],
        summary: 'Пользователь с документами и транспортом',
        params: IdParams,
        response: { 200: AdminUserDetailsResponse, ...errorResponses(401, 403, 404, 422) },
      },
    },
    async (request) => services(request).admin.getUser(request.params.id),
  );

  app.patch(
    '/users/:id',
    {
      schema: {
        tags: ['admin'],
        summary: 'Подтвердить/отклонить документы (UC-02), заблокировать (UC-22)',
        params: IdParams,
        body: AdminUserUpdateRequest,
        response: { 200: AdminUserDetailsResponse, ...errorResponses(401, 403, 404, 409, 422) },
      },
    },
    async (request) => services(request).admin.updateUser(currentUser(request), request.params.id, request.body),
  );

  app.post(
    '/users/:id/temporary-password',
    {
      schema: {
        tags: ['admin'],
        summary: 'Выдать временный пароль (по просьбе «Забыли пароль?»); сессии пользователя завершаются',
        params: IdParams,
        response: { 200: TemporaryPasswordResponse, ...errorResponses(401, 403, 404, 422) },
      },
    },
    async (request) => services(request).admin.issueTemporaryPassword(request.params.id),
  );
};
