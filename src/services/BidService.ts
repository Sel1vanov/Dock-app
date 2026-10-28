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
   * Предварительные проверки — для понятных сообщений без запроса; окончательно их выполняет сервер.
   */
  async placeBid(driver: UserDTO, vehicles: VehicleDTO[], order: OrderDetailsDTO, input: BidInput): Promise<void> {
    if (driver.verification !== 'verified') {
      throw new AppError('Отклик доступен после проверки документов администратором');
    }
    if (!isOpenForBids(order)) throw new AppError('Заявка уже не принимает отклики');
    if (!vehicles.some((v) => checkCompatibility(v, order.cargo).ok)) {
      throw new AppError('Ни одно ваше ТС не подходит под габариты, массу или тип груза');
    }
    await BidRepository.place(order.id, input.price, input.comment);
  },

  async updateBid(bidId: string, input: BidInput): Promise<void> {
    await BidRepository.update(bidId, input.price, input.comment);
  },

  withdrawBid: (bidId: string) => BidRepository.withdraw(bidId),

  /** UC-06 */
  acceptBid: async (bidId: string) => {
    await BidRepository.accept(bidId);
  },

  rejectBid: async (bidId: string) => {
    await BidRepository.reject(bidId);
  },

  async getMyBids(): Promise<DriverBidDTO[]> {
    return (await BidRepository.listMine()).map(toDriverBidDTO);
  },
};
