import type { Opt } from '@mikro-orm/core';
import { Check, Entity, Enum, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es';

import { ACTIVE_TRIP_STATUSES, DisputeStatus, type OrderStatus } from './enums.js';
import { Order } from './Order.js';
import { User } from './User.js';

/**
 * Спор по заказу (UC-20 «Открыть спор», UC-21 «Разрешить спор»).
 * Открывает заказчик или водитель после оплаты и до приёмки; решает администратор:
 * в пользу заказчика (заказ отменяется, средства возвращаются) или водителя (заказ завершается, выплата).
 */
@Entity({ tableName: 'disputes' })
@Check({ name: 'ck_disputes_reason', expression: 'char_length(btrim(reason)) >= 5' })
@Check({
  name: 'ck_disputes_resolution',
  expression: `(status = 'Open' and resolved_at is null and resolution_comment is null)
    or (status <> 'Open' and resolved_at is not null and resolution_comment is not null)`,
})
// По заказу может быть открыт только один спор одновременно (частичный уникальный индекс).
@Index({
  name: 'uk_disputes_order_open',
  expression: `create unique index "uk_disputes_order_open" on "disputes" ("order_id") where status = 'Open'`,
})
// Очередь администратора: WHERE status = ? ORDER BY created_at
@Index({ name: 'idx_disputes_status_created', properties: ['status', 'createdAt'] })
export class Dispute {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  /** Спор — часть истории заказа (CASCADE), как отклики, фото и отзывы. */
  @Index({ name: 'idx_disputes_order' })
  @ManyToOne(() => Order, { deleteRule: 'cascade' })
  order!: Order;

  /** Кто открыл спор: заказчик или водитель. Участников сделок не удаляют физически (RESTRICT). */
  @ManyToOne(() => User, { deleteRule: 'restrict' })
  openedBy!: User;

  @Property({ type: 'string', length: 500 })
  reason!: string;

  /** Этап рейса, на котором открыт спор: администратор видит, где возникла проблема. */
  @Enum({ items: [...ACTIVE_TRIP_STATUSES] })
  orderStatusAtOpen!: OrderStatus;

  @Enum({ items: () => DisputeStatus, default: DisputeStatus.Open })
  status: Opt<DisputeStatus> = DisputeStatus.Open;

  @Property({ type: 'string', length: 500, nullable: true })
  resolutionComment: string | null = null;

  /** Администратор, принявший решение. Если его аккаунт удалят, решение остаётся (SET NULL). */
  @ManyToOne(() => User, { nullable: true, deleteRule: 'set null' })
  resolvedBy: User | null = null;

  @Property({ type: 'datetime', nullable: true })
  resolvedAt: Date | null = null;

  @Property({ type: 'datetime', defaultRaw: 'now()' })
  createdAt: Opt<Date> = new Date();
}
