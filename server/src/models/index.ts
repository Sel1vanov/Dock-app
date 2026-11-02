/** ORM-модели (аналог декларативных моделей SQLAlchemy). Отдельно от схем API (src/schemas). */
export { Bid } from './Bid.js';
export { CargoType } from './CargoType.js';
export { Dispute } from './Dispute.js';
export * from './enums.js';
export { Notification } from './Notification.js';
export { Order } from './Order.js';
export { OrderPhoto } from './OrderPhoto.js';
export { Review } from './Review.js';
export { User } from './User.js';
export { Vehicle } from './Vehicle.js';
export { VehicleCargoType } from './VehicleCargoType.js';
export { VerificationDocument } from './VerificationDocument.js';

import { Bid } from './Bid.js';
import { CargoType } from './CargoType.js';
import { Dispute } from './Dispute.js';
import { Notification } from './Notification.js';
import { Order } from './Order.js';
import { OrderPhoto } from './OrderPhoto.js';
import { Review } from './Review.js';
import { User } from './User.js';
import { Vehicle } from './Vehicle.js';
import { VehicleCargoType } from './VehicleCargoType.js';
import { VerificationDocument } from './VerificationDocument.js';

export const entities = [
  User,
  CargoType,
  Vehicle,
  VehicleCargoType,
  Order,
  Bid,
  OrderPhoto,
  Review,
  VerificationDocument,
  Notification,
  Dispute,
];
