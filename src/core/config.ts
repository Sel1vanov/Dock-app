// адрес сервера api. откуда берется:
//  1. EXPO_PUBLIC_API_URL из .env (например сервер в облаке)
//  2. в разработке - тот же комп, где запущен expo (ip беру из адреса metro, порт 8000),
//     поэтому телефон с expo go в той же wi-fi находит сервер без настройки
//  3. в браузере - тот же хост, что у страницы
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
