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
  Completed = 'Completed',
  Cancelled = 'Cancelled',
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

export const OPEN_ORDER_STATUSES = [OrderStatus.Created, OrderStatus.Bidding] as const;
export const ACTIVE_TRIP_STATUSES = [
  OrderStatus.Assigned,
  OrderStatus.Loading,
  OrderStatus.InTransit,
  OrderStatus.Unloading,
] as const;
export const FINISHED_ORDER_STATUSES = [OrderStatus.Completed, OrderStatus.Cancelled] as const;
