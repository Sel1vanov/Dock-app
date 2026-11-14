import { DecimalType, type Opt } from '@mikro-orm/core';
import { Check, Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';

import { BidStatus } from './enums.js';
import { Order } from './Order.js';
import { User } from './User.js';

// отклик водителя с ценой (SAD 5, класс Bid). по сути N:M между заказами и водителями с доп. полями:
// цена, комментарий, встречная цена заказчика, статус
// один водитель - один отклик на заявку, принятый отклик на заявку максимум один (частичный уникальный индекс)
@Entity({ tableName: 'bids' })
@Unique({ name: 'uk_bids_order_driver', properties: ['order', 'driver'] })
@Unique({ name: 'uk_bids_one_accepted', properties: ['order'], where: `status = 'Accepted'` })
@Index({ name: 'idx_bids_driver_created', columns: [{ name: 'driver_id' }, { name: 'created_at', sort: 'desc' }] })
@Check({ name: 'ck_bids_price_positive', expression: 'offered_price > 0' })
@Check({ name: 'ck_bids_counter_price_positive', expression: 'counter_price is null or counter_price > 0' })
export class Bid {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  // отклик без заявки не живет (CASCADE)
  @ManyToOne(() => Order, { deleteRule: 'cascade' })
  order!: Order;

  @ManyToOne(() => User, { deleteRule: 'cascade' })
  driver!: User;

  @Property({ type: new DecimalType('number'), precision: 12, scale: 2 })
  offeredPrice!: number;

  @Property({ type: 'string', length: 300, nullable: true })
  comment: string | null = null;

  // встречная цена заказчика (торг в обе стороны). null - заказчик свою цену не предлагал
  @Property({ type: new DecimalType('number'), precision: 12, scale: 2, nullable: true })
  counterPrice: number | null = null;

  @Enum({ items: () => BidStatus, default: BidStatus.Pending })
  status: Opt<BidStatus> = BidStatus.Pending;

  @Property({ type: 'datetime', defaultRaw: 'now()' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'datetime', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();
}
