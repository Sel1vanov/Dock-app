import { UniqueConstraintViolationException } from '@mikro-orm/core';

import { ConflictError, ForbiddenError, NotFoundError } from '../core/errors.js';
import {
  type Bid,
  BidStatus,
  type Order,
  OrderStatus,
  type User,
  UserRole,
  type Vehicle,
  VerificationStatus,
} from '../models/index.js';
import { BidRepository, OrderRepository, VehicleRepository } from '../repositories/index.js';
import type { BidCreateInput, BidUpdateInput } from '../schemas/bids.js';
import type { ServiceContext } from './context.js';
import { toOrderListItem } from './mappers.js';
import { isOpen, OrderService } from './OrderService.js';

/** UC-09: груз помещается в ТС по массе и габаритам, а тип груза ТС возит. */
export function fitsVehicle(vehicle: Vehicle, order: Order): boolean {
  return (
    order.cargoWeightKg <= vehicle.maxWeightKg &&
    order.cargoLengthM <= vehicle.lengthM &&
    order.cargoWidthM <= vehicle.widthM &&
    order.cargoHeightM <= vehicle.heightM &&
    vehicle.cargoTypes.getItems().some((c) => c.code === order.cargoType.code)
  );
}

/** Торг: отклики водителей (UC-10, UC-11) и выбор исполнителя заказчиком (UC-06). */
export class BidService {
  private readonly bids: BidRepository;
  private readonly orders: OrderRepository;
  private readonly vehicles: VehicleRepository;

  constructor(private readonly ctx: ServiceContext) {
    this.bids = new BidRepository(ctx.em);
    this.orders = new OrderRepository(ctx.em);
    this.vehicles = new VehicleRepository(ctx.em);
  }

  /** Отклик по цене заказчика или со встречной ценой. Первый отклик переводит заявку в «Идёт торг». */
  async place(user: User, orderId: string, input: BidCreateInput) {
    if (user.role !== UserRole.Driver) throw new ForbiddenError('Откликаться на заявки могут только водители');
    if (user.verificationStatus !== VerificationStatus.Verified) {
      throw new ForbiddenError('Отклик доступен после проверки документов администратором');
    }
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundError('Заявка не найдена');
    if (!isOpen(order)) throw new ConflictError('Заявка уже не принимает отклики');
    if (await this.bids.findByOrderAndDriver(order.id, user.id)) {
      throw new ConflictError('Вы уже откликнулись на эту заявку — измените свой отклик');
    }
    const myVehicles = await this.vehicles.listByDriver(user.id);
    if (!myVehicles.some((v) => fitsVehicle(v, order))) {
      throw new ConflictError('Ни одно ваше ТС не подходит под габариты, массу или тип груза');
    }

    const bid = this.bids.create({ order, driver: user, offeredPrice: input.price, comment: input.comment || null });
    if (order.status === OrderStatus.Created) order.status = OrderStatus.Bidding;
    try {
      await this.ctx.em.flush(); // INSERT отклика и UPDATE статуса заявки — одна транзакция
    } catch (e) {
      if (e instanceof UniqueConstraintViolationException) throw new ConflictError('Вы уже откликнулись на эту заявку');
      throw e;
    }
    return new OrderService(this.ctx).getDetails(user, bid.order.id);
  }

  async update(user: User, bidId: string, input: BidUpdateInput) {
    const bid = await this.getOwnedPending(user, bidId);
    if (input.price !== undefined) bid.offeredPrice = input.price;
    if (input.comment !== undefined) bid.comment = input.comment || null;
    await this.ctx.em.flush();
    return new OrderService(this.ctx).getDetails(user, bid.order.id);
  }

  /** Отозвать можно только ожидающий отклик. Если откликов не осталось, заявка снова «ищет исполнителя». */
  async withdraw(user: User, bidId: string) {
    const bid = await this.getOwnedPending(user, bidId);
    const order = bid.order;
    const isLastBid = (await this.bids.countByOrder(order.id)) === 1; // считаем до удаления
    this.bids.remove(bid);
    if (order.status === OrderStatus.Bidding && isLastBid) order.status = OrderStatus.Created;
    await this.ctx.em.flush(); // DELETE отклика и UPDATE заявки — одна транзакция
  }

  /**
   * UC-06: выбор исполнителя — многошаговая операция в ОДНОЙ транзакции с явными commit/rollback:
   * блокировка строки заявки (SELECT … FOR UPDATE), назначение водителя и цены, принятие отклика,
   * отклонение остальных. Если любой шаг падает — rollback, и в БД не остаётся «половины» изменений.
   */
  async accept(user: User, bidId: string) {
    const em = this.ctx.em;
    await em.begin();
    try {
      const bid = await this.bids.findById(bidId);
      if (!bid) throw new NotFoundError('Отклик не найден');
      const order = await this.orders.findByIdForUpdate(bid.order.id);
      if (!order) throw new NotFoundError('Заявка не найдена');
      if (order.client.id !== user.id) throw new ForbiddenError('Выбрать исполнителя может только автор заявки');
      if (!isOpen(order)) throw new ConflictError('Исполнитель по заявке уже выбран или заявка закрыта');
      if (bid.status !== BidStatus.Pending) throw new ConflictError('Отклик уже обработан');

      order.driver = bid.driver;
      order.price = bid.offeredPrice;
      order.status = OrderStatus.Assigned;
      bid.status = BidStatus.Accepted;
      await em.flush(); // UPDATE orders, UPDATE bids — ещё внутри транзакции
      await this.bids.rejectPendingExcept(order.id, bid.id);
      await em.commit();
    } catch (e) {
      await em.rollback();
      throw e;
    }
    const bid = await this.bids.findById(bidId);
    return new OrderService(this.ctx).getDetails(user, bid!.order.id);
  }

  async reject(user: User, bidId: string) {
    const bid = await this.bids.findById(bidId);
    if (!bid) throw new NotFoundError('Отклик не найден');
    if (bid.order.client.id !== user.id) throw new ForbiddenError('Отклонить отклик может только автор заявки');
    if (bid.status !== BidStatus.Pending || !isOpen(bid.order)) throw new ConflictError('Отклик уже обработан');
    bid.status = BidStatus.Rejected;
    await this.ctx.em.flush();
    return new OrderService(this.ctx).getDetails(user, bid.order.id);
  }

  /** «Мои отклики» водителя вместе с заявками. */
  async listMine(user: User, status?: BidStatus) {
    if (user.role !== UserRole.Driver) throw new ForbiddenError('Раздел доступен только водителям');
    const bids = await this.bids.listByDriver(user.id, status);
    const counts = await this.bids.countByOrders(bids.map((b) => b.order.id));
    return bids.map((b) => ({
      id: b.id,
      price: b.offeredPrice,
      comment: b.comment,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
      order: toOrderListItem(b.order, { bidsCount: counts.get(b.order.id) ?? 0, myBid: b }),
    }));
  }

  private async getOwnedPending(user: User, bidId: string): Promise<Bid> {
    const bid = await this.bids.findById(bidId);
    if (!bid) throw new NotFoundError('Отклик не найден');
    if (bid.driver.id !== user.id) throw new ForbiddenError('Это отклик другого водителя');
    if (bid.status !== BidStatus.Pending || !isOpen(bid.order)) {
      throw new ConflictError('Изменить или отозвать можно только ожидающий отклик');
    }
    return bid;
  }
}
