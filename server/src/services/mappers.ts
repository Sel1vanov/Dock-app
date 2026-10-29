/**
 * Преобразование ORM-моделей в ответы API (схемы из src/schemas). Только эти функции решают,
 * какие поля уходят клиенту: пароль, служебные поля и чужие телефоны в ответ не попадают.
 */
import type { Config } from '../core/config.js';
import { signFileUrl } from '../core/security.js';
import { type Bid, type Order, type OrderPhoto, type User, type Vehicle, VerificationStatus } from '../models/index.js';
import type { VerificationDocument } from '../models/VerificationDocument.js';
import type { RatingAggregate } from '../repositories/index.js';
import type { OrderListItemResponseT, PersonResponseT } from '../schemas/orders.js';
import type { DocumentResponseT, UserResponseT } from '../schemas/users.js';
import type { VehicleResponseT } from '../schemas/vehicles.js';

type Ratings = Map<string, RatingAggregate>;

const iso = (d: Date) => d.toISOString();

export function toUserResponse(user: User, rating: RatingAggregate | null): UserResponseT {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone,
    verificationStatus: user.verificationStatus,
    isBlocked: user.isBlocked,
    createdAt: iso(user.createdAt),
    rating,
  };
}

export function toPersonResponse(user: User, ratings: Ratings, showPhone: boolean): PersonResponseT {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: showPhone ? user.phone : null,
    isVerified: user.verificationStatus === VerificationStatus.Verified,
    rating: ratings.get(user.id) ?? null,
  };
}

export function toVehicleResponse(vehicle: Vehicle): VehicleResponseT {
  return {
    id: vehicle.id,
    type: vehicle.type,
    model: vehicle.model,
    maxWeightKg: vehicle.maxWeightKg,
    lengthM: vehicle.lengthM,
    widthM: vehicle.widthM,
    heightM: vehicle.heightM,
    cargoTypes: vehicle.cargoTypes.isInitialized()
      ? vehicle.cargoTypes.getItems().map((c) => ({ code: c.code, name: c.name }))
      : [],
    createdAt: iso(vehicle.createdAt),
    updatedAt: iso(vehicle.updatedAt),
  };
}

export function toOrderListItem(order: Order, extra: { bidsCount: number; myBid: Bid | null }): OrderListItemResponseT {
  return {
    id: order.id,
    status: order.status,
    isEscrowLocked: order.isEscrowLocked,
    cargo: {
      typeCode: order.cargoType.code,
      typeName: order.cargoType.name,
      description: order.description,
      weightKg: order.cargoWeightKg,
      lengthM: order.cargoLengthM,
      widthM: order.cargoWidthM,
      heightM: order.cargoHeightM,
    },
    originAddress: order.originAddress,
    destinationAddress: order.destinationAddress,
    price: order.price,
    createdAt: iso(order.createdAt),
    updatedAt: iso(order.updatedAt),
    bidsCount: extra.bidsCount,
    clientName: order.client.fullName,
    myBid: extra.myBid
      ? {
          id: extra.myBid.id,
          price: extra.myBid.offeredPrice,
          counterPrice: extra.myBid.counterPrice,
          status: extra.myBid.status,
        }
      : null,
  };
}

export function toPhotoResponse(photo: OrderPhoto, config: Config) {
  return {
    id: photo.id,
    stage: photo.stage,
    url: signFileUrl(config, photo.fileKey),
    uploadedAt: iso(photo.uploadedAt),
  };
}

export function toDocumentResponse(doc: VerificationDocument, config: Config): DocumentResponseT {
  return { docType: doc.docType, uploadedAt: iso(doc.uploadedAt), url: signFileUrl(config, doc.fileKey) };
}
