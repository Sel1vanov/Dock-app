import type { Opt } from '@mikro-orm/core';
import { Check, Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';

import { Order } from './Order.js';
import { User } from './User.js';

/**
 * Отзыв и оценка контрагенту после завершения заказа (UC-19).
 * Каждая сторона оставляет не больше одного отзыва по заказу; оценить себя нельзя.
 */
@Entity({ tableName: 'reviews' })
@Unique({ name: 'uk_reviews_order_author', properties: ['order', 'author'] })
@Check({ name: 'ck_reviews_rating_range', expression: 'rating between 1 and 5' })
@Check({ name: 'ck_reviews_not_self', expression: 'author_id <> target_id' })
export class Review {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => Order, { deleteRule: 'cascade' })
  order!: Order;

  /** Пользователей с историей отзывов не удаляют физически (RESTRICT) — их блокируют. */
  @ManyToOne(() => User, { deleteRule: 'restrict' })
  author!: User;

  /** Индекс — для подсчёта рейтинга пользователя (avg по target_id). */
  @Index({ name: 'idx_reviews_target' })
  @ManyToOne(() => User, { deleteRule: 'restrict' })
  target!: User;

  @Property({ type: 'smallint' })
  rating!: number;

  @Property({ type: 'string', length: 500, nullable: true })
  comment: string | null = null;

  @Property({ type: 'datetime', defaultRaw: 'now()' })
  createdAt: Opt<Date> = new Date();
}
