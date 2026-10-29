import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../core/errors.js';
import {
  type Bid,
  BidStatus,
  NotificationType,
  OPEN_ORDER_STATUSES,
  type Order,
  OrderStatus,
  PhotoStage,
  type User,
  UserRole,
} from '../models/index.js';
import {
  BidRepository,
  CargoTypeRepository,
  OrderRepository,
  PhotoRepository,
  UserRepository,
  VehicleRepository,
} from '../repositories/index.js';
import type { FeedQueryT, OrderCreateInput, OrderListQueryT, OrderUpdateInput } from '../schemas/orders.js';
import type { ServiceContext } from './context.js';
import { toOrderListItem, toPersonResponse, toPhotoResponse, toVehicleResponse } from './mappers.js';
import { NotificationService, orderTitle, rub } from './NotificationService.js';

export const isOpen = (order: Order) => (OPEN_ORDER_STATUSES as readonly OrderStatus[]).includes(order.status);

/** Жизненный цикл заявки: создание, списки, карточка, изменение, удаление, отмена, оплата, приёмка. */
export class OrderService {
  private readonly orders: OrderRepository;
  private readonly bids: BidRepository;
  private readonly users: UserRepository;
  private readonly vehicles: VehicleRepository;
  private readonly cargoTypes: CargoTypeRepository;
  private readonly photos: PhotoRepository;

  constructor(private readonly ctx: ServiceContext) {
    this.orders = new OrderRepository(ctx.em);
    this.bids = new BidRepository(ctx.em);
    this.users = new UserRepository(ctx.em);
    this.vehicles = new VehicleRepository(ctx.em);
    this.cargoTypes = new CargoTypeRepository(ctx.em);
    this.photos = new PhotoRepository(ctx.em);
  }

  // --------------------------------------------------------------- списки ---

  /** Заказчик — свои заявки; водитель — свои рейсы (назначенные заказы). */
  async list(user: User, query: OrderListQueryT) {
    if (user.role === UserRole.Admin) throw new ForbiddenError('Список заявок доступен заказчикам и водителям');
    const [orders, total] =
      user.role === UserRole.Client
        ? await this.orders.listByClient(user.id, query)
        : await this.orders.listByDriver(user.id, query);
    return { items: await this.toListItems(orders, user), total, limit: query.limit, offset: query.offset };
  }

  /** UC-08 + UC-09: лента водителя под выбранное ТС. */
  async feed(user: User, query: FeedQueryT) {
    if (user.role !== UserRole.Driver) throw new ForbiddenError('Лента заявок доступна только водителям');
    const vehicle = await this.vehicles.findById(query.vehicleId);
    if (!vehicle) throw new NotFoundError('Транспорт не найден');
    if (vehicle.driver.id !== user.id) throw new ForbiddenError('Это транспорт другого водителя');

    const [[orders, total], openTotal] = await Promise.all([
      this.orders.feed(vehicle, query),
      this.orders.countOpen(query),
    ]);
    return {
      items: await this.toListItems(orders, user),
      total,
      limit: query.limit,
      offset: query.offset,
      hiddenCount: Math.max(0, openTotal - total),
    };
  }

  /** Элементы списка: +1 запрос на число откликов и +1 на отклики текущего водителя — для всей страницы. */
  async toListItems(orders: Order[], user: User) {
    const ids = orders.map((o) => o.id);
    const [counts, myBids] = await Promise.all([
      this.bids.countByOrders(ids),
      user.role === UserRole.Driver
        ? this.bids.findByDriverForOrders(user.id, ids)
        : Promise.resolve(new Map<string, Bid>()),
    ]);
    return orders.map((o) => toOrderListItem(o, { bidsCount: counts.get(o.id) ?? 0, myBid: myBids.get(o.id) ?? null }));
  }

  // -------------------------------------------------------------- карточка ---

