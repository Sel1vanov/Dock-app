/**
 * Типы ответов сервера Dock API v1 (см. Swagger: http://<сервер>:8000/docs).
 * Это «сырой» формат транспорта: единицы БД (кг, м) и относительные ссылки на файлы.
 * В интерфейс попадают не они, а DTO из dto.ts (преобразование — в mappers.ts).
 */
export type ApiUserRole = 'Client' | 'Driver' | 'Admin';
export type ApiVerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';
export type ApiOrderStatus =
  'Created' | 'Bidding' | 'Assigned' | 'Loading' | 'InTransit' | 'Unloading' | 'Completed' | 'Cancelled';
export type ApiBidStatus = 'Pending' | 'Accepted' | 'Rejected';
export type ApiPhotoStage = 'Loading' | 'Unloading';
export type ApiVehicleType = 'Trawl' | 'Manipulator' | 'TowTruck' | 'Flatbed' | 'Other';
export type ApiDocumentType = 'passport' | 'license' | 'sts';
export type ApiNotificationType =
  | 'BidPlaced'
  | 'BidUpdated'
  | 'CounterOffer'
  | 'CounterAccepted'
  | 'BidAccepted'
  | 'BidRejected'
  | 'OrderPaid'
  | 'TripStatus'
  | 'OrderCompleted'
  | 'OrderCancelled'
  | 'ReviewReceived'
  | 'VerificationResult'
  | 'VerificationRequested'
  | 'PasswordResetRequested';

export interface ApiPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiRating {
  average: number;
  count: number;
}

export interface ApiUser {
  id: string;
  email: string;
  role: ApiUserRole;
  fullName: string;
  phone: string;
  verificationStatus: ApiVerificationStatus;
  isBlocked: boolean;
  createdAt: string;
  rating: ApiRating | null;
}

export interface ApiToken {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: ApiUser;
}

export interface ApiCargoType {
  code: string;
  name: string;
}

export interface ApiVehicle {
  id: string;
  type: ApiVehicleType;
  model: string | null;
  maxWeightKg: number;
  lengthM: number;
  widthM: number;
  heightM: number;
  cargoTypes: ApiCargoType[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiOrderListItem {
  id: string;
  status: ApiOrderStatus;
  isEscrowLocked: boolean;
  cargo: {
    typeCode: string;
    typeName: string;
    description: string | null;
    weightKg: number;
    lengthM: number;
    widthM: number;
    heightM: number;
  };
  originAddress: string;
  destinationAddress: string;
  price: number;
  createdAt: string;
  updatedAt: string;
  bidsCount: number;
  clientName: string;
  myBid: { id: string; price: number; counterPrice: number | null; status: ApiBidStatus } | null;
}

export interface ApiPerson {
  id: string;
  fullName: string;
  phone: string | null;
  isVerified: boolean;
  rating: ApiRating | null;
}

export interface ApiBid {
  id: string;
  price: number;
  counterPrice: number | null;
  comment: string | null;
  status: ApiBidStatus;
  createdAt: string;
  driver: ApiPerson;
  vehicles: ApiVehicle[];
}

export interface ApiPhoto {
  id: string;
  stage: ApiPhotoStage;
  url: string;
  uploadedAt: string;
}

export interface ApiOrderDetails extends ApiOrderListItem {
  clientId: string;
  driverId: string | null;
  client: ApiPerson;
  driver: ApiPerson | null;
  bids: ApiBid[];
  photos: ApiPhoto[];
  cancelReason: string | null;
  reviewAuthorIds: string[];
}

export interface ApiFeedPage extends ApiPage<ApiOrderListItem> {
  hiddenCount: number;
}

export interface ApiDriverBid {
  id: string;
  price: number;
  counterPrice: number | null;
  comment: string | null;
  status: ApiBidStatus;
  createdAt: string;
  order: ApiOrderListItem;
}

export interface ApiDocument {
  docType: ApiDocumentType;
  uploadedAt: string;
  url: string;
}

export interface ApiAdminUser extends ApiUser {
  documents: ApiDocument[];
  vehicles: ApiVehicle[];
}

export interface ApiNotification {
  id: string;
  type: ApiNotificationType;
  title: string;
  body: string;
  orderId: string | null;
  relatedUserId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ApiNotificationPage extends ApiPage<ApiNotification> {
  unreadCount: number;
}

export interface ApiReceivedReview {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  authorRole: ApiUserRole;
  orderId: string;
  createdAt: string;
}
