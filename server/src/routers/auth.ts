import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { authenticate, currentUser, services } from '../dependencies.js';
import {
  LoginRequest,
  MessageResponse,
  PasswordResetRequest,
  RegisterRequest,
  TokenResponse,
} from '../schemas/auth.js';
import { errorResponses } from '../schemas/common.js';

/**
 * Регистрация, вход и просьба о сбросе пароля — публичные, ограничены по частоте (защита от перебора паролей).
 * Продление сессии (/refresh) требует действующий токен.
 */
export const authRouter: FastifyPluginAsyncZod = async (app) => {
  const rateLimit = { max: 10, timeWindow: '1 minute' };

  app.post(
    '/register',
    {
      config: { rateLimit },
      schema: {
        tags: ['auth'],
        summary: 'Регистрация заказчика или водителя',
        body: RegisterRequest,
        response: { 201: TokenResponse, ...errorResponses(409, 422, 429) },
      },
    },
    async (request, reply) => reply.status(201).send(await services(request).auth.register(request.body)),
  );

  app.post(
    '/login',
    {
      config: { rateLimit },
      schema: {
        tags: ['auth'],
        summary: 'Вход по email и паролю — выдаёт JWT с ограниченным сроком действия',
        body: LoginRequest,
        response: { 200: TokenResponse, ...errorResponses(401, 403, 422, 429) },
      },
    },
    async (request) => services(request).auth.login(request.body),
  );

  app.post(
    '/refresh',
    {
      onRequest: authenticate,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        summary: 'Продлить сессию: новый токен по действующему (приложение вызывает само, пока им пользуются)',
        response: { 200: TokenResponse, ...errorResponses(401, 403, 429) },
      },
    },
    async (request) => services(request).auth.refresh(currentUser(request), request.sessionStartedAt),
  );

  app.post(
    '/password-reset-request',
    {
      config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        summary: 'Забыли пароль: просьба администратору выдать временный пароль',
        body: PasswordResetRequest,
        response: { 202: MessageResponse, ...errorResponses(422, 429) },
      },
    },
    async (request, reply) =>
      reply.status(202).send(await services(request).auth.requestPasswordReset(request.body.email)),
  );
};
