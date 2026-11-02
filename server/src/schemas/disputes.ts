import { z } from 'zod';

import { ACTIVE_TRIP_STATUSES, DisputeStatus, OrderStatus, UserRole } from '../models/enums.js';
import { PaginationQuery, pageOf } from './common.js';

// ------------------------------------------------------------------ запросы ---

export const DisputeOpenRequest = z
  .object({
    reason: z
      .string({ error: 'Опишите, что случилось' })
      .trim()
      .min(5, 'Опишите, что случилось (не меньше 5 символов)')
      .max(500, 'Не больше 500 символов'),
  })
  .strict()
  .meta({ id: 'DisputeOpenRequest' });

export const DisputeResolveRequest = z
  .object({
    status: z.enum([DisputeStatus.ResolvedClient, DisputeStatus.ResolvedDriver], {
      error: 'Решение: ResolvedClient (возврат заказчику) или ResolvedDriver (выплата водителю)',
    }),
    resolutionComment: z
      .string({ error: 'Объясните решение' })
      .trim()
      .min(5, 'Объясните решение (не меньше 5 символов)')
      .max(500, 'Не больше 500 символов'),
  })
  .strict()
  .meta({ id: 'DisputeResolveRequest' });

export const AdminDisputesQuery = PaginationQuery.extend({
  status: z.enum(DisputeStatus).optional().describe('Open — ждут решения; без параметра — все'),
});

// ------------------------------------------------------------------- ответы ---

export const DisputeResponse = z
  .object({
    id: z.uuid(),
    status: z.enum(DisputeStatus),
    reason: z.string(),
    orderStatusAtOpen: z.enum(ACTIVE_TRIP_STATUSES).describe('Этап рейса, на котором открыт спор'),
    openedBy: z.object({ id: z.uuid(), fullName: z.string(), role: z.enum(UserRole) }),
    resolutionComment: z.string().nullable(),
    resolvedAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .meta({ id: 'DisputeResponse' });

export const AdminDisputeResponse = DisputeResponse.extend({
  order: z.object({
    id: z.uuid(),
    title: z.string().describe('Описание груза или его тип'),
    price: z.number(),
    status: z.enum(OrderStatus),
    clientName: z.string(),
    driverName: z.string().nullable(),
  }),
}).meta({ id: 'AdminDisputeResponse' });

export const AdminDisputePageResponse = pageOf(AdminDisputeResponse).meta({ id: 'AdminDisputePageResponse' });

export type DisputeOpenInput = z.output<typeof DisputeOpenRequest>;
export type DisputeResolveInput = z.output<typeof DisputeResolveRequest>;
export type AdminDisputesQueryT = z.output<typeof AdminDisputesQuery>;
export type DisputeResponseT = z.output<typeof DisputeResponse>;
export type AdminDisputeResponseT = z.output<typeof AdminDisputeResponse>;
