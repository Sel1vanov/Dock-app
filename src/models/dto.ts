// DTO - то, с чем работает интерфейс
//
// ответы api (килограммы, относительные ссылки на файлы) напрямую в UI не идут:
// сервисы превращают их в эти объекты (см. mappers.ts). зачем:
//  - явно видно, какие поля нужны интерфейсу
//  - поменялся формат api - правлю только маппер, экраны не трогаю
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
// статус верификации водителя (UC-01/UC-02): нет документов -> на проверке -> подтвержден/отклонен
export type VerificationStatus = ApiVerificationStatus;
// код типа груза из справочника cargo_types
export type CargoType = 'Car' | 'Container' | 'Machinery' | 'Agricultural' | 'Equipment' | 'Other';

// группы статусов для списка заявок (параметр status в GET /orders):
// active - все незавершенные, open - ищем исполнителя, inProgress - исполнитель выбран, archive - завершенные
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

// вторая сторона по заказу: заказчик или водитель
export interface PersonDTO {
  id: string;
  fullName: string;
  // виден только второй стороне по назначенному заказу
  phone: string | null;
  isVerified: boolean;
  rating: RatingDTO | null;
}

// габариты в метрах, вес в тоннах (в базе и api вес в кг)
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
  // встречная цена заказчика, null - заказчик свою цену не предлагал
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
  // отклик текущего водителя (для ленты водителя)
  myBid: MyBidDTO | null;
}

export interface BidDTO {
  id: string;
  price: number;
  // встречная цена, которую заказчик предложил водителю
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
  // подписанная ссылка для показа (живет ограниченное время)
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
  // id авторов уже оставленных отзывов по заказу
  reviewAuthorIds: string[];
  // последний спор по заказу (UC-20, UC-21)
  dispute: DisputeDTO | null;
}

// спор по заказу. формат api уже такой, как нужен интерфейсу, поэтому DTO просто его повторяет
export type DisputeDTO = ApiDispute;
export type DisputeStatus = DisputeDTO['status'];
// спор в очереди админа - с кратким описанием заказа
export type AdminDisputeDTO = ApiAdminDispute;

export interface FeedPageDTO extends Page<OrderListItemDTO> {
  // сколько открытых заявок скрыл фильтр по ТС
  hiddenCount: number;
}

// отклик водителя вместе с заказом - для вкладки "мои отклики"
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

// отзыв о текущем юзере (UC-19)
export interface ReviewDTO {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  authorRole: UserRole;
  orderId: string;
  createdAt: string;
}

// параметры поиска, фильтрации и сортировки списков (все делается на сервере)
export type OrderSort = '-createdAt' | 'createdAt' | '-price' | 'price';

export interface OrderListParams {
  q?: string;
  cargoType?: CargoType | null;
  sort?: OrderSort;
}
