import { AppError } from '../core/errors';
import type { OrderDetailsDTO } from '../models/dto';
import type { ReviewInput } from '../models/schemas';
import { ReviewRepository } from '../repositories/ReviewRepository';

/** UC-19: отзыв и оценка контрагенту после завершения заказа. */
export const ReviewService = {
  canReview(order: OrderDetailsDTO, userId: string): boolean {
    const isParticipant = userId === order.clientId || userId === order.driverId;
    return order.status === 'Completed' && isParticipant && !order.reviewAuthorIds.includes(userId);
  },

  async leaveReview(order: OrderDetailsDTO, authorId: string, input: ReviewInput): Promise<void> {
    if (!ReviewService.canReview(order, authorId)) throw new AppError('Отзыв по этому заказу недоступен');
    const targetId = authorId === order.clientId ? order.driverId : order.clientId;
    if (!targetId) throw new AppError('Не найден получатель отзыва');
    await ReviewRepository.createReview({
      order_id: order.id,
      author_id: authorId,
      target_id: targetId,
      rating: input.rating,
      comment: input.comment || null,
    });
  },
};
