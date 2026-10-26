import { toAppError } from '../core/errors';
import { supabase } from '../core/supabase';
import type { TablesInsert } from '../models/database.types';

export interface RatingAggregate {
  sum: number;
  count: number;
}

/** Отзывы и рейтинг (таблица public.reviews). */
export const ReviewRepository = {
  async createReview(review: TablesInsert<'reviews'>): Promise<void> {
    const { error } = await supabase.from('reviews').insert(review);
    if (error) throw toAppError(error, 'Не удалось отправить отзыв');
  },

  /**
   * Рейтинги сразу для всех пользователей на экране — один запрос `target_id IN (...)`
   * вместо отдельного запроса на каждого водителя в списке откликов (аналог selectinload).
   */
  async getRatings(userIds: string[]): Promise<Map<string, RatingAggregate>> {
    const result = new Map<string, RatingAggregate>();
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return result;
    const { data, error } = await supabase.from('reviews').select('target_id, rating').in('target_id', ids);
    if (error) throw toAppError(error, 'Не удалось загрузить рейтинг');
    for (const row of data) {
      if (row.rating == null) continue;
      const agg = result.get(row.target_id) ?? { sum: 0, count: 0 };
      agg.sum += row.rating;
      agg.count += 1;
      result.set(row.target_id, agg);
    }
    return result;
  },
};
