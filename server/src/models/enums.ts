// enum'ы предметной области. в postgres лежат как text + CHECK (... in (...)):
// такой столбец проще расширять миграцией, чем нативный enum, а левое значение база все равно не пропустит

export enum UserRole {
  Client = 'Client',
  Driver = 'Driver',
  Admin = 'Admin',
}

// статус проверки документов водителя (UC-01, UC-02)
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

// статусы заказа (SAD раздел 5 + docs/SAD-changes.md)
export enum OrderStatus {
  Created = 'Created',
  Bidding = 'Bidding',
  Assigned = 'Assigned',
  Loading = 'Loading',
  InTransit = 'InTransit',
  Unloading = 'Unloading',
  // открыт спор (UC-20): рейс на паузе, пока админ не решит (UC-21)
  Disputed = 'Disputed',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

// спор: открыт -> решен в пользу заказчика (возврат) или водителя (выплата)
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

// типы уведомлений - про какое событие сообщаем
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
// исполнитель выбран, рейс идет. после оплаты в этих статусах можно открыть спор
export const ACTIVE_TRIP_STATUSES = [
  OrderStatus.Assigned,
  OrderStatus.Loading,
  OrderStatus.InTransit,
  OrderStatus.Unloading,
] as const;
// "в работе" у заказчика: рейс идет или стоит на паузе из-за спора
export const IN_PROGRESS_ORDER_STATUSES = [...ACTIVE_TRIP_STATUSES, OrderStatus.Disputed] as const;
export const FINISHED_ORDER_STATUSES = [OrderStatus.Completed, OrderStatus.Cancelled] as const;

// группы статусов для фильтра списка заявок (GET /orders?status=...)
export const ORDER_STATUS_GROUPS = ['active', 'open', 'inProgress', 'archive'] as const;
export type OrderStatusGroup = (typeof ORDER_STATUS_GROUPS)[number];
