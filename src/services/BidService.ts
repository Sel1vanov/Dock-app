import { AppError } from '../core/errors';
import { checkCompatibility, isOpenForBids } from '../models/domain';
import type { DriverBidDTO, OrderDetailsDTO, UserDTO, VehicleDTO } from '../models/dto';
import { toDriverBidDTO } from '../models/mappers';
import type { BidInput } from '../models/schemas';
import { BidRepository } from '../repositories/BidRepository';

/** Торг: отклики водителей и выбор исполнителя заказчиком. */
export const BidService = {
  /**
   * UC-10 (по цене заказчика) и UC-11 (встречная цена).
   * Предварительные проверки — для понятных сообщений; окончательно их выполняет БД.
   */
  async placeBid(driver: UserDTO, vehicles: VehicleDTO[], order: OrderDetailsDTO, input: BidInput): Promise<void> {
    if (driver.verification !== 'verified') {
      throw new AppError('Отклик доступен после проверки документов администратором');
    }
    if (!isOpenForBids(order)) throw new AppError('Заявка уже не принимает отклики');
    if (!vehicles.some((v) => checkCompatibility(v, order.cargo).ok)) {
      throw new AppError('Ни одно ваше ТС не подходит под габариты и вес груза');
    }
    await BidRepository.placeBid({
      order_id: order.id,
      driver_id: driver.id,
      offered_price: input.price,
      comment: input.comment || null,
    });
  },

  async updateBid(bidId: string, input: BidInput): Promise<void> {
    await BidRepository.updateBid(bidId, input.price, input.comment || null);
  },

  withdrawBid: BidRepository.deleteBid,

  /** UC-06 */
  acceptBid: BidRepository.acceptBid,

  rejectBid: BidRepository.rejectBid,

  async getMyBids(driverId: string): Promise<DriverBidDTO[]> {
    const rows = await BidRepository.getDriverBids(driverId);
    return rows.map(toDriverBidDTO).filter((b): b is DriverBidDTO => b !== null);
  },
};
