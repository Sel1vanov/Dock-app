import type { EntityManager } from '@mikro-orm/postgresql';

import { Review } from '../models/index.js';

export class ReviewRepository {
  constructor(private readonly em: EntityManager) {}

  create(data: Pick<Review, 'order' | 'author' | 'target' | 'rating' | 'comment'>): Review {
    return this.em.create(Review, data);
  }

  async exists(orderId: string, authorId: string): Promise<boolean> {
    return (await this.em.count(Review, { order: orderId, author: authorId })) > 0;
  }
}
