import { AppError } from '../core/errors';
import { driverNextStep } from '../models/domain';
import type { OrderDetailsDTO, PhotoStage } from '../models/dto';
import { OrderRepository } from '../repositories/OrderRepository';

// выполнение рейса: смена статусов и фото груза (UC-15, UC-17)
export const TrackingService = {
  // переводит рейс на следующий этап по статусной модели
  async advanceStatus(order: OrderDetailsDTO): Promise<void> {
    const step = driverNextStep(order, order.photos);
    if (!step || step.kind !== 'status') {
      throw new AppError(step?.hint ?? 'Нет доступных действий по рейсу');
    }
    await OrderRepository.changeStatus(order.id, step.to as 'Loading' | 'InTransit' | 'Unloading');
  },

  // фото уходит на сервер, там сохраняется файл и запись в order_photos
  async uploadPhotoReport(orderId: string, stage: PhotoStage, base64: string): Promise<void> {
    await OrderRepository.uploadPhoto(orderId, stage, base64);
  },
};
