import { apiRequest } from '../core/api';
import type { ApiVehicle, ApiVehicleType } from '../models/api';

export interface VehiclePayload {
  type: ApiVehicleType;
  model: string | null;
  maxWeightKg: number;
  lengthM: number;
  widthM: number;
  heightM: number;
  cargoTypeCodes: string[];
}

/** Транспорт водителя: CRUD /vehicles. */
export const VehicleRepository = {
  list(): Promise<ApiVehicle[]> {
    return apiRequest('GET', '/vehicles');
  },

  get(id: string): Promise<ApiVehicle> {
    return apiRequest('GET', `/vehicles/${id}`);
  },

  create(payload: VehiclePayload): Promise<ApiVehicle> {
    return apiRequest('POST', '/vehicles', { body: payload });
  },

  update(id: string, payload: Partial<VehiclePayload>): Promise<ApiVehicle> {
    return apiRequest('PATCH', `/vehicles/${id}`, { body: payload });
  },

  remove(id: string): Promise<void> {
    return apiRequest('DELETE', `/vehicles/${id}`);
  },
};
