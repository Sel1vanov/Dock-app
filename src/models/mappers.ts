/**
 * Преобразование строк БД в DTO. Единственное место, которое знает про snake_case,
 * килограммы и форму вложенных связей PostgREST.
 */
import type { Tables } from './database.types';
import type {
  BidDTO,
  CargoDTO,
  DriverBidDTO,
  OrderDetailsDTO,
  OrderListItemDTO,
  PersonDTO,
  PhotoDTO,
  RatingDTO,
  UserDTO,
  VehicleDTO,
} from './dto';

type RatingsMap = Map<string, { sum: number; count: number }>;
type OrderRow = Tables<'orders'>;
type PersonRow = { id: string; full_name: string | null; phone: string | null; is_verified: boolean };

export const kgToT = (kg: number) => Number(kg) / 1000;
export const tToKg = (t: number) => Math.round(t * 1000 * 100) / 100;

export function toUserDTO(row: Tables<'users'>): UserDTO {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    fullName: row.full_name?.trim() || row.email,
    phone: row.phone,
    isBlocked: row.is_blocked,
    verification: row.is_verified ? 'verified' : row.verification_doc_url ? 'pending' : 'none',
  };
}

export function toRatingDTO(userId: string, ratings: RatingsMap): RatingDTO | null {
  const agg = ratings.get(userId);
  if (!agg || agg.count === 0) return null;
  return { average: Math.round((agg.sum / agg.count) * 10) / 10, count: agg.count };
}

export function toPersonDTO(row: PersonRow | null, ratings: RatingsMap): PersonDTO | null {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name?.trim() || 'Без имени',
    phone: row.phone,
    isVerified: row.is_verified,
    rating: toRatingDTO(row.id, ratings),
  };
}

export function toVehicleDTO(row: Tables<'vehicles'>): VehicleDTO {
  return {
    id: row.id,
    type: row.vehicle_type,
    model: row.model,
    weightT: kgToT(row.max_weight),
    lengthM: Number(row.length),
    widthM: Number(row.width),
    heightM: Number(row.height),
  };
}

export function toCargoDTO(row: OrderRow): CargoDTO {
  return {
    type: row.cargo_type,
    description: row.description,
    weightT: kgToT(row.cargo_weight),
    lengthM: Number(row.cargo_length),
    widthM: Number(row.cargo_width),
    heightM: Number(row.cargo_height),
  };
}

export function toOrderListItemDTO(
  row: OrderRow & { client?: { full_name: string | null } | null },
  extra: { bidsCount?: number; myBid?: OrderListItemDTO['myBid'] } = {},
): OrderListItemDTO {
  return {
    id: row.id,
    status: row.status,
    isEscrowLocked: row.is_escrow_locked,
    cargo: toCargoDTO(row),
    origin: row.origin_address,
    destination: row.destination_address,
    price: Number(row.price),
    createdAt: row.created_at,
    bidsCount: extra.bidsCount ?? 0,
    clientName: row.client?.full_name ?? null,
    myBid: extra.myBid ?? null,
  };
}

export function toPhotoDTO(row: Tables<'order_photos'>, signedUrls: Map<string, string>): PhotoDTO {
  return {
    id: row.id,
    stage: row.stage,
    path: row.photo_url,
    url: signedUrls.get(row.photo_url) ?? null,
    uploadedAt: row.uploaded_at,
  };
}

export function toBidDTO(
  row: Tables<'bids'> & { driver: (PersonRow & { vehicles: Tables<'vehicles'>[] }) | null },
  ratings: RatingsMap,
): BidDTO {
  return {
    id: row.id,
    price: Number(row.offered_price),
    comment: row.comment,
    status: row.status,
    createdAt: row.created_at,
    driver: toPersonDTO(row.driver, ratings) ?? {
      id: row.driver_id,
      fullName: 'Водитель',
      phone: null,
      isVerified: false,
      rating: null,
    },
    vehicles: (row.driver?.vehicles ?? []).map(toVehicleDTO),
  };
}

export function toOrderDetailsDTO(
  row: OrderRow & {
    client: PersonRow | null;
    driver: PersonRow | null;
    bids: Parameters<typeof toBidDTO>[0][];
    order_photos: Tables<'order_photos'>[];
    reviews: { author_id: string }[];
  },
  ratings: RatingsMap,
  signedUrls: Map<string, string>,
  currentUserId: string,
): OrderDetailsDTO {
  const myBidRow = row.bids.find((b) => b.driver_id === currentUserId);
  return {
    ...toOrderListItemDTO(
      { ...row, client: row.client ? { full_name: row.client.full_name } : null },
      {
        bidsCount: row.bids.length,
        myBid: myBidRow ? { id: myBidRow.id, price: Number(myBidRow.offered_price), status: myBidRow.status } : null,
      },
    ),
    clientId: row.client_id,
    driverId: row.driver_id,
    client: toPersonDTO(row.client, ratings),
    driver: toPersonDTO(row.driver, ratings),
    bids: row.bids.map((b) => toBidDTO(b, ratings)),
    photos: row.order_photos.map((p) => toPhotoDTO(p, signedUrls)),
    cancelReason: row.cancel_reason,
    updatedAt: row.updated_at,
    reviewAuthorIds: row.reviews.map((r) => r.author_id),
  };
}

export function toDriverBidDTO(
  row: Tables<'bids'> & { order: (OrderRow & { client?: { full_name: string | null } | null }) | null },
): DriverBidDTO | null {
  if (!row.order) return null;
  const myBid = { id: row.id, price: Number(row.offered_price), status: row.status };
  return {
    ...myBid,
    comment: row.comment,
    createdAt: row.created_at,
    order: toOrderListItemDTO(row.order, { myBid }),
  };
}
