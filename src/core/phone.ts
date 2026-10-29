/**
 * Российский номер телефона. Хранится в одном виде — «+7» и 10 цифр (+79161234567),
 * в интерфейсе показывается как +7 (916) 123-45-67. Правила совпадают с сервером.
 */

/** Код после +7: 3xx, 4xx, 8xx — городские и бесплатные, 9xx — мобильные. */
const RUSSIAN_PHONE = /^\+7[3489][0-9]{9}$/;

/** Десять цифр номера без кода страны: 8 916…, 7 916…, +7 916… и 916… дают одно и то же. */
function nationalDigits(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) return digits.slice(1);
  return digits;
}

/** Номер в формате хранения или null, если это не российский номер. */
export function normalizePhone(input: string): string | null {
  const national = nationalDigits(input);
  if (national.length !== 10) return null;
  const phone = `+7${national}`;
  return RUSSIAN_PHONE.test(phone) ? phone : null;
}

function mask(national: string): string {
  let out = '+7';
  // Разделитель добавляется только перед следующей цифрой — тогда Backspace всегда стирает цифру
  if (national.length > 0) out += ` (${national.slice(0, 3)}`;
  if (national.length > 3) out += `) ${national.slice(3, 6)}`;
  if (national.length > 6) out += `-${national.slice(6, 8)}`;
  if (national.length > 8) out += `-${national.slice(8, 10)}`;
  return out;
}

/** Номер для показа: +7 (916) 123-45-67. Номер в неизвестном формате показывается как есть. */
export function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  return normalized ? mask(normalized.slice(2)) : phone;
}

/**
 * Маска поля ввода: цифры дополняются до +7 (XXX) XXX-XX-XX по мере набора.
 * Первая 7 или 8 считается кодом страны, лишние цифры отбрасываются.
 */
export function formatPhoneInput(text: string): string {
  let digits = text.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('7') || digits.startsWith('8')) digits = digits.slice(1);
  return mask(digits.slice(0, 10));
}
