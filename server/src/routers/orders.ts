import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { currentUser, services } from '../dependencies.js';
import { BidCreateRequest } from '../schemas/bids.js';
import { errorResponses, IdParams, NoContent } from '../schemas/common.js';
import {
  CancelOrderRequest,
  FeedPageResponse,
  FeedQuery,
  OrderCreateRequest,
  OrderDetailsResponse,
  OrderListQuery,
  OrderPageResponse,
  OrderUpdateRequest,
  PhotoUploadRequest,
  ReviewCreateRequest,
  ReviewResponse,
  StatusChangeRequest,
} from '../schemas/orders.js';

/** Заявки: CRUD, лента, торг, исполнение рейса, отзывы. */
export const ordersRouter: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['orders'],
        summary: 'Мои заявки (заказчик) или мои рейсы (водитель): поиск, фильтр, сортировка, пагинация',
        querystring: OrderListQuery,
        response: { 200: OrderPageResponse, ...errorResponses(401, 403, 422) },
      },
    },
    async (request) => services(request).orders.list(currentUser(request), request.query),
  );

  app.get(
    '/feed',
    {
      schema: {
        tags: ['orders'],
        summary: 'Лента открытых заявок под габариты и типы грузов ТС водителя (UC-08, UC-09)',
        querystring: FeedQuery,
        response: { 200: FeedPageResponse, ...errorResponses(401, 403, 404, 422) },
      },
    },
    async (request) => services(request).orders.feed(currentUser(request), request.query),
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['orders'],
        summary: 'Создать заявку (UC-03, UC-04)',
        body: OrderCreateRequest,
        response: { 201: OrderDetailsResponse, ...errorResponses(401, 403, 422) },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await services(request).orders.create(currentUser(request), request.body)),
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['orders'],
        summary: 'Карточка заявки со связанными данными',
        params: IdParams,
        response: { 200: OrderDetailsResponse, ...errorResponses(401, 403, 404, 422) },
      },
    },
    async (request) => services(request).orders.getDetails(currentUser(request), request.params.id),
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['orders'],
        summary: 'Изменить заявку (пока нет откликов)',
        params: IdParams,
        body: OrderUpdateRequest,
        response: { 200: OrderDetailsResponse, ...errorResponses(401, 403, 404, 409, 422) },
      },
    },
    async (request) => services(request).orders.update(currentUser(request), request.params.id, request.body),
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['orders'],
        summary: 'Удалить заявку без откликов',
        params: IdParams,
        response: { 204: NoContent, ...errorResponses(401, 403, 404, 409, 422) },
      },
    },
    async (request, reply) => {
      await services(request).orders.remove(currentUser(request), request.params.id);
      return reply.status(204).send();
    },
  );

  app.post(
    '/:id/cancel',
    {
      schema: {
        tags: ['orders'],
        summary: 'Отменить заявку до оплаты (UC-07)',
        params: IdParams,
        body: CancelOrderRequest,
        response: { 200: OrderDetailsResponse, ...errorResponses(401, 403, 404, 409, 422) },
      },
    },
    async (request) => services(request).orders.cancel(currentUser(request), request.params.id, request.body.reason),
  );

  app.post(
    '/:id/payment',
    {
      schema: {
        tags: ['orders'],
        summary: 'Оплатить: заморозка средств безопасной сделки (UC-12, UC-13, демо)',
        params: IdParams,
        response: { 200: OrderDetailsResponse, ...errorResponses(401, 403, 404, 409, 422) },
      },
    },
    async (request) => services(request).orders.pay(currentUser(request), request.params.id),
  );

  app.post(
    '/:id/status',
    {
      schema: {
        tags: ['tracking'],
        summary: 'Водитель: следующий этап рейса (UC-15)',
        params: IdParams,
        body: StatusChangeRequest,
        response: { 200: OrderDetailsResponse, ...errorResponses(401, 403, 404, 409, 422) },
      },
    },
    async (request) =>
      services(request).tracking.changeStatus(currentUser(request), request.params.id, request.body.status),
  );

  app.post(
    '/:id/photos',
    {
      bodyLimit: 8 * 1024 * 1024,
      schema: {
        tags: ['tracking'],
        summary: 'Водитель: фотофиксация погрузки или выгрузки (UC-17)',
        params: IdParams,
        body: PhotoUploadRequest,
        response: { 201: OrderDetailsResponse, ...errorResponses(401, 403, 404, 409, 413, 422) },
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(await services(request).tracking.uploadPhoto(currentUser(request), request.params.id, request.body)),
  );

  app.post(
    '/:id/complete',
    {
      schema: {
        tags: ['tracking'],
        summary: 'Заказчик: подтвердить приёмку груза (UC-18, UC-14)',
        params: IdParams,
        response: { 200: OrderDetailsResponse, ...errorResponses(401, 403, 404, 409, 422) },
      },
    },
    async (request) => services(request).orders.complete(currentUser(request), request.params.id),
  );

  app.post(
    '/:id/bids',
    {
      schema: {
        tags: ['bids'],
        summary: 'Водитель: откликнуться на заявку (UC-10, UC-11)',
        params: IdParams,
        body: BidCreateRequest,
        response: { 201: OrderDetailsResponse, ...errorResponses(401, 403, 404, 409, 422) },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await services(request).bids.place(currentUser(request), request.params.id, request.body)),
  );

  app.post(
    '/:id/reviews',
    {
      schema: {
        tags: ['orders'],
        summary: 'Отзыв и оценка контрагенту после завершения (UC-19)',
        params: IdParams,
        body: ReviewCreateRequest,
        response: { 201: ReviewResponse, ...errorResponses(401, 403, 404, 409, 422) },
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(await services(request).reviews.create(currentUser(request), request.params.id, request.body)),
  );
};
