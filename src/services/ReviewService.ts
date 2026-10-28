import { AppError } from '../core/errors';
import type { OrderDetailsDTO } from '../models/dto';
import type { ReviewInput } from '../models/schemas';
import { OrderRepository } from '../repositories/OrderRepository';

/** UC-19: отзыв и оценка контрагенту после завершения заказа. */
export const ReviewService = {
  canReview(order: OrderDetailsDTO, userId: string): boolean {
    const isParticipant = userId === order.clientId || userId === order.driverId;
    return order.status === 'Completed' && isParticipant && !order.reviewAuthorIds.includes(userId);
  },

  async leaveReview(order: OrderDetailsDTO, authorId: string, input: ReviewInput): Promise<void> {
    if (!ReviewService.canReview(order, authorId)) throw new AppError('Отзыв по этому заказу недоступен');
    await OrderRepository.review(order.id, input.rating, input.comment);
  },
};
