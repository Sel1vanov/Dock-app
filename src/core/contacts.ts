/**
 * Связь с контрагентом по заказу: звонок и мессенджеры. Встроенного чата в приложении нет —
 * используется телефон из профиля, который виден только участникам назначенного заказа.
 */
import { Linking } from 'react-native';

import { notify } from './platform';

/** Номер в международном формате без «+»: российский 8XXXXXXXXXX или 10 цифр → 7XXXXXXXXXX. */
export function internationalDigits(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return digits;
}

export function contactLinks(phone: string) {
  const digits = internationalDigits(phone);
  return {
    call: `tel:+${digits}`,
    whatsapp: `https://wa.me/${digits}`,
    /** Откроет чат, если собеседник разрешил находить себя в Telegram по номеру. */
    telegram: `https://t.me/+${digits}`,
  };
}

export async function openLink(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    notify('Не удалось открыть', 'Проверьте, что на устройстве установлено нужное приложение');
  }
}
