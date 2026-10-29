import { z } from 'zod';

import { DocumentType, UserRole, VerificationStatus } from '../models/enums.js';
import { ImageBase64, PaginationQuery, Phone, RatingResponse, pageOf } from './common.js';

export const UserResponse = z
  .object({
    id: z.uuid(),
    email: z.string(),
    role: z.enum(UserRole),
    fullName: z.string(),
    phone: z.string(),
    verificationStatus: z.enum(VerificationStatus),
    isBlocked: z.boolean(),
    createdAt: z.string().describe('ISO 8601'),
    rating: RatingResponse,
  })
  .meta({ id: 'UserResponse' });

export const UserUpdateRequest = z
  .object({
    fullName: z.string().trim().min(2, 'Укажите имя').max(100).optional(),
    phone: Phone.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Передайте хотя бы одно поле')
  .meta({ id: 'UserUpdateRequest' });

export const DocumentTypeParams = z.object({
  docType: z.enum(DocumentType, { error: 'Тип документа: passport, license или sts' }),
});

export const DocumentUploadRequest = z.object({ imageBase64: ImageBase64 }).meta({ id: 'DocumentUploadRequest' });

export const DocumentResponse = z
  .object({
    docType: z.enum(DocumentType),
    uploadedAt: z.string(),
    url: z.string().describe('Временная подписанная ссылка'),
  })
  .meta({ id: 'DocumentResponse' });

export const ReviewsQuery = PaginationQuery;

export const ReceivedReviewResponse = z
  .object({
    id: z.uuid(),
    rating: z.number().int(),
    comment: z.string().nullable(),
    authorName: z.string(),
    authorRole: z.enum(UserRole),
    orderId: z.uuid(),
    createdAt: z.string(),
  })
  .meta({ id: 'ReceivedReviewResponse' });

export const ReceivedReviewPageResponse = pageOf(ReceivedReviewResponse).meta({ id: 'ReceivedReviewPageResponse' });

export type UserResponseT = z.output<typeof UserResponse>;
export type UserUpdateInput = z.output<typeof UserUpdateRequest>;
export type DocumentResponseT = z.output<typeof DocumentResponse>;
