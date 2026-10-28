/**
 * API версии 1: все маршруты под префиксом /api/v1. Публичны только регистрация, вход,
 * проверка работоспособности и выдача файлов по подписанной ссылке; остальное требует JWT.
 */
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { authenticate } from '../dependencies.js';
import { adminRouter } from './admin.js';
import { authRouter } from './auth.js';
import { bidsRouter } from './bids.js';
import { catalogRouter } from './catalog.js';
import { filesRouter } from './files.js';
import { ordersRouter } from './orders.js';
import { usersRouter } from './users.js';
import { vehiclesRouter } from './vehicles.js';

export const apiV1: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    { schema: { tags: ['system'], summary: 'Проверка работоспособности', response: { 200: z.object({ status: z.literal('ok') }) } } },
    async () => ({ status: 'ok' as const }),
  );

  await app.register(authRouter, { prefix: '/auth' });
  await app.register(filesRouter, { prefix: '/files' });

  // Защищённая зона: токен проверяется до разбора тела запроса (onRequest).
  await app.register(async (protectedApp) => {
    protectedApp.addHook('onRequest', authenticate);
    await protectedApp.register(usersRouter, { prefix: '/users' });
    await protectedApp.register(catalogRouter);
    await protectedApp.register(vehiclesRouter, { prefix: '/vehicles' });
    await protectedApp.register(ordersRouter, { prefix: '/orders' });
    await protectedApp.register(bidsRouter, { prefix: '/bids' });
    await protectedApp.register(adminRouter, { prefix: '/admin' });
  });
};
