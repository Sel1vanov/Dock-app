/**
 * Преобразование ответов API в DTO. Единственное место, которое знает про формат API:
 * килограммы → тонны, относительные ссылки на файлы → абсолютные.
 */
import { fileUrl } from '../core/api';
import type {
  ApiAdminUser,
  ApiBid,
  ApiDocument,
  ApiDriverBid,
  ApiOrderDetails,
  ApiOrderListItem,
  ApiPerson,
  ApiPhoto,
  ApiUser,
  ApiVehicle,
} from './api';
import type {
  AdminUserDTO,
  BidDTO,
  CargoType,
  DocumentDTO,
  DriverBidDTO,
  OrderDetailsDTO,
  OrderListItemDTO,
  PersonDTO,
  PhotoDTO,
  UserDTO,
  VehicleDTO,
} from './dto';

export const kgToT = (kg: number) => Math.round((Number(kg) / 1000) * 1000) / 1000;
export const tToKg = (t: number) => Math.round(t * 1000 * 100) / 100;

export function toUserDTO(u: ApiUser): UserDTO {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    fullName: u.fullName,
    phone: u.phone,
    isBlocked: u.isBlocked,
    verification: u.verificationStatus,
    rating: u.rating,
  };
}

export function toPersonDTO(p: ApiPerson): PersonDTO {
  return { id: p.id, fullName: p.fullName, phone: p.phone, isVerified: p.isVerified, rating: p.rating };
}

export function toVehicleDTO(v: ApiVehicle): VehicleDTO {
  return {
    id: v.id,
    type: v.type,
    model: v.model,
    weightT: kgToT(v.maxWeightKg),
    lengthM: v.lengthM,
    widthM: v.widthM,
    heightM: v.heightM,
    cargoTypes: v.cargoTypes.map((c) => ({ code: c.code as CargoType, name: c.name })),
  };
}

export function toOrderListItemDTO(o: ApiOrderListItem): OrderListItemDTO {
  return {
    id: o.id,
    status: o.status,
    isEscrowLocked: o.isEscrowLocked,
    cargo: {
      type: o.cargo.typeCode as CargoType,
      typeName: o.cargo.typeName,
      description: o.cargo.description,
      weightT: kgToT(o.cargo.weightKg),
      lengthM: o.cargo.lengthM,
      widthM: o.cargo.widthM,
      heightM: o.cargo.heightM,
    },
    origin: o.originAddress,
    destination: o.destinationAddress,
    price: o.price,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    bidsCount: o.bidsCount,
    clientName: o.clientName,
    myBid: o.myBid,
  };
}

export function toPhotoDTO(p: ApiPhoto): PhotoDTO {
  return { id: p.id, stage: p.stage, url: fileUrl(p.url), uploadedAt: p.uploadedAt };
}

export function toBidDTO(b: ApiBid): BidDTO {
  return {
    id: b.id,
    price: b.price,
    comment: b.comment,
    status: b.status,
    createdAt: b.createdAt,
    driver: toPersonDTO(b.driver),
    vehicles: b.vehicles.map(toVehicleDTO),
  };
}

export function toOrderDetailsDTO(o: ApiOrderDetails): OrderDetailsDTO {
  return {
    ...toOrderListItemDTO(o),
    clientId: o.clientId,
    driverId: o.driverId,
    client: toPersonDTO(o.client),
    driver: o.driver ? toPersonDTO(o.driver) : null,
    bids: o.bids.map(toBidDTO),
    photos: o.photos.map(toPhotoDTO),
    cancelReason: o.cancelReason,
    reviewAuthorIds: o.reviewAuthorIds,
  };
}

export function toDriverBidDTO(b: ApiDriverBid): DriverBidDTO {
  return {
    id: b.id,
    price: b.price,
    status: b.status,
    comment: b.comment,
    createdAt: b.createdAt,
    order: toOrderListItemDTO(b.order),
  };
}

export function toDocumentDTO(d: ApiDocument): DocumentDTO {
  return { docType: d.docType, uploadedAt: d.uploadedAt, url: fileUrl(d.url) };
}

export function toAdminUserDTO(u: ApiAdminUser): AdminUserDTO {
  return {
    ...toUserDTO(u),
    createdAt: u.createdAt,
    documents: u.documents.map(toDocumentDTO),
    vehicles: u.vehicles.map(toVehicleDTO),
  };
}
