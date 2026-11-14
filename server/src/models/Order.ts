import { Collection, DecimalType, type Opt } from '@mikro-orm/core';
import { Check, Entity, Enum, Index, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/decorators/es';

import { Bid } from './Bid.js';
import { CargoType } from './CargoType.js';
import { Dispute } from './Dispute.js';
import { OrderStatus } from './enums.js';
import { OrderPhoto } from './OrderPhoto.js';
import { Review } from './Review.js';
import { User } from './User.js';

// заявка на перевозку (SAD 5, класс Order) - главная сущность
// связку статус/исполнитель/оплата проверяют CHECK-и в базе, так что кривую комбинацию
// не записать даже в обход api
@Entity({ tableName: 'orders' })
@Check({
  name: 'ck_orders_cargo_dimensions',
  expression: 'cargo_weight_kg > 0 and cargo_length_m > 0 and cargo_width_m > 0 and cargo_height_m > 0',
})
@Check({ name: 'ck_orders_price_positive', expression: 'price > 0' })
@Check({
  name: 'ck_orders_addresses',
  expression: 'char_length(btrim(origin_address)) >= 3 and char_length(btrim(destination_address)) >= 3',
})
@Check({
  name: 'ck_orders_driver_by_status',
  expression: `(status in ('Created', 'Bidding') and driver_id is null)
    or (status in ('Assigned', 'Loading', 'InTransit', 'Unloading', 'Disputed', 'Completed') and driver_id is not null)
    or status = 'Cancelled'`,
})
@Check({
  name: 'ck_orders_escrow_by_status',
  expression: `(not is_escrow_locked or status in ('Assigned', 'Loading', 'InTransit', 'Unloading', 'Disputed'))
    and (is_escrow_locked or status not in ('Loading', 'InTransit', 'Unloading', 'Disputed'))`,
})
@Check({ name: 'ck_orders_cancel_reason', expression: `cancel_reason is null or status = 'Cancelled'` })
@Index({ name: 'idx_orders_client_created', columns: [{ name: 'client_id' }, { name: 'created_at', sort: 'desc' }] })
@Index({
  name: 'idx_orders_driver_updated',
  columns: [{ name: 'driver_id' }, { name: 'updated_at', sort: 'desc' }],
  where: 'driver_id is not null',
})
@Index({
  name: 'idx_orders_open_created',
  columns: [{ name: 'created_at', sort: 'desc' }],
  where: `status in ('Created', 'Bidding')`,
})
// поиск по тексту заявки (ILIKE '%...%'): триграммный GIN-индекс по тому же выражению, что и в запросе
@Index({
  name: 'idx_orders_search_trgm',
  expression: `create index "idx_orders_search_trgm" on "orders" using gin ((coalesce(description, '') || ' ' || origin_address || ' ' || destination_address) gin_trgm_ops)`,
})
export class Order {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  // заказчика с заявками удалить нельзя (RESTRICT) - заявки это история сделок и расчетов
  @ManyToOne(() => User, { deleteRule: 'restrict' })
  client!: User;

  // назначенный водитель, пока не выбран - NULL. RESTRICT по той же причине
  @ManyToOne(() => User, { nullable: true, deleteRule: 'restrict' })
  driver: User | null = null;

  @ManyToOne(() => CargoType, { deleteRule: 'restrict' })
  cargoType!: CargoType;

  @Property({ type: 'string', length: 500, nullable: true })
  description: string | null = null;

  // в базе кг и метры, тонны показываются только в интерфейсе
  @Property({ type: new DecimalType('number'), precision: 10, scale: 2 })
  cargoWeightKg!: number;

  @Property({ type: new DecimalType('number'), precision: 5, scale: 2 })
  cargoLengthM!: number;

  @Property({ type: new DecimalType('number'), precision: 5, scale: 2 })
  cargoWidthM!: number;

  @Property({ type: new DecimalType('number'), precision: 5, scale: 2 })
  cargoHeightM!: number;

  @Property({ type: 'string', length: 300 })
  originAddress!: string;

  @Property({ type: 'string', length: 300 })
  destinationAddress!: string;

  @Property({ type: new DecimalType('number'), precision: 12, scale: 2 })
  price!: number;

  @Enum({ items: () => OrderStatus, default: OrderStatus.Created })
  status: Opt<OrderStatus> = OrderStatus.Created;

  // безопасная сделка (UC-13): деньги заморожены до приемки груза
  @Property({ type: 'boolean', default: false })
  isEscrowLocked: Opt<boolean> = false;

  @Property({ type: 'string', length: 300, nullable: true })
  cancelReason: string | null = null;

  @Property({ type: 'datetime', defaultRaw: 'now()' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'datetime', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  @OneToMany(() => Bid, (b) => b.order)
  bids = new Collection<Bid>(this);

  @OneToMany(() => OrderPhoto, (p) => p.order)
  photos = new Collection<OrderPhoto>(this);

  @OneToMany(() => Review, (r) => r.order)
  reviews = new Collection<Review>(this);

  @OneToMany(() => Dispute, (d) => d.order)
  disputes = new Collection<Dispute>(this);
}
