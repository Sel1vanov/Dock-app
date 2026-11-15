import { saveToken } from '../core/api';
import { tokenStorage } from '../core/tokenStorage';
import type { UserDTO } from '../models/dto';
import { toUserDTO } from '../models/mappers';
import type { PasswordChangeInput, SignInInput, SignUpInput } from '../models/schemas';
import { AuthRepository } from '../repositories/AuthRepository';
import { UserRepository } from '../repositories/UserRepository';

// регистрация, вход, выход, смена пароля и профиль текущего юзера. токен лежит в tokenStorage
export const AuthService = {
  async signIn({ email, password }: SignInInput): Promise<UserDTO> {
    const result = await AuthRepository.login(email, password);
    await saveToken(result);
    return toUserDTO(result.user);
  },

  async signUp(input: SignUpInput): Promise<UserDTO> {
    const result = await AuthRepository.register(input);
    await saveToken(result);
    return toUserDTO(result.user);
  },

  // выход: токен удаляется с устройства
  async signOut(): Promise<void> {
    await tokenStorage.remove();
  },

  // смена пароля: старые токены сервер отзывает, сохраняем новый, который он выдал
  async changePassword(input: PasswordChangeInput): Promise<UserDTO> {
    const result = await UserRepository.changePassword(input);
    await saveToken(result);
    return toUserDTO(result.user);
  },

  // "забыли пароль?": возвращает текст ответа сервера, чтобы показать юзеру
  async requestPasswordReset(email: string): Promise<string> {
    return (await AuthRepository.requestPasswordReset(email)).message;
  },

  hasToken: async () => Boolean(await tokenStorage.get()),

  async loadCurrentUser(): Promise<UserDTO> {
    return toUserDTO(await UserRepository.getMe());
  },
};
