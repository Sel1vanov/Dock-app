/**
 * Выборка и сохранение заказов (таблица public.orders).
 *
 * Про N+1 (лекция 6). Ленивая загрузка на мобильном клиенте — это сетевой запрос на каждую
 * связанную сущность: 1 запрос за список заказов + N запросов за откликами каждого заказа.
 * Поэтому связанные данные загружаются жадно, одним HTTP-запросом через встроенные связи
 * PostgREST (`select=*,client:users(...),bids(...)`) — это аналог joinedload: PostgreSQL сам
 * делает JOIN по внешним ключам и возвращает вложенный JSON.
 * Для данных, которые нельзя встроить (рейтинги, подписанные ссылки на фото), сервисы делают
 * ОДИН дополнительный запрос с условием IN по собранным id — аналог selectinload.
 */
import { toAppError } from '../core/errors';
import { supabase } from '../core/supabase';
import type { Enums, Tables, TablesInsert, TablesUpdate } from '../models/database.types';

export type OrderRow = Tables<'orders'>;

type PersonEmbed = { id: string; full_name: string | null; phone: string | null; is_verified: boolean } | null;

/** Заказ в списке: вместе с ним приходят только id откликов — чтобы показать их количество. */
export type OrderListRow = OrderRow & {
  client: { full_name: string | null } | null;
  bids: { id: string }[];
};

/** Заказ в ленте водителя: RLS отдаёт водителю только его собственные отклики. */
export type FeedOrderRow = OrderRow & {
  client: { full_name: string | null } | null;
  my_bids: { id: string; status: Enums<'bid_status'>; offered_price: number }[];
};

export type OrderDetailsRow = OrderRow & {
  client: PersonEmbed;
  driver: PersonEmbed;
  bids: (Tables<'bids'> & {
    driver: (NonNullable<PersonEmbed> & { vehicles: Tables<'vehicles'>[] }) | null;
  })[];
  order_photos: Tables<'order_photos'>[];
  reviews: { author_id: string }[];
};

export interface VehicleSpecs {
  maxWeightKg: number;
  lengthM: number;
  widthM: number;
  heightM: number;
}

const OPEN_STATUSES: Enums<'order_status'>[] = ['Created', 'Bidding'];

const LIST_SELECT = '*, client:users!orders_client_id_fkey(full_name), bids(id)';

const FEED_SELECT = '*, client:users!orders_client_id_fkey(full_name), my_bids:bids(id, status, offered_price)';

const PERSON = 'id, full_name, phone, is_verified';

const DETAILS_SELECT = `*,
  client:users!orders_client_id_fkey(${PERSON}),
  driver:users!orders_driver_id_fkey(${PERSON}),
  bids(*, driver:users!bids_driver_id_fkey(${PERSON}, vehicles(*))),
  order_photos(*),
  reviews(author_id)`;

export const OrderRepository = {
  async saveOrder(order: TablesInsert<'orders'>): Promise<OrderRow> {
    const { data, error } = await supabase.from('orders').insert(order).select('*').single();
    if (error) throw toAppError(error, 'Не удалось создать заявку');
    return data;
  },

  /** Заявки заказчика вместе с числом откликов — один запрос. */
  async getClientOrders(clientId: string): Promise<OrderListRow[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(LIST_SELECT)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) throw toAppError(error, 'Не удалось загрузить заявки');
    return data as unknown as OrderListRow[];
  },

  /**
   * UC-09: фильтрация выполняется в БД — заявки, превышающие грузоподъёмность или габариты ТС,
   * отсеиваются условиями `lte` и не передаются по сети.
   */
  async getCompatibleOrders(specs: VehicleSpecs): Promise<FeedOrderRow[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(FEED_SELECT)
      .in('status', OPEN_STATUSES)
      .lte('cargo_weight', specs.maxWeightKg)
      .lte('cargo_length', specs.lengthM)
      .lte('cargo_width', specs.widthM)
      .lte('cargo_height', specs.heightM)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw toAppError(error, 'Не удалось загрузить ленту заказов');
    return data as unknown as FeedOrderRow[];
  },

  /** Сколько всего открытых заявок (без загрузки строк) — чтобы показать, сколько отсеял фильтр. */
  async countOpenOrders(): Promise<number> {
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', OPEN_STATUSES);
    if (error) throw toAppError(error);
    return count ?? 0;
  },

  /** Рейсы, назначенные водителю. */
  async getDriverTrips(driverId: string): Promise<OrderListRow[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(LIST_SELECT)
      .eq('driver_id', driverId)
      .order('updated_at', { ascending: false });
    if (error) throw toAppError(error, 'Не удалось загрузить рейсы');
    return data as unknown as OrderListRow[];
  },

  /** Карточка заказа: заказчик, водитель, отклики с водителями и их ТС, фото, отзывы — один запрос. */
  async getOrderDetails(orderId: string): Promise<OrderDetailsRow | null> {
    const { data, error } = await supabase
      .from('orders')
      .select(DETAILS_SELECT)
      .eq('id', orderId)
      .order('created_at', { referencedTable: 'bids', ascending: true })
      .order('uploaded_at', { referencedTable: 'order_photos', ascending: true })
      .maybeSingle();
    if (error) throw toAppError(error, 'Не удалось загрузить заказ');
    return data as unknown as OrderDetailsRow | null;
  },

  async changeOrderStatus(
    orderId: string,
    status: Enums<'order_status'>,
    extra: Pick<TablesUpdate<'orders'>, 'cancel_reason'> = {},
  ): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({ status, ...extra })
      .eq('id', orderId);
    if (error) throw toAppError(error, 'Не удалось изменить статус заказа');
  },

  /** UC-13: заморозка средств (безопасная сделка). Пока без реального платёжного шлюза. */
  async lockEscrow(orderId: string): Promise<void> {
    const { error } = await supabase.from('orders').update({ is_escrow_locked: true }).eq('id', orderId);
    if (error) throw toAppError(error, 'Не удалось провести оплату');
  },
};
