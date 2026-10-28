import { apiRequest } from '../core/api';
import type { ApiCargoType } from '../models/api';

/** Справочники: GET /cargo-types. */
export const CatalogRepository = {
  cargoTypes(): Promise<ApiCargoType[]> {
    return apiRequest('GET', '/cargo-types');
  },
};
