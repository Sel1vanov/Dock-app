import { toAppError } from '../core/errors';
import { supabase } from '../core/supabase';
import type { Tables, TablesInsert } from '../models/database.types';
import type { OrderListRow } from './OrderRepository';

export type BidRow = Tables<'bids'>;

export type DriverBidRow = BidRow & {
  order: Omit<OrderListRow, 'bids'> | null;
};

/** Отклики и торг (таблица public.bids). */
export const BidRepository = {
  /** UC-10 / UC-11: отклик по цене заказчика или со встречной ценой. */
  async placeBid(bid: TablesInsert<'bids'>): Promise<BidRow> {
    const { data, error } = await supabase.from('bids').insert(bid).select('*').single();
    if (error) throw toAppError(error, 'Не удалось отправить отклик');
    return data;
  },

  async updateBid(bidId: string, offeredPrice: number, comment: string | null): Promise<void> {
    const { error } = await supabase.from('bids').update({ offered_price: offeredPrice, comment }).eq('id', bidId);
    if (error) throw toAppError(error, 'Не удалось изменить отклик');
  },

  async deleteBid(bidId: string): Promise<void> {
    const { error } = await supabase.from('bids').delete().eq('id', bidId);
    if (error) throw toAppError(error, 'Не удалось отозвать отклик');
  },

  /**
   * UC-06: выбор исполнителя — RPC-функция accept_bid выполняет в одной транзакции
   * назначение водителя, фиксацию цены и отклонение остальных откликов.
   */
  async acceptBid(bidId: string): Promise<void> {
    const { error } = await supabase.rpc('accept_bid', { p_bid_id: bidId });
    if (error) throw toAppError(error, 'Не удалось выбрать исполнителя');
  },

  async rejectBid(bidId: string): Promise<void> {
    const { error } = await supabase.from('bids').update({ status: 'Rejected' }).eq('id', bidId);
    if (error) throw toAppError(error, 'Не удалось отклонить отклик');
  },

  /** Отклики водителя вместе с заказами — один запрос (связь bids → orders N:1). */
  async getDriverBids(driverId: string): Promise<DriverBidRow[]> {
    const { data, error } = await supabase
      .from('bids')
      .select('*, order:orders(*, client:users!orders_client_id_fkey(full_name))')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });
    if (error) throw toAppError(error, 'Не удалось загрузить отклики');
    return data as unknown as DriverBidRow[];
  },
};
