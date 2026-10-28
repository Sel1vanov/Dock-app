import type { VehicleDTO } from '../models/dto';
import { toVehicleDTO, tToKg } from '../models/mappers';
import type { VehicleInput } from '../models/schemas';
import { VehicleRepository, type VehiclePayload } from '../repositories/VehicleRepository';

const toPayload = (input: VehicleInput): VehiclePayload => ({
  type: input.type,
  model: input.model || null,
  maxWeightKg: tToKg(input.weightT),
  lengthM: input.lengthM,
  widthM: input.widthM,
  heightM: input.heightM,
  cargoTypeCodes: input.cargoTypes,
});

/** Управление транспортом водителя (CRUD). */
export const VehicleService = {
  async getMyVehicles(): Promise<VehicleDTO[]> {
    return (await VehicleRepository.list()).map(toVehicleDTO);
  },

  async getVehicle(id: string): Promise<VehicleDTO> {
    return toVehicleDTO(await VehicleRepository.get(id));
  },

  async addVehicle(input: VehicleInput): Promise<VehicleDTO> {
    return toVehicleDTO(await VehicleRepository.create(toPayload(input)));
  },

  async updateVehicle(id: string, input: VehicleInput): Promise<VehicleDTO> {
    return toVehicleDTO(await VehicleRepository.update(id, toPayload(input)));
  },

  removeVehicle: (id: string) => VehicleRepository.remove(id),
};
