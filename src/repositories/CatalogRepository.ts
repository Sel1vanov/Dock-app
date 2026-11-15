import { apiRequest } from '../core/api';
import type { ApiCargoType } from '../models/api';

// справочники: GET /cargo-types
export const CatalogRepository = {
  cargoTypes(): Promise<ApiCargoType[]> {
    return apiRequest('GET', '/cargo-types');
  },
};
