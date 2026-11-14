import type { Opt } from '@mikro-orm/core';
import { Check, Entity, Enum, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es';

import { ACTIVE_TRIP_STATUSES, DisputeStatus, type OrderStatus } from './enums.js';
import { Order } from './Order.js';
import { User } from './User.js';

// спор по заказу (UC-20 открыть спор, UC-21 разрешить спор)
// открыть может заказчик или водитель после оплаты и до приемки, решает админ:
// в пользу заказчика (заказ отменяется, деньги возвращаются) или водителя (заказ завершается, выплата)
@Entity({ tableName: 'disputes' })
@Check({ name: 'ck_disputes_reason', expression: 'char_length(btrim(reason)) >= 5' })
@Check({
  name: 'ck_disputes_resolution',
  expression: `(status = 'Open' and resolved_at is null and resolution_comment is null)
    or (status <> 'Open' and resolved_at is not null and resolution_comment is not null)`,
})
// на заказ только один открытый спор одновременно (частичный уникальный индекс)
@Index({
  name: 'uk_disputes_order_open',
  expression: `create unique index "uk_disputes_order_open" on "disputes" ("order_id") where status = 'Open'`,
})
// очередь админа: WHERE status = ? ORDER BY created_at
@Index({ name: 'idx_disputes_status_created', properties: ['status', 'createdAt'] })
export class Dispute {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  // спор - часть истории заказа, удаляется вместе с ним (CASCADE), как отклики, фото и отзывы
  @Index({ name: 'idx_disputes_order' })
  @ManyToOne(() => Order, { deleteRule: 'cascade' })
  order!: Order;

  // кто открыл: заказчик или водитель. участников сделок из базы не удаляем (RESTRICT)
  @ManyToOne(() => User, { deleteRule: 'restrict' })
  openedBy!: User;

  @Property({ type: 'string', length: 500 })
  reason!: string;

  // на каком этапе рейса открыли спор - чтобы админ видел, где возникла проблема
  @Enum({ items: [...ACTIVE_TRIP_STATUSES] })
  orderStatusAtOpen!: OrderStatus;

  @Enum({ items: () => DisputeStatus, default: DisputeStatus.Open })
  status: Opt<DisputeStatus> = DisputeStatus.Open;

  @Property({ type: 'string', length: 500, nullable: true })
  resolutionComment: string | null = null;

  // админ, который принял решение. если его аккаунт удалят - решение останется (SET NULL)
  @ManyToOne(() => User, { nullable: true, deleteRule: 'set null' })
  resolvedBy: User | null = null;

  @Property({ type: 'datetime', nullable: true })
  resolvedAt: Date | null = null;

  @Property({ type: 'datetime', defaultRaw: 'now()' })
  createdAt: Opt<Date> = new Date();
}
