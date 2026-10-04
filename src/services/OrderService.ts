import { OrderRepository } from '../repositories/OrderRepository';
import { OrderDTO } from '../models/Order';

export class OrderService {
  private orderRepo = new OrderRepository();

  async getAvailableOrders(): Promise<OrderDTO[]> {
    const orders = await this.orderRepo.getAllOrders();
    return orders;
  }

  // МЕТОД С БИЗНЕС-ВАЛИДАЦИЕЙ
  async createOrder(orderData: Partial<OrderDTO>): Promise<OrderDTO> {
    // 1. Проверка адресов
    if (!orderData.origin_address?.trim() || !orderData.destination_address?.trim()) {
      throw new Error('Адреса отправления и назначения обязательны для заполнения');
    }

    // 2. Проверка одинаковых адресов
    if (orderData.origin_address.trim() === orderData.destination_address.trim()) {
      throw new Error('Адрес отправления и назначения не могут совпадать');
    }

    // 3. Проверка веса груза
    if (!orderData.cargo_weight || orderData.cargo_weight <= 0) {
      throw new Error('Вес груза должен быть больше 0');
    }

    // 4. Проверка цены
    if (!orderData.price || orderData.price < 100) {
      throw new Error('Минимальная стоимость заказа — 100 ₽');
    }

    // Если все проверки пройдены — отправляем в базу
    return await this.orderRepo.createOrder({
      ...orderData,
      status: 'Created' // Устанавливаем начальный статус
    });
  }
}