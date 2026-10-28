import type { EntityManager } from '@mikro-orm/postgresql';

import { CargoType } from '../models/index.js';

export class CargoTypeRepository {
  constructor(private readonly em: EntityManager) {}

  list(): Promise<CargoType[]> {
    return this.em.find(CargoType, {}, { orderBy: { sortOrder: 'asc' } });
  }

  findByCodes(codes: string[]): Promise<CargoType[]> {
    return this.em.find(CargoType, { code: { $in: codes } }, { orderBy: { sortOrder: 'asc' } });
  }

  findByCode(code: string): Promise<CargoType | null> {
    return this.em.findOne(CargoType, { code });
  }
}
