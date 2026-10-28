import { apiRequest } from '../core/api';
import type { ApiDriverBid, ApiOrderDetails } from '../models/api';

/** Отклики и торг: /orders/{id}/bids, /bids/… */
export const BidRepository = {
  /** UC-10 / UC-11: отклик по цене заказчика или со встречной ценой. */
  place(orderId: string, price: number, comment: string): Promise<ApiOrderDetails> {
    return apiRequest('POST', `/orders/${orderId}/bids`, { body: comment ? { price, comment } : { price } });
  },

  update(bidId: string, price: number, comment: string): Promise<ApiOrderDetails> {
    return apiRequest('PATCH', `/bids/${bidId}`, { body: { price, comment: comment || null } });
  },

  withdraw(bidId: string): Promise<void> {
    return apiRequest('DELETE', `/bids/${bidId}`);
  },

  /** UC-06: выбор исполнителя — на сервере одна транзакция. */
  accept(bidId: string): Promise<ApiOrderDetails> {
    return apiRequest('POST', `/bids/${bidId}/accept`);
  },

  reject(bidId: string): Promise<ApiOrderDetails> {
    return apiRequest('POST', `/bids/${bidId}/reject`);
  },

  listMine(): Promise<ApiDriverBid[]> {
    return apiRequest('GET', '/bids/my');
  },
};
