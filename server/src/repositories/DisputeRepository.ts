import { type EntityManager, LockMode } from '@mikro-orm/postgresql';

import { Dispute, type DisputeStatus } from '../models/index.js';

// споры по заказам (таблица disputes)
export class DisputeRepository {
  constructor(private readonly em: EntityManager) {}

  create(data: Pick<Dispute, 'order' | 'openedBy' | 'reason' | 'orderStatusAtOpen'>): Dispute {
    return this.em.create(Dispute, data);
  }

  // спор вместе с заказом и участниками, одним запросом с JOIN - для решения админа
  findById(id: string): Promise<Dispute | null> {
    return this.em.findOne(
      Dispute,
      { id },
      {
        populate: ['openedBy', 'resolvedBy', 'order', 'order.client', 'order.driver', 'order.cargoType'],
        strategy: 'joined',
      },
    );
  }

  // строка спора с FOR UPDATE, вызывать внутри транзакции (решение админа)
  lockById(id: string): Promise<Dispute | null> {
    return this.em.findOne(Dispute, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE });
  }

  // очередь админа: фильтр по статусу, старые сверху, LIMIT/OFFSET, связи через JOIN
  list(filter: { status?: DisputeStatus; limit: number; offset: number }): Promise<[Dispute[], number]> {
    return this.em.findAndCount(Dispute, filter.status ? { status: filter.status } : {}, {
      populate: ['openedBy', 'resolvedBy', 'order', 'order.client', 'order.driver', 'order.cargoType'],
      strategy: 'joined',
      orderBy: { createdAt: 'asc', id: 'asc' },
      limit: filter.limit,
      offset: filter.offset,
    });
  }
}
