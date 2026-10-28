import { CARGO_TYPES } from '../models/catalog';
import type { CargoType } from '../models/dto';
import { CatalogRepository } from '../repositories/CatalogRepository';

export interface CargoTypeOption {
  value: CargoType;
  label: string;
  icon: string;
}

let cached: CargoTypeOption[] | null = null;

/** Справочник типов груза с сервера (названия и порядок) + иконки из клиента. Кэшируется на сеанс. */
export const CatalogService = {
  async getCargoTypes(): Promise<CargoTypeOption[]> {
    if (cached) return cached;
    const fromApi = await CatalogRepository.cargoTypes();
    cached = fromApi.map((c) => {
      const local = CARGO_TYPES.find((t) => t.value === c.code);
      return { value: c.code as CargoType, label: c.name, icon: local?.icon ?? 'package-variant-closed' };
    });
    return cached;
  },
};
