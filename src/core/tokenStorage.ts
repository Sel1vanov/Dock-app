// где лежит JWT на устройстве: на ios/android - в защищенном хранилище ОС (Keychain/Keystore)
// через expo-secure-store, в браузере - в localStorage. при выходе токен удаляется
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'dock.accessToken';

export const tokenStorage = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
    return SecureStore.getItemAsync(KEY);
  },

  async set(token: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(KEY, token);
      return;
    }
    await SecureStore.setItemAsync(KEY, token);
  },

  async remove(): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(KEY);
      return;
    }
    await SecureStore.deleteItemAsync(KEY);
  },
};
