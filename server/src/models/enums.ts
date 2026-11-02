/**
 * Перечисления предметной области. В PostgreSQL хранятся как text + CHECK (… in (…)):
 * такой столбец проще расширять миграцией, чем нативный enum, а недопустимое значение
 * всё равно отклоняет сама БД.
 */

export enum UserRole {
  Client = 'Client',
  Driver = 'Driver',
  Admin = 'Admin',
}

/** Статус проверки документов водителя (UC-01, UC-02). */
export enum VerificationStatus {
  None = 'none',
  Pending = 'pending',
  Verified = 'verified',
  Rejected = 'rejected',
}

export enum VehicleType {
  Trawl = 'Trawl',
  Manipulator = 'Manipulator',
  TowTruck = 'TowTruck',
  Flatbed = 'Flatbed',
  Other = 'Other',
}

/** Статусная модель заказа (SAD, раздел 5 + docs/SAD-changes.md). */
export enum OrderStatus {
  Created = 'Created',
  Bidding = 'Bidding',
  Assigned = 'Assigned',
  Loading = 'Loading',
  InTransit = 'InTransit',
  Unloading = 'Unloading',
  /** Открыт спор (UC-20): рейс приостановлен до решения администратора (UC-21). */
  Disputed = 'Disputed',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

/** Спор по заказу: открыт → решён в пользу заказчика (возврат) или водителя (выплата). */
export enum DisputeStatus {
  Open = 'Open',
  ResolvedClient = 'ResolvedClient',
  ResolvedDriver = 'ResolvedDriver',
}

export enum BidStatus {
  Pending = 'Pending',
  Accepted = 'Accepted',
  Rejected = 'Rejected',
}

export enum PhotoStage {
  Loading = 'Loading',
  Unloading = 'Unloading',
}

export enum DocumentType {
  Passport = 'passport',
  License = 'license',
  Sts = 'sts',
}

/** Типы уведомлений: о каком событии сообщается пользователю. */
export enum NotificationType {
  BidPlaced = 'BidPlaced',
  BidUpdated = 'BidUpdated',
  CounterOffer = 'CounterOffer',
  CounterAccepted = 'CounterAccepted',
  BidAccepted = 'BidAccepted',
  BidRejected = 'BidRejected',
  OrderPaid = 'OrderPaid',
  TripStatus = 'TripStatus',
  OrderCompleted = 'OrderCompleted',
  OrderCancelled = 'OrderCancelled',
  ReviewReceived = 'ReviewReceived',
  VerificationResult = 'VerificationResult',
  VerificationRequested = 'VerificationRequested',
  PasswordResetRequested = 'PasswordResetRequested',
  DisputeOpened = 'DisputeOpened',
  DisputeResolved = 'DisputeResolved',
}

export const OPEN_ORDER_STATUSES = [OrderStatus.Created, OrderStatus.Bidding] as const;
/** Исполнитель выбран, рейс идёт. После оплаты в этих статусах можно открыть спор. */
export const ACTIVE_TRIP_STATUSES = [
  OrderStatus.Assigned,
  OrderStatus.Loading,
  OrderStatus.InTransit,
  OrderStatus.Unloading,
] as const;
/** «В работе» у заказчика: рейс идёт или приостановлен спором. */
export const IN_PROGRESS_ORDER_STATUSES = [...ACTIVE_TRIP_STATUSES, OrderStatus.Disputed] as const;
export const FINISHED_ORDER_STATUSES = [OrderStatus.Completed, OrderStatus.Cancelled] as const;

/** Группы статусов для фильтра списка заявок (GET /orders?status=…). */
export const ORDER_STATUS_GROUPS = ['active', 'open', 'inProgress', 'archive'] as const;
export type OrderStatusGroup = (typeof ORDER_STATUS_GROUPS)[number];