  async getDetails(user: User, orderId: string) {
    const order = await this.orders.findDetails(orderId);
    if (!order) throw new NotFoundError('Заявка не найдена');

    const isAdmin = user.role === UserRole.Admin;
    const isClient = order.client.id === user.id;
    const isDriver = order.driver?.id === user.id;
    const allBids = order.bids.getItems();
    const myBid = allBids.find((b) => b.driver.id === user.id) ?? null;
    const canSee =
      isAdmin || isClient || isDriver || (user.role === UserRole.Driver && (isOpen(order) || myBid !== null));
    if (!canSee) throw new ForbiddenError('Нет доступа к этой заявке');

    // Все отклики видит только автор заявки; фото — только участники рейса.
    const visibleBids = isClient || isAdmin ? allBids : [];
    const isParticipant = isAdmin || isClient || isDriver;

    const personIds = [order.client.id, order.driver?.id, ...visibleBids.map((b) => b.driver.id)].filter(
      (id): id is string => Boolean(id),
    );
    const [ratings, vehiclesByDriver] = await Promise.all([
      this.users.getRatings(personIds),
      this.vehicles.listByDrivers(visibleBids.map((b) => b.driver.id)),
    ]);

    return {
      ...toOrderListItem(order, { bidsCount: allBids.length, myBid }),
      clientId: order.client.id,
      driverId: order.driver?.id ?? null,
      // Телефоны — только контрагентам по назначенному заказу.
      client: toPersonResponse(order.client, ratings, isAdmin || isClient || isDriver),
      driver: order.driver ? toPersonResponse(order.driver, ratings, isAdmin || isClient || isDriver) : null,
      bids: visibleBids.map((b) => ({
        id: b.id,
        price: b.offeredPrice,
        counterPrice: b.counterPrice,
        comment: b.comment,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
        driver: toPersonResponse(b.driver, ratings, isAdmin),
        vehicles: (vehiclesByDriver.get(b.driver.id) ?? []).map(toVehicleResponse),
      })),
      photos: isParticipant ? order.photos.getItems().map((p) => toPhotoResponse(p, this.ctx.config)) : [],
      cancelReason: order.cancelReason,
      reviewAuthorIds: order.reviews.getItems().map((r) => r.author.id),
    };
  }

  // ---------------------------------------------------------------- CRUD ---

  /** UC-03 + UC-04 */
  async create(user: User, input: OrderCreateInput) {
    if (user.role !== UserRole.Client) throw new ForbiddenError('Создавать заявки могут только заказчики');
    const cargoType = await this.cargoTypes.findByCode(input.cargoTypeCode);
    if (!cargoType) throw unknownCargoType();
    const order = this.orders.create({
      client: user,
      cargoType,
      description: input.description || null,
      cargoWeightKg: input.weightKg,
      cargoLengthM: input.lengthM,
      cargoWidthM: input.widthM,
      cargoHeightM: input.heightM,
      originAddress: input.originAddress,
      destinationAddress: input.destinationAddress,
      price: input.price,
    });
    await this.ctx.em.flush();
    return this.getDetails(user, order.id);
  }

  /** Изменить можно только свою заявку, пока на неё никто не откликнулся. */
  async update(user: User, orderId: string, input: OrderUpdateInput) {
    const order = await this.getOwned(user, orderId);
    if (order.status !== OrderStatus.Created) {
      throw new ConflictError('Заявку с откликами изменить нельзя — отмените её и создайте новую');
    }
    if (input.cargoTypeCode !== undefined) {
      const cargoType = await this.cargoTypes.findByCode(input.cargoTypeCode);
      if (!cargoType) throw unknownCargoType();
      order.cargoType = cargoType;
    }
    const fields = {
      description: input.description,
      cargoWeightKg: input.weightKg,
      cargoLengthM: input.lengthM,
      cargoWidthM: input.widthM,
      cargoHeightM: input.heightM,
      originAddress: input.originAddress,
      destinationAddress: input.destinationAddress,
      price: input.price,
    };
    this.ctx.em.assign(
      order,
      Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as Partial<Order>,
    );
    if (order.description === '') order.description = null;
    await this.ctx.em.flush();
    return this.getDetails(user, order.id);
  }

