import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { currentUser, services } from '../dependencies.js';
import { errorResponses, IdParams, NoContent } from '../schemas/common.js';
import { VehicleCreateRequest, VehicleResponse, VehicleUpdateRequest } from '../schemas/vehicles.js';

/** CRUD транспорта водителя. */
export const vehiclesRouter: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['vehicles'],
        summary: 'Мой транспорт',
        response: { 200: z.array(VehicleResponse), ...errorResponses(401, 403) },
      },
    },
    async (request) => services(request).vehicles.listMine(currentUser(request)),
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['vehicles'],
        summary: 'Добавить ТС',
        body: VehicleCreateRequest,
        response: { 201: VehicleResponse, ...errorResponses(401, 403, 422) },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await services(request).vehicles.create(currentUser(request), request.body)),
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['vehicles'],
        summary: 'ТС по id',
        params: IdParams,
        response: { 200: VehicleResponse, ...errorResponses(401, 403, 404, 422) },
      },
    },
    async (request) => services(request).vehicles.get(currentUser(request), request.params.id),
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['vehicles'],
        summary: 'Изменить ТС',
        params: IdParams,
        body: VehicleUpdateRequest,
        response: { 200: VehicleResponse, ...errorResponses(401, 403, 404, 422) },
      },
    },
    async (request) => services(request).vehicles.update(currentUser(request), request.params.id, request.body),
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['vehicles'],
        summary: 'Удалить ТС',
        params: IdParams,
        response: { 204: NoContent, ...errorResponses(401, 403, 404, 422) },
      },
    },
    async (request, reply) => {
      await services(request).vehicles.remove(currentUser(request), request.params.id);
      return reply.status(204).send();
    },
  );
};
