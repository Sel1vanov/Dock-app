import type { Opt } from '@mikro-orm/core';
import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';

import { PhotoStage } from './enums.js';
import { Order } from './Order.js';

// фото груза при погрузке и выгрузке (SAD 5, класс OrderPhoto, UC-17)
// храню ключ файла в хранилище, а не публичную ссылку: ссылку api подписывает на время
// кто загрузил не храню - это всегда назначенный водитель заказа
@Entity({ tableName: 'order_photos' })
export class OrderPhoto {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  // фото - часть заказа (в SAD композиция), удаляются вместе с ним (CASCADE)
  @Index({ name: 'idx_order_photos_order' })
  @ManyToOne(() => Order, { deleteRule: 'cascade' })
  order!: Order;

  @Enum({ items: () => PhotoStage })
  stage!: PhotoStage;

  @Unique({ name: 'uk_order_photos_file_key' })
  @Property({ type: 'string', length: 255 })
  fileKey!: string;

  @Property({ type: 'datetime', defaultRaw: 'now()' })
  uploadedAt: Opt<Date> = new Date();
}