  /** Удалить можно только заявку без откликов; иначе её отменяют (история торга сохраняется). */
  async remove(user: User, orderId: string) {
    const order = await this.getOwned(user, orderId);
    if (order.status !== OrderStatus.Created || (await this.bids.countByOrder(order.id)) > 0) {
      throw new ConflictError('Удалить можно только заявку без откликов. Эту заявку можно отменить');
    }
    this.orders.remove(order);
    await this.ctx.em.flush();
  }

  // ------------------------------------------------------- смена статусов ---

  /** UC-07: отмена до оплаты; ожидающие отклики отклоняются в той же транзакции (один flush). */
  async cancel(user: User, orderId: string, reason?: string) {
    const order = await this.getOwned(user, orderId);
    const allowed = isOpen(order) || (order.status === OrderStatus.Assigned && !order.isEscrowLocked);
    if (!allowed) throw new ConflictError('Заявку уже нельзя отменить: заказ оплачен или выполняется');
    await this.ctx.em.populate(order, ['bids']);
    const notifications = new NotificationService(this.ctx);
    const reasonText = reason ? ` Причина: ${reason}` : '';
    for (const bid of order.bids) {
      if (bid.status !== BidStatus.Pending) continue;
      bid.status = BidStatus.Rejected;
      notifications.notify(
        bid.driver,
        NotificationType.OrderCancelled,
        'Заявка отменена',
        `Заказчик отменил ${orderTitle(order)}.${reasonText}`,
        { order },
      );
    }
    if (order.driver) {
      notifications.notify(
        order.driver,
        NotificationType.OrderCancelled,
        'Заказ отменён',
        `Заказчик отменил ${orderTitle(order)} до оплаты.${reasonText}`,
        { order },
      );
    }
    order.status = OrderStatus.Cancelled;
    order.cancelReason = reason || null;
    await this.ctx.em.flush();
    return this.getDetails(user, order.id);
  }

  /** UC-12 + UC-13: оплата с заморозкой средств (демо безопасной сделки без платёжного шлюза). */
  async pay(user: User, orderId: string) {
    const order = await this.getOwned(user, orderId);
    if (order.status !== OrderStatus.Assigned || order.isEscrowLocked) {
      throw new ConflictError('Оплата доступна после выбора исполнителя и только один раз');
    }
    order.isEscrowLocked = true;
    new NotificationService(this.ctx).notify(
      order.driver!,
      NotificationType.OrderPaid,
      'Заказ оплачен',
      `${rub(order.price)} за ${orderTitle(order)} заморожены на безопасной сделке. Можно ехать на погрузку.`,
      { order },
    );
    await this.ctx.em.flush();
    return this.getDetails(user, order.id);
  }

  /** UC-18 + UC-14: приёмка груза после фото выгрузки; средства переводятся исполнителю. */
  async complete(user: User, orderId: string) {
    const order = await this.getOwned(user, orderId);
    if (order.status !== OrderStatus.Unloading) {
      throw new ConflictError('Подтвердить приёмку можно, когда водитель прибыл на выгрузку');
    }
    if (!(await this.photos.existsForStage(order.id, PhotoStage.Unloading))) {
      throw new ConflictError('Нельзя подтвердить приёмку без фотофиксации выгрузки');
    }
    order.status = OrderStatus.Completed;
    order.isEscrowLocked = false;
    new NotificationService(this.ctx).notify(
      order.driver!,
      NotificationType.OrderCompleted,
      'Приёмка подтверждена',
      `Заказчик принял груз ${orderTitle(order)}, ${rub(order.price)} переведены вам. Оцените заказчика.`,
      { order },
    );
    await this.ctx.em.flush();
    return this.getDetails(user, order.id);
  }

  /** 404 — заявки нет; 403 — заявка чужая. */
  async getOwned(user: User, orderId: string): Promise<Order> {
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundError('Заявка не найдена');
    if (order.client.id !== user.id) throw new ForbiddenError('Это заявка другого заказчика');
    return order;
  }
}

function unknownCargoType() {
  return new ValidationError('Неизвестный тип груза', [{ field: 'cargoTypeCode', message: 'Нет такого типа груза' }]);
}
