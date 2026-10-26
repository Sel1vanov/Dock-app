/**
 * Платформенные функции (диалоги, камера), одинаково работающие на iOS, Android и в вебе.
 */
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

import { AppError } from './errors';

export function confirmAction(title: string, message: string, confirmText = 'Подтвердить'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, onPress: () => resolve(true) },
    ]);
  });
}

export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export type ImageSource = 'camera' | 'library';

/** Снимок с камеры или из галереи в base64 (JPEG). null — пользователь отменил выбор. */
export async function pickImage(source: ImageSource): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.6,
    base64: true,
    exif: false,
  };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera' && Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new AppError('Нет доступа к камере. Разрешите его в настройках');
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.base64) throw new AppError('Не удалось прочитать изображение');
  return asset.base64;
}

/** Выбор источника фото: камера или галерея (в вебе — сразу выбор файла). */
export function chooseImageSource(): Promise<ImageSource | null> {
  if (Platform.OS === 'web') return Promise.resolve('library');
  return new Promise((resolve) => {
    Alert.alert('Добавить фото', undefined, [
      { text: 'Камера', onPress: () => resolve('camera') },
      { text: 'Галерея', onPress: () => resolve('library') },
      { text: 'Отмена', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}
