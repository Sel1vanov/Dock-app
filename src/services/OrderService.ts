import { AppError } from '../core/errors';
import { canCancel, canConfirmDelivery, canDelete, canEdit, canPay } from '../models/domain';
import type {
  FeedPageDTO,
  OrderDetailsDTO,
  OrderListParams,
  OrderStatus,
  OrderStatusGroup,
  Page,
  OrderListItemDTO,
  VehicleDTO,
} from '../models/dto';
import { toOrderDetailsDTO, toOrderListItemDTO, tToKg } from '../models/mappers';
import type { CreateOrderInput } from '../models/schemas';
import { OrderRepository, type OrderPayload } from '../repositories/OrderRepository';

export const PAGE_SIZE = 10;

const toPayload = (input: CreateOrderInput): OrderPayload => ({
  cargoTypeCode: input.type,
  description: input.description || null,
  weightKg: tToKg(input.weightT),
  lengthM: input.lengthM,
  widthM: input.widthM,
  heightM: input.heightM,
  originAddress: input.origin,
  destinationAddress: input.destination,
  price: input.price,
});

/** Жизненный цикл заявки: создание, списки, карточка, изменение, удаление, отмена, оплата, приёмка. */
export const OrderService = {
  /** UC-03 + UC-04: публикация заявки с габаритами и весом. */
  async createOrder(input: CreateOrderInput): Promise<OrderDetailsDTO> {
    return toOrderDetailsDTO(await OrderRepository.create(toPayload(input)));
  },

  async updateOrder(order: OrderDetailsDTO, input: CreateOrderInput): Promise<OrderDetailsDTO> {
    if (!canEdit(order)) throw new AppError('Заявку с откликами изменить нельзя');
    return toOrderDetailsDTO(await OrderRepository.update(order.id, toPayload(input)));
  },

  async deleteOrder(order: OrderDetailsDTO): Promise<void> {
    if (!canDelete(order)) throw new AppError('Удалить можно только заявку без откликов');
    await OrderRepository.remove(order.id);
  },

  /** «Мои заявки» заказчика / «Мои рейсы» водителя — страница с сервера. */
  async getMyOrders(
    status: OrderStatusGroup | OrderStatus | undefined,
    params: OrderListParams,
    offset: number,
  ): Promise<Page<OrderListItemDTO>> {
    const page = await OrderRepository.list({ ...params, status, limit: PAGE_SIZE, offset });
    return { items: page.items.map(toOrderListItemDTO), total: page.total };
  },

  /** UC-08 + UC-09: лента заявок, подходящих под выбранное ТС. */
  async getFeed(vehicle: VehicleDTO, params: OrderListParams, offset: number): Promise<FeedPageDTO> {
    const page = await OrderRepository.feed(vehicle.id, { ...params, limit: PAGE_SIZE, offset });
    return { items: page.items.map(toOrderListItemDTO), total: page.total, hiddenCount: page.hiddenCount };
  },

  async getOrderDetails(orderId: string): Promise<OrderDetailsDTO> {
    return toOrderDetailsDTO(await OrderRepository.get(orderId));
  },

  /** UC-07 */
  async cancelOrder(order: OrderDetailsDTO, reason: string): Promise<void> {
    if (!canCancel(order)) throw new AppError('Заказ уже нельзя отменить');
    await OrderRepository.cancel(order.id, reason.trim());
  },

  /** UC-12 + UC-13: оплата с заморозкой средств (демо без платёжного шлюза). */
  async payOrder(order: OrderDetailsDTO): Promise<void> {
    if (!canPay(order)) throw new AppError('Оплата сейчас недоступна');
    await OrderRepository.pay(order.id);
  },

  /** UC-18 (+ UC-14: средства переводятся исполнителю). */
  async confirmDelivery(order: OrderDetailsDTO): Promise<void> {
    if (!canConfirmDelivery(order, order.photos)) {
      throw new AppError('Подтвердить приёмку можно после фотофиксации выгрузки');
    }
    await OrderRepository.complete(order.id);
  },
};
