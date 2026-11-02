import { DecimalType, type Opt } from '@mikro-orm/core';
import { Check, Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';

import { BidStatus } from './enums.js';
import { Order } from './Order.js';
import { User } from './User.js';

/**
 * Отклик водителя с ценой (SAD 5, класс Bid). Связывает заказы и водителей (N:M с атрибутами:
 * цена, комментарий, встречная цена заказчика, статус). Один водитель — один отклик на заявку; принятый отклик — не более
 * одного на заявку (частичный уникальный индекс).
 */
@Entity({ tableName: 'bids' })
@Unique({ name: 'uk_bids_order_driver', properties: ['order', 'driver'] })
@Unique({ name: 'uk_bids_one_accepted', properties: ['order'], where: `status = 'Accepted'` })
@Index({ name: 'idx_bids_driver_created', columns: [{ name: 'driver_id' }, { name: 'created_at', sort: 'desc' }] })
@Check({ name: 'ck_bids_price_positive', expression: 'offered_price > 0' })
@Check({ name: 'ck_bids_counter_price_positive', expression: 'counter_price is null or counter_price > 0' })
export class Bid {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  /** Отклики существуют только в рамках заявки (CASCADE). */
  @ManyToOne(() => Order, { deleteRule: 'cascade' })
  order!: Order;

  @ManyToOne(() => User, { deleteRule: 'cascade' })
  driver!: User;

  @Property({ type: new DecimalType('number'), precision: 12, scale: 2 })
  offeredPrice!: number;

  @Property({ type: 'string', length: 300, nullable: true })
  comment: string | null = null;

  /** Встречная цена заказчика (двусторонний торг). null — заказчик свою цену не предлагал. */
  @Property({ type: new DecimalType('number'), precision: 12, scale: 2, nullable: true })
  counterPrice: number | null = null;

  @Enum({ items: () => BidStatus, default: BidStatus.Pending })
  status: Opt<BidStatus> = BidStatus.Pending;

  @Property({ type: 'datetime', defaultRaw: 'now()' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'datetime', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();
}
