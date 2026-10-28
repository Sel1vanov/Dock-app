import type { EntityManager } from '@mikro-orm/postgresql';

import { OrderPhoto, type PhotoStage } from '../models/index.js';

/** Записи фотофиксации (order_photos). Сами файлы — в FileStorage. */
export class PhotoRepository {
  constructor(private readonly em: EntityManager) {}

  create(data: Pick<OrderPhoto, 'order' | 'stage' | 'fileKey'>): OrderPhoto {
    return this.em.create(OrderPhoto, data);
  }

  async existsForStage(orderId: string, stage: PhotoStage): Promise<boolean> {
    return (await this.em.count(OrderPhoto, { order: orderId, stage })) > 0;
  }
}
