import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { ForbiddenError, NotFoundError } from '../core/errors.js';
import { verifyFileSignature } from '../core/security.js';
import { errorResponses } from '../schemas/common.js';
import { isValidFileKey } from '../services/FileStorage.js';

/**
 * Выдача приватных файлов по подписанной ссылке (HMAC + срок действия), которую API включает
 * в ответы только тем, кому файл доступен. Ссылку нельзя подделать или продлить.
 * Отдельный заголовок Authorization не нужен — так ссылку может открыть компонент <Image>.
 */
export const filesRouter: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/*',
    {
      schema: {
        tags: ['files'],
        summary: 'Файл по подписанной ссылке',
        params: z.object({ '*': z.string() }),
        querystring: z.object({ expires: z.coerce.number().int(), signature: z.string().max(100) }),
        response: { 200: z.any().describe('Изображение JPEG или PNG'), ...errorResponses(403, 404, 422) },
      },
    },
    async (request, reply) => {
      const key = request.params['*'];
      const { expires, signature } = request.query;
      if (!isValidFileKey(key) || !verifyFileSignature(app.config, key, expires, signature)) {
        throw new ForbiddenError('Ссылка недействительна или устарела');
      }
      const file = await app.storage.read(key);
      if (!file) throw new NotFoundError('Файл не найден');
      return reply
        .header('Content-Type', file.contentType)
        .header('Cache-Control', 'private, max-age=3600')
        .header('X-Content-Type-Options', 'nosniff')
        .send(file.data);
    },
  );
};
