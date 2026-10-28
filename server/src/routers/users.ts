import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { currentUser, services } from '../dependencies.js';
import { errorResponses } from '../schemas/common.js';
import {
  DocumentResponse,
  DocumentTypeParams,
  DocumentUploadRequest,
  UserResponse,
  UserUpdateRequest,
} from '../schemas/users.js';

/** Профиль текущего пользователя и документы водителя. Все данные — только свои (по токену). */
export const usersRouter: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/me',
    { schema: { tags: ['users'], summary: 'Мой профиль', response: { 200: UserResponse, ...errorResponses(401, 403) } } },
    async (request) => services(request).users.getProfile(currentUser(request)),
  );

  app.patch(
    '/me',
    {
      schema: {
        tags: ['users'],
        summary: 'Изменить имя и телефон',
        body: UserUpdateRequest,
        response: { 200: UserResponse, ...errorResponses(401, 403, 422) },
      },
    },
    async (request) => services(request).users.updateProfile(currentUser(request), request.body),
  );

  app.get(
    '/me/documents',
    {
      schema: {
        tags: ['users'],
        summary: 'Загруженные документы водителя (UC-01)',
        response: { 200: z.array(DocumentResponse), ...errorResponses(401, 403) },
      },
    },
    async (request) => services(request).users.listDocuments(currentUser(request)),
  );

  app.put(
    '/me/documents/:docType',
    {
      bodyLimit: 8 * 1024 * 1024,
      schema: {
        tags: ['users'],
        summary: 'Загрузить или заменить документ (passport, license, sts)',
        params: DocumentTypeParams,
        body: DocumentUploadRequest,
        response: { 200: DocumentResponse, 201: DocumentResponse, ...errorResponses(401, 403, 409, 413, 422) },
      },
    },
    async (request, reply) => {
      const result = await services(request).users.uploadDocument(
        currentUser(request),
        request.params.docType,
        request.body.imageBase64,
      );
      return reply.status(result.created ? 201 : 200).send(result.document);
    },
  );

  app.post(
    '/me/verification',
    {
      schema: {
        tags: ['users'],
        summary: 'Отправить документы на проверку администратору',
        response: { 200: UserResponse, ...errorResponses(401, 403, 409) },
      },
    },
    async (request) => services(request).users.submitForVerification(currentUser(request)),
  );
};
