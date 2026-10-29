import { type EntityManager, raw } from '@mikro-orm/postgresql';

import { Bid, BidStatus } from '../models/index.js';

/** Отклики водителей (таблица bids). */
export class BidRepository {
  constructor(private readonly em: EntityManager) {}

  create(data: Pick<Bid, 'order' | 'driver' | 'offeredPrice' | 'comment'>): Bid {
    return this.em.create(Bid, data);
  }

  remove(bid: Bid): void {
    this.em.remove(bid);
  }

  findById(id: string): Promise<Bid | null> {
    return this.em.findOne(
      Bid,
      { id },
      { populate: ['order', 'order.client', 'order.cargoType', 'driver'], strategy: 'joined' },
    );
  }

  /** Ожидающие отклики заявки, кроме выбранного: их авторам уходит уведомление об отказе. */
  listPendingExcept(orderId: string, exceptBidId: string): Promise<Bid[]> {
    return this.em.find(Bid, { order: orderId, status: BidStatus.Pending, id: { $ne: exceptBidId } });
  }

  findByOrderAndDriver(orderId: string, driverId: string): Promise<Bid | null> {
    return this.em.findOne(Bid, { order: orderId, driver: driverId });
  }

  countByOrder(orderId: string): Promise<number> {
    return this.em.count(Bid, { order: orderId });
  }

  /** Отклики водителя вместе с заявками — заявка, заказчик и тип груза JOIN-ом в одном запросе. */
  listByDriver(driverId: string, status?: BidStatus): Promise<Bid[]> {
    return this.em.find(
      Bid,
      { driver: driverId, ...(status ? { status } : {}) },
      {
        populate: ['order', 'order.client', 'order.cargoType'],
        strategy: 'joined',
        orderBy: { createdAt: 'desc', id: 'asc' },
      },
    );
  }

  /** Число откликов для всех заявок страницы — один запрос с GROUP BY. */
  async countByOrders(orderIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (orderIds.length === 0) return result;
    const rows = await this.em
      .createQueryBuilder(Bid, 'b')
      .select(['b.order', raw('count(*) as count')])
      .where({ order: { $in: orderIds } })
      .groupBy('b.order')
      .execute('all', false);
    for (const row of rows as unknown as Record<string, string>[]) {
      result.set(row.order_id ?? row.order, Number(row.count));
    }
    return result;
  }

  /** Отклики текущего водителя на заявки страницы ленты — один запрос IN (…). */
  async findByDriverForOrders(driverId: string, orderIds: string[]): Promise<Map<string, Bid>> {
    const result = new Map<string, Bid>();
    if (orderIds.length === 0) return result;
    const bids = await this.em.find(Bid, { driver: driverId, order: { $in: orderIds } });
    for (const bid of bids) result.set(bid.order.id, bid);
    return result;
  }

  /** Отклонить остальные ожидающие отклики заявки (часть транзакции выбора исполнителя). */
  rejectPendingExcept(orderId: string, exceptBidId: string | null): Promise<number> {
    return this.em.nativeUpdate(
      Bid,
      { order: orderId, status: BidStatus.Pending, ...(exceptBidId ? { id: { $ne: exceptBidId } } : {}) },
      { status: BidStatus.Rejected, updatedAt: new Date() },
    );
  }
}
