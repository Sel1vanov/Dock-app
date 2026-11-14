// российский телефон. хранится в одном виде: +7 и 10 цифр (+79161234567),
// в интерфейсе показывается как +7 (916) 123-45-67. правила те же, что на сервере

// код после +7: 3xx, 4xx, 8xx - городские и бесплатные, 9xx - мобильные
const RUSSIAN_PHONE = /^\+7[3489][0-9]{9}$/;

// 10 цифр номера без кода страны: 8 916..., 7 916..., +7 916... и 916... дают одно и то же
function nationalDigits(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) return digits.slice(1);
  return digits;
}

// номер в формате хранения или null, если номер не российский
export function normalizePhone(input: string): string | null {
  const national = nationalDigits(input);
  if (national.length !== 10) return null;
  const phone = `+7${national}`;
  return RUSSIAN_PHONE.test(phone) ? phone : null;
}

function mask(national: string): string {
  let out = '+7';
  // разделитель добавляю только перед следующей цифрой - тогда backspace всегда стирает цифру, а не скобку
  if (national.length > 0) out += ` (${national.slice(0, 3)}`;
  if (national.length > 3) out += `) ${national.slice(3, 6)}`;
  if (national.length > 6) out += `-${national.slice(6, 8)}`;
  if (national.length > 8) out += `-${national.slice(8, 10)}`;
  return out;
}

// номер для показа: +7 (916) 123-45-67. если формат непонятный - показываю как есть
export function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  return normalized ? mask(normalized.slice(2)) : phone;
}

// маска для поля ввода: по мере набора цифры превращаются в +7 (XXX) XXX-XX-XX
// первая 7 или 8 считается кодом страны, лишние цифры отбрасываются
export function formatPhoneInput(text: string): string {
  let digits = text.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('7') || digits.startsWith('8')) digits = digits.slice(1);
  return mask(digits.slice(0, 10));
}
