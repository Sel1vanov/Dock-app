import { CargoTypeRepository } from '../repositories/index.js';
import type { ServiceContext } from './context.js';

/** Справочники для форм клиента. */
export class CatalogService {
  private readonly cargoTypes: CargoTypeRepository;

  constructor(ctx: ServiceContext) {
    this.cargoTypes = new CargoTypeRepository(ctx.em);
  }

  async listCargoTypes() {
    return (await this.cargoTypes.list()).map((c) => ({ code: c.code, name: c.name }));
  }
}
