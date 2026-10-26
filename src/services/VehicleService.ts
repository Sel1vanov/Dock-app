import type { VehicleDTO } from '../models/dto';
import { toVehicleDTO, tToKg } from '../models/mappers';
import type { VehicleInput } from '../models/schemas';
import { VehicleRepository } from '../repositories/VehicleRepository';

/** Управление транспортом водителя. */
export const VehicleService = {
  async getMyVehicles(driverId: string): Promise<VehicleDTO[]> {
    const rows = await VehicleRepository.getDriverVehicles(driverId);
    return rows.map(toVehicleDTO);
  },

  async addVehicle(driverId: string, input: VehicleInput): Promise<VehicleDTO> {
    const row = await VehicleRepository.addVehicle({
      driver_id: driverId,
      vehicle_type: input.type,
      model: input.model || null,
      max_weight: tToKg(input.weightT),
      length: input.lengthM,
      width: input.widthM,
      height: input.heightM,
    });
    return toVehicleDTO(row);
  },

  removeVehicle: VehicleRepository.deleteVehicle,
};
