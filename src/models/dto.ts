/**
 * DTO (Data Transfer Objects) — то, что видит слой представления.
 *
 * Строки таблиц Supabase (snake_case, килограммы, вложенные связи) не попадают в UI напрямую:
 * сервисы преобразуют их в эти плоские объекты (см. mappers.ts). Это даёт:
 *  - безопасность — экран не получит лишних полей (например, verification_doc_url чужого профиля);
 *  - контроль — явно перечислены поля, нужные интерфейсу;
 *  - независимость — при изменении схемы БД меняется только маппер, экраны остаются прежними.
 */
import type { Enums } from './database.types';

export type UserRole = Enums<'user_role'>;
export type OrderStatus = Enums<'order_status'>;
export type BidStatus = Enums<'bid_status'>;
export type CargoType = Enums<'cargo_type'>;
export type VehicleType = Enums<'vehicle_type'>;
export type PhotoStage = Enums<'photo_stage'>;

/** Статус верификации водителя (UC-01/UC-02): нет документов → на проверке → подтверждён. */
export type VerificationStatus = 'none' | 'pending' | 'verified';

export interface RatingDTO {
  average: number;
  count: number;
}

export interface UserDTO {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  phone: string | null;
  isBlocked: boolean;
  verification: VerificationStatus;
}

/** Контрагент по заказу: заказчик или водитель. */
export interface PersonDTO {
  id: string;
  fullName: string;
  phone: string | null;
  isVerified: boolean;
  rating: RatingDTO | null;
}

/** Габариты в метрах, масса в тоннах (в БД масса хранится в килограммах). */
export interface DimensionsDTO {
  lengthM: number;
  widthM: number;
  heightM: number;
  weightT: number;
}

export interface CargoDTO extends DimensionsDTO {
  type: CargoType;
  description: string | null;
}

export interface VehicleDTO extends DimensionsDTO {
  id: string;
  type: VehicleType;
  model: string | null;
}

export interface MyBidDTO {
  id: string;
  price: number;
  status: BidStatus;
}

export interface OrderListItemDTO {
  id: string;
  status: OrderStatus;
  isEscrowLocked: boolean;
  cargo: CargoDTO;
  origin: string;
  destination: string;
  price: number;
  createdAt: string;
  bidsCount: number;
  clientName: string | null;
  /** Отклик текущего водителя (для ленты водителя). */
  myBid: MyBidDTO | null;
}

export interface BidDTO {
  id: string;
  price: number;
  comment: string | null;
  status: BidStatus;
  createdAt: string;
  driver: PersonDTO;
  vehicles: VehicleDTO[];
}

export interface PhotoDTO {
  id: string;
  stage: PhotoStage;
  /** Путь в бакете order-photos. */
  path: string;
  /** Подписанная ссылка для показа (действует ограниченное время). */
  url: string | null;
  uploadedAt: string;
}

export interface OrderDetailsDTO extends OrderListItemDTO {
  clientId: string;
  driverId: string | null;
  client: PersonDTO | null;
  driver: PersonDTO | null;
  bids: BidDTO[];
  photos: PhotoDTO[];
  cancelReason: string | null;
  updatedAt: string;
  /** id авторов уже оставленных отзывов по заказу. */
  reviewAuthorIds: string[];
}

/** Отклик водителя вместе с заказом — вкладка «Мои отклики». */
export interface DriverBidDTO extends MyBidDTO {
  comment: string | null;
  createdAt: string;
  order: OrderListItemDTO;
}
