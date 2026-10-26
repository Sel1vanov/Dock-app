import { decode } from 'base64-arraybuffer';

import { toAppError } from '../core/errors';
import { supabase } from '../core/supabase';

export type BucketName = 'documents' | 'order-photos';

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Файлы в Supabase Storage. Бакеты приватные, просмотр — по подписанным ссылкам. */
export const StorageRepository = {
  async uploadBase64(bucket: BucketName, path: string, base64: string, contentType: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, decode(base64), { contentType, upsert: false });
    if (error) throw toAppError(error, 'Не удалось загрузить файл');
    return data.path;
  },

  /** Подписанные ссылки для всех файлов одним запросом. */
  async createSignedUrls(bucket: BucketName, paths: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (paths.length === 0) return result;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error) throw toAppError(error, 'Не удалось получить ссылки на файлы');
    for (const item of data) {
      if (item.path && item.signedUrl) result.set(item.path, item.signedUrl);
    }
    return result;
  },

  async listFolder(bucket: BucketName, folder: string): Promise<string[]> {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 100 });
    if (error) throw toAppError(error, 'Не удалось получить список файлов');
    return data.map((f) => `${folder}/${f.name}`);
  },
};
