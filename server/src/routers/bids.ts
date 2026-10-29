import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { currentUser, services } from '../dependencies.js';
import { BidCounterRequest, BidUpdateRequest, DriverBidResponse, MyBidsQuery } from '../schemas/bids.js';
import { errorResponses, IdParams, NoContent } from '../schemas/common.js';
import { OrderDetailsResponse } from '../schemas/orders.js';

/** Отклики: «мои отклики» водителя, изменение и отзыв отклика, встречная цена, выбор исполнителя. */
export const bidsRouter: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/my',
    {
      schema: {
        tags: ['bids'],
        summary: 'Водитель: мои отклики вместе с заявками',
        querystring: MyBidsQuery,
        response: { 200: z.array(DriverBidResponse), ...errorResponses(401, 403, 422) },
      },
    },
    async (request) => services(request).bids.listMine(currentUser(request), request.query.status),
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['bids'],
        summary: 'Водитель: изменить цену или комментарий ожидающего отклика',
        params: IdParams,
        body: BidUpdateRequest,
        response: { 200: OrderDetailsResponse, ...errorResponses(401, 403, 404, 409, 422) },
      },
    },
    async (request) => services(request).bids.update(currentUser(request), request.params.id, request.body),
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['bids'],
        summary: 'Водитель: отозвать ожидающий отклик',
        params: IdParams,
        response: { 204: NoContent, ...errorResponses(401, 403, 404, 409, 422) },
      },
    },
    async (request, reply) => {
      await services(request).bids.withdraw(currentUser(request), request.params.id);
      return reply.status(204).send();
    },
  );

  app.post(
    '/:id/counter',
    {
      schema: {
        tags: ['bids'],
        summary: 'Заказчик: предложить водителю встречную цену',
        params: IdParams,
        body: BidCounterRequest,
        response: { 200: OrderDetailsResponse, ...errorResponses(401, 403, 404, 409, 422) },
      },
    },
    async (request) => services(request).bids.counter(currentUser(request), request.params.id, request.body),
  );

  app.post(
    '/:id/accept-counter',
    {
      schema: {
        tags: ['bids'],
        summary: 'Водитель: согласиться на встречную цену заказчика',
        params: IdParams,
        response: { 200: OrderDetailsResponse, ...errorResponses(401, 403, 404, 409, 422) },
      },
    },
    async (request) => services(request).bids.acceptCounter(currentUser(request), request.params.id),
  );

  app.post(
    '/:id/accept',
    {
      schema: {
        tags: ['bids'],
        summary: 'Заказчик: выбрать исполнителя (UC-06) — атомарная транзакция',
        params: IdParams,
        response: { 200: OrderDetailsResponse, ...errorResponses(401, 403, 404, 409, 422) },
      },
    },
    async (request) => services(request).bids.accept(currentUser(request), request.params.id),
  );

  app.post(
    '/:id/reject',
    {
      schema: {
        tags: ['bids'],
        summary: 'Заказчик: отклонить отклик',
        params: IdParams,
        response: { 200: OrderDetailsResponse, ...errorResponses(401, 403, 404, 409, 422) },
      },
    },
    async (request) => services(request).bids.reject(currentUser(request), request.params.id),
  );
};
