import { VehicleRepository } from '../repositories/VehicleRepository';

export class VehicleService {
  private vehicleRepo = new VehicleRepository();

  async getVehiclesCount(): Promise<number> {
    const vehicles = await this.vehicleRepo.getAllVehicles();
    return vehicles.length;
  }
}