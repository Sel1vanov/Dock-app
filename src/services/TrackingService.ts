import { AppError } from '../core/errors';
import { driverNextStep } from '../models/domain';
import type { OrderDetailsDTO, PhotoStage } from '../models/dto';
import { OrderRepository } from '../repositories/OrderRepository';

/** Исполнение рейса: смена статусов и фотофиксация (UC-15, UC-17). */
export const TrackingService = {
  /** Перевод рейса на следующий этап по статусной модели. */
  async advanceStatus(order: OrderDetailsDTO): Promise<void> {
    const step = driverNextStep(order, order.photos);
    if (!step || step.kind !== 'status') {
      throw new AppError(step?.hint ?? 'Нет доступных действий по рейсу');
    }
    await OrderRepository.changeStatus(order.id, step.to as 'Loading' | 'InTransit' | 'Unloading');
  },

  /** Фото уходит на сервер, он сохраняет файл и запись order_photos. */
  async uploadPhotoReport(orderId: string, stage: PhotoStage, base64: string): Promise<void> {
    await OrderRepository.uploadPhoto(orderId, stage, base64);
  },
};
