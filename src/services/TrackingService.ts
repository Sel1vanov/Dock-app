import { AppError } from '../core/errors';
import { driverNextStep } from '../models/domain';
import type { OrderDetailsDTO, PhotoStage } from '../models/dto';
import { OrderRepository } from '../repositories/OrderRepository';
import { PhotoRepository } from '../repositories/PhotoRepository';
import { StorageRepository } from '../repositories/StorageRepository';

/** Исполнение рейса: смена статусов и фотофиксация (UC-15, UC-17). */
export const TrackingService = {
  /** Перевод рейса на следующий этап по статусной модели. */
  async advanceStatus(order: OrderDetailsDTO): Promise<void> {
    const step = driverNextStep(order, order.photos);
    if (!step || step.kind !== 'status') {
      throw new AppError(step?.hint ?? 'Нет доступных действий по рейсу');
    }
    await OrderRepository.changeOrderStatus(order.id, step.to);
  },

  /** Файл → Storage (order-photos/{orderId}/{stage}/...), затем запись в order_photos. */
  async uploadPhotoReport(orderId: string, stage: PhotoStage, base64: string): Promise<void> {
    const path = `${orderId}/${stage}/${Date.now()}.jpg`;
    await StorageRepository.uploadBase64('order-photos', path, base64, 'image/jpeg');
    await PhotoRepository.addPhoto(orderId, path, stage);
  },
};
