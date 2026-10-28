/**
 * Адрес сервера API. Порядок выбора:
 *  1. EXPO_PUBLIC_API_URL из .env (например, адрес сервера в облаке);
 *  2. в разработке — тот же компьютер, где запущен Expo (IP берётся из адреса Metro, порт 8000),
 *     поэтому телефон с Expo Go в той же Wi-Fi сети находит сервер без настройки;
 *  3. в браузере — тот же хост, что у страницы.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 8000;

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:${API_PORT}`;
}

export const API_URL = resolveApiUrl();
export const API_BASE = `${API_URL}/api/v1`;
