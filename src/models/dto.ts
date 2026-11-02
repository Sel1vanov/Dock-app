/**
 * DTO (Data Transfer Objects) — то, что видит слой представления.
 *
 * Ответы API (килограммы, относительные ссылки на файлы) не попадают в UI напрямую:
 * сервисы преобразуют их в эти объекты (см. mappers.ts). Это даёт:
 *  - контроль — явно перечислены поля, нужные интерфейсу;
 *  - независимость — при изменении формата API меняется только маппер, экраны остаются прежними.
 */
import type {
  ApiAdminDispute,
  ApiBidStatus,
  ApiDispute,
  ApiDocumentType,
  ApiNotificationType,
  ApiOrderStatus,
  ApiPhotoStage,
  ApiUserRole,
  ApiVehicleType,
  ApiVerificationStatus,
} from './api';

export type UserRole = ApiUserRole;
export type OrderStatus = ApiOrderStatus;
export type BidStatus = ApiBidStatus;
export type VehicleType = ApiVehicleType;
export type PhotoStage = ApiPhotoStage;
export type DocumentType = ApiDocumentType;
/** Статус верификации водителя (UC-01/UC-02): нет документов → на проверке → подтверждён/отклонён. */
export type VerificationStatus = ApiVerificationStatus;
/** Код типа груза из справочника cargo_types. */
export type CargoType = 'Car' | 'Container' | 'Machinery' | 'Agricultural' | 'Equipment' | 'Other';

/**
 * Группы статусов для списка заявок (параметр status в GET /orders):
 * active — все незавершённые, open — поиск исполнителя, inProgress — исполнитель выбран, archive — завершённые.
 */
export type OrderStatusGroup = 'active' | 'open' | 'inProgress' | 'archive';

export interface Page<T> {
  items: T[];
  total: number;
}

export interface RatingDTO {
  average: number;
  count: number;
}

export interface UserDTO {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  phone: string;
  isBlocked: boolean;
  verification: VerificationStatus;
  rating: RatingDTO | null;
}

/** Контрагент по заказу: заказчик или водитель. */
export interface PersonDTO {
  id: string;
  fullName: string;
  /** Виден только контрагенту по назначенному заказу. */
  phone: string | null;
  isVerified: boolean;
  rating: RatingDTO | null;
}

/** Габариты в метрах, масса в тоннах (в БД и API масса — в килограммах). */
export interface DimensionsDTO {
  lengthM: number;
  widthM: number;
  heightM: number;
  weightT: number;
}

export interface CargoDTO extends DimensionsDTO {
  type: CargoType;
  typeName: string;
  description: string | null;
}

export interface CargoTypeDTO {
  code: CargoType;
  name: string;
}

export interface VehicleDTO extends DimensionsDTO {
  id: string;
  type: VehicleType;
  model: string | null;
  cargoTypes: CargoTypeDTO[];
}

export interface MyBidDTO {
  id: string;
  price: number;
  /** Встречная цена заказчика; null — заказчик свою цену не предлагал. */
  counterPrice: number | null;
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
  updatedAt: string;
  bidsCount: number;
  clientName: string;
  /** Отклик текущего водителя (для ленты водителя). */
  myBid: MyBidDTO | null;
}

export interface BidDTO {
  id: string;
  price: number;
  /** Встречная цена, которую заказчик предложил водителю. */
  counterPrice: number | null;
  comment: string | null;
  status: BidStatus;
  createdAt: string;
  driver: PersonDTO;
  vehicles: VehicleDTO[];
}

export interface PhotoDTO {
  id: string;
  stage: PhotoStage;
  /** Подписанная ссылка для показа (действует ограниченное время). */
  url: string;
  uploadedAt: string;
}

export interface OrderDetailsDTO extends OrderListItemDTO {
  clientId: string;
  driverId: string | null;
  client: PersonDTO;
  driver: PersonDTO | null;
  bids: BidDTO[];
  photos: PhotoDTO[];
  cancelReason: string | null;
  /** id авторов уже оставленных отзывов по заказу. */
  reviewAuthorIds: string[];
  /** Последний спор по заказу (UC-20, UC-21). */
  dispute: DisputeDTO | null;
}

/** Спор по заказу. Формат API совпадает с нужным интерфейсу — DTO его повторяет. */
export type DisputeDTO = ApiDispute;
export type DisputeStatus = DisputeDTO['status'];
/** Спор в очереди администратора — с кратким описанием заказа. */
export type AdminDisputeDTO = ApiAdminDispute;

export interface FeedPageDTO extends Page<OrderListItemDTO> {
  /** Сколько открытых заявок скрыто фильтром по ТС. */
  hiddenCount: number;
}

/** Отклик водителя вместе с заказом — вкладка «Мои отклики». */
export interface DriverBidDTO extends MyBidDTO {
  comment: string | null;
  createdAt: string;
  order: OrderListItemDTO;
}

export interface DocumentDTO {
  docType: DocumentType;
  uploadedAt: string;
  url: string;
}

export interface AdminUserDTO extends UserDTO {
  createdAt: string;
  documents: DocumentDTO[];
  vehicles: VehicleDTO[];
}

export type NotificationType = ApiNotificationType;

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  orderId: string | null;
  relatedUserId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPageDTO extends Page<NotificationDTO> {
  unreadCount: number;
}

/** Отзыв о текущем пользователе (UC-19). */
export interface ReviewDTO {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  authorRole: UserRole;
  orderId: string;
  createdAt: string;
}

/** Параметры серверного поиска, фильтрации и сортировки списков. */
export type OrderSort = '-createdAt' | 'createdAt' | '-price' | 'price';

export interface OrderListParams {
  q?: string;
  cargoType?: CargoType | null;
  sort?: OrderSort;
}
