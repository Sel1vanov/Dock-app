import { toAppError } from '../core/errors';
import { supabase } from '../core/supabase';
import type { Enums, Tables } from '../models/database.types';

export type PhotoRow = Tables<'order_photos'>;

/** Записи фотофиксации (таблица public.order_photos). Сами файлы — в StorageRepository. */
export const PhotoRepository = {
  async addPhoto(orderId: string, path: string, stage: Enums<'photo_stage'>): Promise<PhotoRow> {
    const { data, error } = await supabase
      .from('order_photos')
      .insert({ order_id: orderId, photo_url: path, stage })
      .select('*')
      .single();
    if (error) throw toAppError(error, 'Не удалось сохранить фото');
    return data;
  },

  async getPhotosByOrder(orderId: string): Promise<PhotoRow[]> {
    const { data, error } = await supabase
      .from('order_photos')
      .select('*')
      .eq('order_id', orderId)
      .order('uploaded_at', { ascending: true });
    if (error) throw toAppError(error, 'Не удалось загрузить фото');
    return data;
  },
};
