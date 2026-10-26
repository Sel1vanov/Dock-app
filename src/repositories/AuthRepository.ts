import type { Session } from '@supabase/supabase-js';

import { toAppError } from '../core/errors';
import { supabase } from '../core/supabase';

export interface SignUpMetadata {
  role: 'Client' | 'Driver';
  full_name: string;
  phone: string;
}

/** Обёртка над Supabase Auth: регистрация, вход, сессия (JWT). */
export const AuthRepository = {
  async signIn(email: string, password: string): Promise<Session> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw toAppError(error, 'Не удалось войти');
    return data.session;
  },

  /** Метаданные попадут в raw_user_meta_data; триггер on_auth_user_created создаст профиль в public.users. */
  async signUp(email: string, password: string, metadata: SignUpMetadata): Promise<Session | null> {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
    if (error) throw toAppError(error, 'Не удалось зарегистрироваться');
    return data.session;
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw toAppError(error);
  },

  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  onSessionChange(listener: (session: Session | null) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(session));
    return () => data.subscription.unsubscribe();
  },
};
