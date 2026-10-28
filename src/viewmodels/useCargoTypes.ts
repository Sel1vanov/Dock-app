import { CARGO_TYPES } from '../models/catalog';
import { CatalogService } from '../services/CatalogService';
import { useQuery } from './useAsync';

/** Типы груза для форм и фильтров: с сервера, а пока не загрузились (или нет сети) — встроенный список. */
export function useCargoTypes() {
  const query = useQuery(() => CatalogService.getCargoTypes(), []);
  return query.data ?? CARGO_TYPES;
}
