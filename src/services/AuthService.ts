import { supabase } from '../supabase';

export class AuthService {
  // Валидация Email
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  // Вход (Email + Пароль)
  async signInWithEmail(email: string, password: string) {
    const cleanedEmail = email.trim();

    if (!this.validateEmail(cleanedEmail)) {
      throw new Error('Введите корректный email');
    }
    if (!password) {
      throw new Error('Введите пароль');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanedEmail,
      password: password,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  // Регистрация (Email + Пароль)
  async signUpWithEmail(email: string, password: string) {
  const cleanedEmail = email.trim();

  if (!this.validateEmail(cleanedEmail)) {
    throw new Error('Введите корректный email');
  }
  if (!password || password.length < 6) {
    throw new Error('Пароль должен содержать минимум 6 символов');
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanedEmail,
    password: password,
  });

  if (error) throw new Error(error.message);

  // Если пользователь с таким email уже существует и подтвержден, 
  // Supabase вернет user, но identities будет пустым массивом []
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    throw new Error('Пользователь с таким Email уже зарегистрирован');
  }

  return data;
}
}