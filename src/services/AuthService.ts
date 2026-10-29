import { tokenStorage } from '../core/tokenStorage';
import type { UserDTO } from '../models/dto';
import { toUserDTO } from '../models/mappers';
import type { PasswordChangeInput, SignInInput, SignUpInput } from '../models/schemas';
import { AuthRepository } from '../repositories/AuthRepository';
import { UserRepository } from '../repositories/UserRepository';

/** Регистрация, вход, выход, смена пароля и профиль текущего пользователя. Токен хранится в tokenStorage. */
export const AuthService = {
  async signIn({ email, password }: SignInInput): Promise<UserDTO> {
    const result = await AuthRepository.login(email, password);
    await tokenStorage.set(result.accessToken);
    return toUserDTO(result.user);
  },

  async signUp(input: SignUpInput): Promise<UserDTO> {
    const result = await AuthRepository.register(input);
    await tokenStorage.set(result.accessToken);
    return toUserDTO(result.user);
  },

  /** Выход: токен удаляется с устройства. */
  async signOut(): Promise<void> {
    await tokenStorage.remove();
  },

  /** Смена пароля: прежние токены сервер отзывает, сохраняем выданный новый. */
  async changePassword(input: PasswordChangeInput): Promise<UserDTO> {
    const result = await UserRepository.changePassword(input);
    await tokenStorage.set(result.accessToken);
    return toUserDTO(result.user);
  },

  /** «Забыли пароль?»: возвращает текст ответа сервера для пользователя. */
  async requestPasswordReset(email: string): Promise<string> {
    return (await AuthRepository.requestPasswordReset(email)).message;
  },

  hasToken: async () => Boolean(await tokenStorage.get()),

  async loadCurrentUser(): Promise<UserDTO> {
    return toUserDTO(await UserRepository.getMe());
  },
};
