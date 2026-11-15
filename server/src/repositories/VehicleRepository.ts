import type { EntityManager } from '@mikro-orm/postgresql';

import { Vehicle } from '../models/index.js';

// транспорт водителей (vehicles + N:M vehicle_cargo_types)
export class VehicleRepository {
  constructor(private readonly em: EntityManager) {}

  // типы грузов (N:M) догружаются одним запросом IN (...) на все ТС, как selectinload
  listByDriver(driverId: string): Promise<Vehicle[]> {
    return this.em.find(
      Vehicle,
      { driver: driverId },
      { populate: ['cargoTypes'], strategy: 'select-in', orderBy: { createdAt: 'asc', id: 'asc' } },
    );
  }

  // ТС сразу нескольких водителей (для списка откликов), без запроса на каждого
  async listByDrivers(driverIds: string[]): Promise<Map<string, Vehicle[]>> {
    const result = new Map<string, Vehicle[]>();
    if (driverIds.length === 0) return result;
    const vehicles = await this.em.find(
      Vehicle,
      { driver: { $in: [...new Set(driverIds)] } },
      { populate: ['cargoTypes'], strategy: 'select-in', orderBy: { createdAt: 'asc', id: 'asc' } },
    );
    for (const v of vehicles) {
      const list = result.get(v.driver.id) ?? [];
      list.push(v);
      result.set(v.driver.id, list);
    }
    return result;
  }

  findById(id: string): Promise<Vehicle | null> {
    return this.em.findOne(Vehicle, { id }, { populate: ['cargoTypes'] });
  }

  create(data: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'cargoTypes'>): Vehicle {
    return this.em.create(Vehicle, data);
  }

  remove(vehicle: Vehicle): void {
    this.em.remove(vehicle);
  }
}
