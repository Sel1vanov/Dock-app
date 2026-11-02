import { type EntityManager, LockMode } from '@mikro-orm/postgresql';

import { Dispute, type DisputeStatus } from '../models/index.js';

/** Споры по заказам (таблица disputes). */
export class DisputeRepository {
  constructor(private readonly em: EntityManager) {}

  create(data: Pick<Dispute, 'order' | 'openedBy' | 'reason' | 'orderStatusAtOpen'>): Dispute {
    return this.em.create(Dispute, data);
  }

  /** Спор вместе с заказом и его участниками — для решения администратора (JOIN в одном запросе). */
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

  /** Строка спора с блокировкой FOR UPDATE — внутри транзакции (решение администратора). */
  lockById(id: string): Promise<Dispute | null> {
    return this.em.findOne(Dispute, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE });
  }

  /** Очередь администратора: фильтр по статусу, старые сверху, LIMIT/OFFSET; связи — JOIN. */
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
