import { z } from 'zod';

import { UserRole, VerificationStatus } from '../models/enums.js';
import { PaginationQuery, SearchQuery, pageOf } from './common.js';
import { DocumentResponse, UserResponse } from './users.js';
import { VehicleResponse } from './vehicles.js';

export const AdminUsersQuery = PaginationQuery.extend({
  verificationStatus: z.enum(VerificationStatus).optional(),
  role: z.enum(UserRole).optional(),
  q: SearchQuery.describe('Поиск по имени и email'),
});

export const AdminUserPageResponse = pageOf(UserResponse).meta({ id: 'AdminUserPageResponse' });

export const AdminUserDetailsResponse = UserResponse.extend({
  documents: z.array(DocumentResponse),
  vehicles: z.array(VehicleResponse),
}).meta({ id: 'AdminUserDetailsResponse' });

export const AdminUserUpdateRequest = z
  .object({
    verificationStatus: z
      .enum([VerificationStatus.Verified, VerificationStatus.Rejected], { error: 'Решение: verified или rejected' })
      .optional(),
    isBlocked: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Передайте хотя бы одно поле')
  .meta({ id: 'AdminUserUpdateRequest' });

export type AdminUsersQueryT = z.output<typeof AdminUsersQuery>;
export type AdminUserUpdateInput = z.output<typeof AdminUserUpdateRequest>;
