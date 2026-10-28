import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { services } from '../dependencies.js';
import { LoginRequest, RegisterRequest, TokenResponse } from '../schemas/auth.js';
import { errorResponses } from '../schemas/common.js';

/** Публичные эндпоинты: регистрация и вход. Ограничены по частоте — защита от перебора паролей. */
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
};
