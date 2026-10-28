import { randomUUID } from 'node:crypto';

import { ConflictError, ForbiddenError, NotFoundError } from '../core/errors.js';
import { type Order, OrderStatus, PhotoStage, type User } from '../models/index.js';
import { OrderRepository, PhotoRepository } from '../repositories/index.js';
import type { PhotoUploadInput } from '../schemas/orders.js';
import type { ServiceContext } from './context.js';
import { decodeImage } from './FileStorage.js';
import { OrderService } from './OrderService.js';

/** Допустимые переходы рейса, которые выполняет водитель (UC-15). */
const DRIVER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus>> = {
  [OrderStatus.Assigned]: OrderStatus.Loading,
  [OrderStatus.Loading]: OrderStatus.InTransit,
  [OrderStatus.InTransit]: OrderStatus.Unloading,
};

/** Исполнение рейса: смена статусов водителем и фотофиксация груза (UC-15, UC-17). */
export class TrackingService {
  private readonly orders: OrderRepository;
  private readonly photos: PhotoRepository;

  constructor(private readonly ctx: ServiceContext) {
    this.orders = new OrderRepository(ctx.em);
    this.photos = new PhotoRepository(ctx.em);
  }

  async changeStatus(user: User, orderId: string, status: OrderStatus) {
    const order = await this.getAssigned(user, orderId);
    if (DRIVER_TRANSITIONS[order.status as OrderStatus] !== status) {
      throw new ConflictError(`Недопустимая смена статуса рейса: ${order.status} → ${status}`);
    }
    if (status === OrderStatus.Loading && !order.isEscrowLocked) {
      throw new ConflictError('Рейс можно начать только после оплаты заказа заказчиком');
    }
    if (status === OrderStatus.InTransit && !(await this.photos.existsForStage(order.id, PhotoStage.Loading))) {
      throw new ConflictError('Сначала загрузите фотофиксацию погрузки');
    }
    order.status = status;
    await this.ctx.em.flush();
    return new OrderService(this.ctx).getDetails(user, order.id);
  }

  /** Фото погрузки — на статусе «Прибыл на погрузку», выгрузки — на «Прибыл на выгрузку». */
  async uploadPhoto(user: User, orderId: string, input: PhotoUploadInput) {
    const order = await this.getAssigned(user, orderId);
    const requiredStatus = input.stage === PhotoStage.Loading ? OrderStatus.Loading : OrderStatus.Unloading;
    if (order.status !== requiredStatus) {
      throw new ConflictError(
        input.stage === PhotoStage.Loading
          ? 'Фото погрузки загружается на статусе «Прибыл на погрузку»'
          : 'Фото выгрузки загружается на статусе «Прибыл на выгрузку»',
      );
    }
    const image = decodeImage(input.imageBase64);
    const fileKey = `orders/${order.id}/${input.stage.toLowerCase()}/${randomUUID()}.${image.ext}`;
    await this.ctx.storage.save(fileKey, image.data);
    this.photos.create({ order, stage: input.stage, fileKey });
    try {
      await this.ctx.em.flush();
    } catch (e) {
      await this.ctx.storage.remove(fileKey);
      throw e;
    }
    return new OrderService(this.ctx).getDetails(user, order.id);
  }

  private async getAssigned(user: User, orderId: string): Promise<Order> {
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundError('Заявка не найдена');
    if (!order.driver || order.driver.id !== user.id) throw new ForbiddenError('Рейс назначен другому водителю');
    return order;
  }
}
