// выборка и сохранение заявок (таблица orders)
//
// как тут сделано без N+1:
//  - списки: заказчик и тип груза идут JOIN-ом в том же запросе (strategy: 'joined', как joinedload),
//    кол-во откликов - одним запросом с GROUP BY по id всей страницы
//  - карточка: to-one связи JOIN-ом, коллекции (отклики, фото, отзывы) отдельными запросами
//    WHERE order_id IN (...) (strategy: 'select-in', как selectinload)
// т.е. число sql-запросов не зависит от того, сколько заявок на странице и откликов в заявке
import { type EntityManager, type ObjectQuery, LockMode, type QueryOrderMap, raw } from '@mikro-orm/postgresql';

import {
  IN_PROGRESS_ORDER_STATUSES,
  FINISHED_ORDER_STATUSES,
  OPEN_ORDER_STATUSES,
  Order,
  type OrderStatus,
  type OrderStatusGroup,
  type Vehicle,
} from '../models/index.js';
import { likePattern } from './query.js';

export type OrderSortKey = '-createdAt' | 'createdAt' | '-price' | 'price';

export interface OrderFilter {
  status?: OrderStatusGroup | OrderStatus;
  q?: string;
  cargoType?: string;
  sort: OrderSortKey;
  limit: number;
  offset: number;
}

// выражение должно совпадать с выражением GIN-индекса idx_orders_search_trgm, иначе индекс не сработает
const searchExpression = raw(
  (alias) =>
    `(coalesce(${alias}.description, '') || ' ' || ${alias}.origin_address || ' ' || ${alias}.destination_address)`,
);

function orderBy(sort: OrderSortKey): QueryOrderMap<Order>[] {
  const direction = sort.startsWith('-') ? 'desc' : 'asc';
  const field = sort.replace('-', '') as 'createdAt' | 'price';
  // id вторым ключом сортировки, чтобы порядок был стабильный при одинаковых значениях (важно для OFFSET)
  return [{ [field]: direction }, { id: 'asc' }];
}

function commonFilters(filter: Pick<OrderFilter, 'q' | 'cargoType'>): ObjectQuery<Order> {
  return {
    ...(filter.q ? { [searchExpression]: { $ilike: likePattern(filter.q) } } : {}),
    ...(filter.cargoType ? { cargoType: filter.cargoType } : {}),
  };
}

function statusFilter(status: OrderFilter['status']): ObjectQuery<Order> {
  if (!status) return {};
  switch (status) {
    case 'active':
      return { status: { $nin: [...FINISHED_ORDER_STATUSES] } };
    case 'open':
      return { status: { $in: [...OPEN_ORDER_STATUSES] } };
    case 'inProgress':
      return { status: { $in: [...IN_PROGRESS_ORDER_STATUSES] } };
    case 'archive':
      return { status: { $in: [...FINISHED_ORDER_STATUSES] } };
    default:
      return { status };
  }
}

export class OrderRepository {
  constructor(private readonly em: EntityManager) {}

  create(
    data: Pick<
      Order,
      | 'client'
      | 'cargoType'
      | 'description'
      | 'cargoWeightKg'
      | 'cargoLengthM'
      | 'cargoWidthM'
      | 'cargoHeightM'
      | 'originAddress'
      | 'destinationAddress'
      | 'price'
    >,
  ): Order {
    return this.em.create(Order, data);
  }

  remove(order: Order): void {
    this.em.remove(order);
  }

  findById(id: string): Promise<Order | null> {
    return this.em.findOne(Order, { id }, { populate: ['client', 'cargoType'], strategy: 'joined' });
  }

  // строка заказа с FOR UPDATE, вызывать внутри транзакции (выбор исполнителя)
  findByIdForUpdate(id: string): Promise<Order | null> {
    return this.em.findOne(Order, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE });
  }

  // карточка заказа со всеми связями
  findDetails(id: string): Promise<Order | null> {
    return this.em.findOne(
      Order,
      { id },
      {
        populate: ['client', 'driver', 'cargoType', 'bids', 'bids.driver', 'photos', 'reviews', 'disputes'],
        strategy: 'select-in',
        populateHints: {
          client: { strategy: 'joined' },
          driver: { strategy: 'joined' },
          cargoType: { strategy: 'joined' },
          'bids.driver': { strategy: 'joined' },
        },
        populateOrderBy: { bids: { createdAt: 'asc' }, photos: { uploadedAt: 'asc' }, disputes: { createdAt: 'desc' } },
      },
    );
  }

  // мои заявки заказчика: фильтр, поиск, сортировка, LIMIT/OFFSET
  listByClient(clientId: string, filter: OrderFilter): Promise<[Order[], number]> {
    return this.em.findAndCount(
      Order,
      { client: clientId, ...statusFilter(filter.status), ...commonFilters(filter) },
      {
        populate: ['client', 'cargoType'],
        strategy: 'joined',
        orderBy: orderBy(filter.sort),
        limit: filter.limit,
        offset: filter.offset,
      },
    );
  }

  // мои рейсы водителя
  listByDriver(driverId: string, filter: OrderFilter): Promise<[Order[], number]> {
    return this.em.findAndCount(
      Order,
      { driver: driverId, ...statusFilter(filter.status), ...commonFilters(filter) },
      {
        populate: ['client', 'cargoType'],
        strategy: 'joined',
        orderBy: orderBy(filter.sort),
        limit: filter.limit,
        offset: filter.offset,
      },
    );
  }

  // UC-08 + UC-09: открытые заявки, которые влезают в ТС по весу и габаритам и тип груза
  // которых это ТС возит (N:M vehicle_cargo_types). фильтруется в sql, а не на клиенте
  feed(vehicle: Vehicle, filter: Omit<OrderFilter, 'status'>): Promise<[Order[], number]> {
    return this.em.findAndCount(
      Order,
      {
        status: { $in: [...OPEN_ORDER_STATUSES] },
        cargoWeightKg: { $lte: vehicle.maxWeightKg },
        cargoLengthM: { $lte: vehicle.lengthM },
        cargoWidthM: { $lte: vehicle.widthM },
        cargoHeightM: { $lte: vehicle.heightM },
        cargoType: { $in: vehicle.cargoTypes.getIdentifiers('code') as string[] },
        ...commonFilters(filter),
      },
      {
        populate: ['client', 'cargoType'],
        strategy: 'joined',
        orderBy: orderBy(filter.sort),
        limit: filter.limit,
        offset: filter.offset,
      },
    );
  }

  // сколько всего открытых заявок под тем же поиском - чтобы показать, сколько скрыл фильтр по ТС
  countOpen(filter: Pick<OrderFilter, 'q' | 'cargoType'>): Promise<number> {
    return this.em.count(Order, { status: { $in: [...OPEN_ORDER_STATUSES] }, ...commonFilters(filter) });
  }
}
