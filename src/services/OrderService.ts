import { AppError } from '../core/errors';
import { canCancel, canConfirmDelivery, canPay } from '../models/domain';
import type { OrderDetailsDTO, OrderListItemDTO, VehicleDTO } from '../models/dto';
import { toOrderDetailsDTO, toOrderListItemDTO, tToKg } from '../models/mappers';
import type { CreateOrderInput } from '../models/schemas';
import { OrderRepository } from '../repositories/OrderRepository';
import { ReviewRepository } from '../repositories/ReviewRepository';
import { StorageRepository } from '../repositories/StorageRepository';

export interface FeedResult {
  orders: OrderListItemDTO[];
  /** Сколько открытых заявок скрыто фильтром по габаритам ТС. */
  hiddenCount: number;
}

/** Жизненный цикл заявки: создание, списки, карточка, отмена, оплата, приёмка. */
export const OrderService = {
  /** UC-03 + UC-04: публикация заявки с габаритами и весом. */
  async createOrder(clientId: string, input: CreateOrderInput): Promise<OrderListItemDTO> {
    const row = await OrderRepository.saveOrder({
      client_id: clientId,
      cargo_type: input.type,
      description: input.description || null,
      cargo_weight: tToKg(input.weightT),
      cargo_length: input.lengthM,
      cargo_width: input.widthM,
      cargo_height: input.heightM,
      origin_address: input.origin,
      destination_address: input.destination,
      price: input.price,
    });
    return toOrderListItemDTO(row);
  },

  async getClientOrders(clientId: string): Promise<OrderListItemDTO[]> {
    const rows = await OrderRepository.getClientOrders(clientId);
    return rows.map((row) => toOrderListItemDTO(row, { bidsCount: row.bids.length }));
  },

  /** UC-08 + UC-09: лента заявок, подходящих под выбранное ТС. */
  async getFeed(vehicle: VehicleDTO): Promise<FeedResult> {
    const [rows, total] = await Promise.all([
      OrderRepository.getCompatibleOrders({
        maxWeightKg: tToKg(vehicle.weightT),
        lengthM: vehicle.lengthM,
        widthM: vehicle.widthM,
        heightM: vehicle.heightM,
      }),
      OrderRepository.countOpenOrders(),
    ]);
    const orders = rows.map((row) => {
      const bid = row.my_bids[0];
      return toOrderListItemDTO(row, {
        myBid: bid ? { id: bid.id, price: Number(bid.offered_price), status: bid.status } : null,
      });
    });
    return { orders, hiddenCount: Math.max(0, total - orders.length) };
  },

  async getDriverTrips(driverId: string): Promise<OrderListItemDTO[]> {
    const rows = await OrderRepository.getDriverTrips(driverId);
    return rows.map((row) => toOrderListItemDTO(row));
  },

  /**
   * Карточка заказа = 1 запрос со всеми связями + 1 запрос рейтингов (IN по id участников)
   * + 1 запрос подписанных ссылок на фото. Количество запросов не зависит от числа откликов.
   */
  async getOrderDetails(orderId: string, currentUserId: string): Promise<OrderDetailsDTO> {
    const row = await OrderRepository.getOrderDetails(orderId);
    if (!row) throw new AppError('Заказ не найден или недоступен');

    const userIds = [row.client_id, row.driver_id, ...row.bids.map((b) => b.driver_id)].filter((id): id is string =>
      Boolean(id),
    );
    const [ratings, signedUrls] = await Promise.all([
      ReviewRepository.getRatings(userIds),
      StorageRepository.createSignedUrls(
        'order-photos',
        row.order_photos.map((p) => p.photo_url),
      ).catch(() => new Map<string, string>()),
    ]);
    return toOrderDetailsDTO(row, ratings, signedUrls, currentUserId);
  },

  /** UC-07 */
  async cancelOrder(order: OrderDetailsDTO, reason: string): Promise<void> {
    if (!canCancel(order)) throw new AppError('Заказ уже нельзя отменить');
    await OrderRepository.changeOrderStatus(order.id, 'Cancelled', { cancel_reason: reason.trim() || null });
  },

  /** UC-12 + UC-13: оплата с заморозкой средств. Платёжный шлюз подключим на следующем этапе. */
  async payOrder(order: OrderDetailsDTO): Promise<void> {
    if (!canPay(order)) throw new AppError('Оплата сейчас недоступна');
    await OrderRepository.lockEscrow(order.id);
  },

  /** UC-18 (+ UC-14: средства переводятся исполнителю — триггер снимает блокировку escrow). */
  async confirmDelivery(order: OrderDetailsDTO): Promise<void> {
    if (!canConfirmDelivery(order, order.photos)) {
      throw new AppError('Подтвердить приёмку можно после фотофиксации выгрузки');
    }
    await OrderRepository.changeOrderStatus(order.id, 'Completed');
  },
};
