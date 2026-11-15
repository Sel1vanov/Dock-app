// связь со второй стороной по заказу: звонок и мессенджеры. своего чата в приложении нет,
// используется телефон из профиля, который видят только участники назначенного заказа
import { Linking } from 'react-native';

import { notify } from './platform';

// номер в международном формате без плюса: 8XXXXXXXXXX или 10 цифр -> 7XXXXXXXXXX
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
    // чат откроется, только если человек разрешил находить себя в telegram по номеру
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
