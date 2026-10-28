/**
 * Заявки (/orders). Поиск, фильтрация, сортировка и постраничная загрузка выполняются
 * на сервере: клиент передаёт параметры q, cargoType, status, sort, limit, offset.
 */
import { apiRequest } from '../core/api';
import type { ApiFeedPage, ApiOrderDetails, ApiOrderListItem, ApiPage, ApiPhotoStage } from '../models/api';

export interface OrderPayload {
  cargoTypeCode: string;
  description: string | null;
  weightKg: number;
  lengthM: number;
  widthM: number;
  heightM: number;
  originAddress: string;
  destinationAddress: string;
  price: number;
}

export interface ListQuery {
  q?: string;
  cargoType?: string | null;
  status?: string;
  sort?: string;
  limit: number;
  offset: number;
}

export const OrderRepository = {
  /** Заказчик — свои заявки, водитель — свои рейсы. */
  list(query: ListQuery): Promise<ApiPage<ApiOrderListItem>> {
    return apiRequest('GET', '/orders', { query: { ...query } });
  },

  /** UC-08 + UC-09: лента под ТС — фильтр по габаритам и типам грузов выполняется в БД. */
  feed(vehicleId: string, query: ListQuery): Promise<ApiFeedPage> {
    return apiRequest('GET', '/orders/feed', { query: { vehicleId, ...query } });
  },

  get(id: string): Promise<ApiOrderDetails> {
    return apiRequest('GET', `/orders/${id}`);
  },

  create(payload: OrderPayload): Promise<ApiOrderDetails> {
    return apiRequest('POST', '/orders', { body: payload });
  },

  update(id: string, payload: Partial<OrderPayload>): Promise<ApiOrderDetails> {
    return apiRequest('PATCH', `/orders/${id}`, { body: payload });
  },

  remove(id: string): Promise<void> {
    return apiRequest('DELETE', `/orders/${id}`);
  },

  cancel(id: string, reason: string): Promise<ApiOrderDetails> {
    return apiRequest('POST', `/orders/${id}/cancel`, { body: reason ? { reason } : {} });
  },

  /** UC-12/13: заморозка средств (демо безопасной сделки). */
  pay(id: string): Promise<ApiOrderDetails> {
    return apiRequest('POST', `/orders/${id}/payment`);
  },

  changeStatus(id: string, status: 'Loading' | 'InTransit' | 'Unloading'): Promise<ApiOrderDetails> {
    return apiRequest('POST', `/orders/${id}/status`, { body: { status } });
  },

  uploadPhoto(id: string, stage: ApiPhotoStage, imageBase64: string): Promise<ApiOrderDetails> {
    return apiRequest('POST', `/orders/${id}/photos`, { body: { stage, imageBase64 } });
  },

  complete(id: string): Promise<ApiOrderDetails> {
    return apiRequest('POST', `/orders/${id}/complete`);
  },

  review(id: string, rating: number, comment: string): Promise<unknown> {
    return apiRequest('POST', `/orders/${id}/reviews`, { body: comment ? { rating, comment } : { rating } });
  },
};
