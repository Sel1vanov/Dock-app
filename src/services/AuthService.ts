import type { Session } from '@supabase/supabase-js';

import { AppError } from '../core/errors';
import type { UserDTO } from '../models/dto';
import { toUserDTO } from '../models/mappers';
import type { SignInInput, SignUpInput } from '../models/schemas';
import { AuthRepository } from '../repositories/AuthRepository';
import { UserRepository } from '../repositories/UserRepository';

export type SignUpResult = { status: 'signed-in' } | { status: 'confirm-email' };

/** Регистрация, вход и загрузка профиля текущего пользователя. */
export const AuthService = {
  getSession: AuthRepository.getSession,
  onSessionChange: AuthRepository.onSessionChange,

  async signIn({ email, password }: SignInInput): Promise<void> {
    await AuthRepository.signIn(email, password);
  },

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    const session = await AuthRepository.signUp(input.email, input.password, {
      role: input.role,
      full_name: input.fullName,
      phone: input.phone,
    });
    // Если в проекте включено подтверждение email, сессии ещё нет — нужно перейти по ссылке из письма.
    return session ? { status: 'signed-in' } : { status: 'confirm-email' };
  },

  signOut: AuthRepository.signOut,

  /**
   * Профиль текущего пользователя. Обычно его создаёт триггер БД при регистрации;
   * если профиля нет (например, пользователь создан до триггера) — создаём из метаданных.
   */
  async loadCurrentUser(session: Session): Promise<UserDTO> {
    const { user } = session;
    let row = await UserRepository.getProfile(user.id);
    if (!row) {
      const meta = user.user_metadata ?? {};
      row = await UserRepository.createProfile({
        id: user.id,
        email: user.email ?? '',
        role: meta.role === 'Driver' ? 'Driver' : 'Client',
        full_name: typeof meta.full_name === 'string' ? meta.full_name : null,
        phone: typeof meta.phone === 'string' ? meta.phone : null,
      });
    }
    if (row.is_blocked) {
      await AuthRepository.signOut();
      throw new AppError('Аккаунт заблокирован администратором. Обратитесь в поддержку');
    }
    return toUserDTO(row);
  },
};
