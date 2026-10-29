import type { EntityManager } from '@mikro-orm/postgresql';

import { Review } from '../models/index.js';

export class ReviewRepository {
  constructor(private readonly em: EntityManager) {}

  create(data: Pick<Review, 'order' | 'author' | 'target' | 'rating' | 'comment'>): Review {
    return this.em.create(Review, data);
  }

  /** Отзывы о пользователе, новые сверху; автор подтягивается JOIN-ом в том же запросе. */
  listByTarget(targetId: string, page: { limit: number; offset: number }): Promise<[Review[], number]> {
    return this.em.findAndCount(
      Review,
      { target: targetId },
      {
        populate: ['author'],
        strategy: 'joined',
        orderBy: { createdAt: 'desc', id: 'asc' },
        limit: page.limit,
        offset: page.offset,
      },
    );
  }

  async exists(orderId: string, authorId: string): Promise<boolean> {
    return (await this.em.count(Review, { order: orderId, author: authorId })) > 0;
  }
}
