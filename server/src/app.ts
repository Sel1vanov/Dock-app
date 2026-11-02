/**
 * Сборка HTTP-приложения: валидация схемами, обработка ошибок, CORS, ограничение частоты
 * запросов, документация Swagger и маршруты API v1. Используется сервером (main.ts) и тестами.
 */
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { MikroORM } from '@mikro-orm/postgresql';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import type { Config } from './core/config.js';
import { registerErrorHandler } from './core/errorHandler.js';
import { registerDependencies } from './dependencies.js';
import { apiV1 } from './routers/index.js';
import { type FileStorage, LocalFileStorage } from './services/FileStorage.js';

export interface AppDeps {
  config: Config;
  orm: MikroORM;
  storage?: FileStorage;
}

const PUBLIC_ROUTES = [
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/password-reset-request',
  '/api/v1/health',
  '/api/v1/files/*',
];

export async function buildApp({ config, orm, storage }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Токены и пароли не попадают в журнал.
      redact: [
        'req.headers.authorization',
        'body.password',
        'body.passwordConfirm',
        'body.currentPassword',
        'body.newPassword',
        'body.newPasswordConfirm',
      ],
      ...(config.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
        : {}),
    },
    bodyLimit: 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registerDependencies(app, { orm, config, storage: storage ?? new LocalFileStorage(config.FILES_DIR) });
  registerErrorHandler(app);

  await app.register(cors, {
    origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(',').map((s) => s.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });
  if (config.NODE_ENV !== 'test') {
    await app.register(rateLimit, { global: false });
  }

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Dock API',
        version: '1.0.0',
        description:
          'REST API мобильного приложения Dock (перевозка негабаритных грузов). ' +
          'Нажмите «Authorize» и вставьте accessToken из ответа /auth/login.',
      },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'auth', description: 'Регистрация и вход (публичные)' },
        { name: 'users', description: 'Профиль и документы' },
        { name: 'vehicles', description: 'Транспорт водителя' },
        { name: 'orders', description: 'Заявки' },
        { name: 'bids', description: 'Отклики и выбор исполнителя' },
        { name: 'tracking', description: 'Исполнение рейса' },
        { name: 'disputes', description: 'Споры по заказам (UC-20, UC-21)' },
        { name: 'admin', description: 'Модерация (роль Admin)' },
        { name: 'notifications', description: 'Уведомления' },
        { name: 'catalog', description: 'Справочники' },
        { name: 'files', description: 'Файлы по подписанным ссылкам' },
        { name: 'system', description: 'Служебное' },
      ],
    },
    transform: (args) => {
      const result = jsonSchemaTransform(args);
      return PUBLIC_ROUTES.includes(args.url) ? { ...result, schema: { ...result.schema, security: [] } } : result;
    },
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(apiV1, { prefix: '/api/v1' });
  app.get('/', { schema: { hide: true } }, (_request, reply) => reply.redirect('/docs'));

  return app;
}
