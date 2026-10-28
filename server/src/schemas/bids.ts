import { z } from 'zod';

import { BidStatus } from '../models/enums.js';
import { positive } from './common.js';
import { OrderListItemResponse } from './orders.js';

export const BidCreateRequest = z
  .object({
    price: positive(100_000_000, 'Цена'),
    comment: z.string().trim().max(300, 'Не больше 300 символов').optional(),
  })
  .strict()
  .meta({ id: 'BidCreateRequest' });

export const BidUpdateRequest = z
  .object({
    price: positive(100_000_000, 'Цена').optional(),
    comment: z.string().trim().max(300, 'Не больше 300 символов').nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Передайте хотя бы одно поле')
  .meta({ id: 'BidUpdateRequest' });

export const MyBidsQuery = z.object({
  status: z.enum(BidStatus).optional(),
});

export const DriverBidResponse = z
  .object({
    id: z.uuid(),
    price: z.number(),
    comment: z.string().nullable(),
    status: z.enum(BidStatus),
    createdAt: z.string(),
    order: OrderListItemResponse,
  })
  .meta({ id: 'DriverBidResponse' });

export type BidCreateInput = z.output<typeof BidCreateRequest>;
export type BidUpdateInput = z.output<typeof BidUpdateRequest>;
export type DriverBidResponseT = z.output<typeof DriverBidResponse>;
