import { toAppError } from '../core/errors';
import { supabase } from '../core/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '../models/database.types';

export type UserRow = Tables<'users'>;

/** Доступ к профилям пользователей (таблица public.users). */
export const UserRepository = {
  async getProfile(userId: string): Promise<UserRow | null> {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (error) throw toAppError(error, 'Не удалось загрузить профиль');
    return data;
  },

  async createProfile(profile: TablesInsert<'users'>): Promise<UserRow> {
    const { data, error } = await supabase.from('users').insert(profile).select('*').single();
    if (error) throw toAppError(error, 'Не удалось создать профиль');
    return data;
  },

  async updateProfile(
    userId: string,
    patch: Pick<TablesUpdate<'users'>, 'full_name' | 'phone' | 'verification_doc_url'>,
  ): Promise<UserRow> {
    const { data, error } = await supabase.from('users').update(patch).eq('id', userId).select('*').single();
    if (error) throw toAppError(error, 'Не удалось сохранить профиль');
    return data;
  },

  /** UC-02: подтверждение документов. Разрешено только администратору (проверяется триггером users_guard). */
  async updateVerificationStatus(userId: string, isVerified: boolean): Promise<void> {
    const { error } = await supabase.from('users').update({ is_verified: isVerified }).eq('id', userId);
    if (error) throw toAppError(error, 'Не удалось изменить статус верификации');
  },
};
