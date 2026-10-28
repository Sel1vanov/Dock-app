import { z } from 'zod';

import { BidStatus, OrderStatus, PhotoStage } from '../models/enums.js';
import { ImageBase64, PaginationQuery, RatingResponse, SearchQuery, pageOf, positive } from './common.js';
import { VehicleResponse } from './vehicles.js';

// ------------------------------------------------------------------ запросы ---

const orderFields = {
  cargoTypeCode: z.string({ error: 'Выберите тип груза' }).trim().min(1).max(32),
  description: z.string().trim().max(500, 'Описание: не больше 500 символов').nullable().optional(),
  weightKg: positive(200_000, 'Масса'),
  lengthM: positive(40, 'Длина'),
  widthM: positive(10, 'Ширина'),
  heightM: positive(8, 'Высота'),
  originAddress: z.string({ error: 'Укажите адрес погрузки' }).trim().min(3, 'Укажите адрес погрузки').max(300),
  destinationAddress: z.string({ error: 'Укажите адрес выгрузки' }).trim().min(3, 'Укажите адрес выгрузки').max(300),
  price: positive(100_000_000, 'Цена'),
};

export const OrderCreateRequest = z.object(orderFields).strict().meta({ id: 'OrderCreateRequest' });

export const OrderUpdateRequest = z
  .object(orderFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Передайте хотя бы одно поле')
  .meta({ id: 'OrderUpdateRequest' });

export const OrderSort = z
  .enum(['-createdAt', 'createdAt', '-price', 'price'])
  .default('-createdAt')
  .describe('Сортировка: поле, «-» — по убыванию');

export const OrderListQuery = PaginationQuery.extend({
  status: z
    .union([z.enum(['active', 'archive']), z.enum(OrderStatus)])
    .optional()
    .describe('active — в работе, archive — завершённые и отменённые, либо конкретный статус'),
  q: SearchQuery.describe('Поиск по описанию груза и адресам'),
  cargoType: z.string().trim().max(32).optional().describe('Код типа груза'),
  sort: OrderSort,
});

export const FeedQuery = PaginationQuery.extend({
  vehicleId: z.uuid('Выберите ТС').describe('Лента подбирается под габариты и типы грузов этого ТС'),
  q: SearchQuery.describe('Поиск по описанию груза и адресам'),
  cargoType: z.string().trim().max(32).optional(),
  sort: OrderSort,
});

export const CancelOrderRequest = z
  .object({ reason: z.string().trim().max(300, 'Не больше 300 символов').optional() })
  .strict()
  .meta({ id: 'CancelOrderRequest' });

export const StatusChangeRequest = z
  .object({
    status: z.enum([OrderStatus.Loading, OrderStatus.InTransit, OrderStatus.Unloading], {
      error: 'Статус рейса: Loading, InTransit или Unloading',
    }),
  })
  .strict()
  .meta({ id: 'StatusChangeRequest' });

export const PhotoUploadRequest = z
  .object({
    stage: z.enum(PhotoStage, { error: 'Этап: Loading или Unloading' }),
    imageBase64: ImageBase64,
  })
  .strict()
  .meta({ id: 'PhotoUploadRequest' });

export const ReviewCreateRequest = z
  .object({
    rating: z.number({ error: 'Поставьте оценку' }).int().min(1, 'Оценка от 1 до 5').max(5, 'Оценка от 1 до 5'),
    comment: z.string().trim().max(500, 'Не больше 500 символов').optional(),
  })
  .strict()
  .meta({ id: 'ReviewCreateRequest' });

// ------------------------------------------------------------------- ответы ---

export const CargoResponse = z.object({
  typeCode: z.string(),
  typeName: z.string(),
  description: z.string().nullable(),
  weightKg: z.number(),
  lengthM: z.number(),
  widthM: z.number(),
  heightM: z.number(),
});

export const MyBidResponse = z
  .object({ id: z.uuid(), price: z.number(), status: z.enum(BidStatus) })
  .nullable()
  .describe('Отклик текущего водителя, если он есть');

export const OrderListItemResponse = z
  .object({
    id: z.uuid(),
    status: z.enum(OrderStatus),
    isEscrowLocked: z.boolean(),
    cargo: CargoResponse,
    originAddress: z.string(),
    destinationAddress: z.string(),
    price: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
    bidsCount: z.number().int(),
    clientName: z.string(),
    myBid: MyBidResponse,
  })
  .meta({ id: 'OrderListItemResponse' });

export const OrderPageResponse = pageOf(OrderListItemResponse).meta({ id: 'OrderPageResponse' });

export const FeedPageResponse = pageOf(OrderListItemResponse)
  .extend({ hiddenCount: z.number().int().describe('Открытых заявок, не подходящих под выбранное ТС') })
  .meta({ id: 'FeedPageResponse' });

export const PersonResponse = z
  .object({
    id: z.uuid(),
    fullName: z.string(),
    phone: z.string().nullable().describe('Виден только контрагенту по назначенному заказу'),
    isVerified: z.boolean(),
    rating: RatingResponse,
  })
  .meta({ id: 'PersonResponse' });

export const BidResponse = z
  .object({
    id: z.uuid(),
    price: z.number(),
    comment: z.string().nullable(),
    status: z.enum(BidStatus),
    createdAt: z.string(),
    driver: PersonResponse,
    vehicles: z.array(VehicleResponse),
  })
  .meta({ id: 'BidResponse' });

export const PhotoResponse = z
  .object({
    id: z.uuid(),
    stage: z.enum(PhotoStage),
    url: z.string().describe('Временная подписанная ссылка'),
    uploadedAt: z.string(),
  })
  .meta({ id: 'PhotoResponse' });

export const OrderDetailsResponse = OrderListItemResponse.extend({
  clientId: z.uuid(),
  driverId: z.uuid().nullable(),
  client: PersonResponse,
  driver: PersonResponse.nullable(),
  bids: z.array(BidResponse).describe('Все отклики видит только автор заявки'),
  photos: z.array(PhotoResponse),
  cancelReason: z.string().nullable(),
  reviewAuthorIds: z.array(z.uuid()),
}).meta({ id: 'OrderDetailsResponse' });

export type OrderCreateInput = z.output<typeof OrderCreateRequest>;
export type OrderUpdateInput = z.output<typeof OrderUpdateRequest>;
export type OrderListQueryT = z.output<typeof OrderListQuery>;
export type FeedQueryT = z.output<typeof FeedQuery>;
export type OrderListItemResponseT = z.output<typeof OrderListItemResponse>;
export type OrderDetailsResponseT = z.output<typeof OrderDetailsResponse>;
export type PersonResponseT = z.output<typeof PersonResponse>;
export type BidResponseT = z.output<typeof BidResponse>;
export type ReviewCreateInput = z.output<typeof ReviewCreateRequest>;
export type PhotoUploadInput = z.output<typeof PhotoUploadRequest>;

export const ReviewResponse = z
  .object({
    id: z.uuid(),
    rating: z.number().int(),
    comment: z.string().nullable(),
    targetId: z.uuid(),
    createdAt: z.string(),
  })
  .meta({ id: 'ReviewResponse' });
