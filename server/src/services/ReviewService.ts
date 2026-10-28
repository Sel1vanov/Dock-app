import { UniqueConstraintViolationException } from '@mikro-orm/core';

import { ConflictError, ForbiddenError, NotFoundError } from '../core/errors.js';
import { OrderStatus, type User } from '../models/index.js';
import { OrderRepository, ReviewRepository } from '../repositories/index.js';
import type { ReviewCreateInput } from '../schemas/orders.js';
import type { ServiceContext } from './context.js';

const DUPLICATE = 'Вы уже оставили отзыв по этому заказу';

/** UC-19: отзыв и оценка контрагенту после завершения заказа. */
export class ReviewService {
  private readonly orders: OrderRepository;
  private readonly reviews: ReviewRepository;

  constructor(private readonly ctx: ServiceContext) {
    this.orders = new OrderRepository(ctx.em);
    this.reviews = new ReviewRepository(ctx.em);
  }

  async create(user: User, orderId: string, input: ReviewCreateInput) {
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundError('Заявка не найдена');
    const isClient = order.client.id === user.id;
    const isDriver = order.driver?.id === user.id;
    if (!isClient && !isDriver) throw new ForbiddenError('Отзыв оставляют только участники заказа');
    if (order.status !== OrderStatus.Completed) throw new ConflictError('Отзыв можно оставить после завершения заказа');
    if (await this.reviews.exists(order.id, user.id)) throw new ConflictError(DUPLICATE);

    const review = this.reviews.create({
      order,
      author: user,
      target: isClient ? order.driver! : order.client,
      rating: input.rating,
      comment: input.comment || null,
    });
    try {
      await this.ctx.em.flush();
    } catch (e) {
      if (e instanceof UniqueConstraintViolationException) throw new ConflictError(DUPLICATE);
      throw e;
    }
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      targetId: review.target.id,
      createdAt: review.createdAt.toISOString(),
    };
  }
}
