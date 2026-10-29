import type { StatusTone } from '../models/catalog';
import type { CargoType } from '../models/dto';

/**
 * Дизайн-токены Dock («минимализм с характером»): белый фон, чёрный текст и кнопки навигации,
 * фирменный оранжевый — для главных действий и акцентов. Шрифт Onest (поддерживает кириллицу).
 * Ключи navy* сохранены, чтобы экраны не зависели от конкретной палитры: сейчас это оттенки графита.
 */
export const colors = {
  navy900: '#111111',
  navy800: '#1F1F1F',
  navy700: '#2E2E2E',
  navy600: '#4D4D4D',
  accent: '#FF6B00',
  accentDark: '#C2410C',
  accentSoft: '#FFF0E5',
  /** Текст на оранжевом: тёмный читается лучше белого (контраст выше 4.5:1). */
  onAccent: '#111111',

  bg: '#F7F7F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F4F2',
  border: '#ECECE8',
  text: '#111111',
  textSecondary: '#6B6B6B',
  textMuted: '#76766F',
  white: '#FFFFFF',

  success: '#15803D',
  successSoft: '#E8F3EA',
  warning: '#B45309',
  warningSoft: '#FFF4E0',
  danger: '#B91C1C',
  dangerSoft: '#FDECEC',
  info: '#1D4ED8',
  infoSoft: '#EAF0FB',
  progress: '#6D28D9',
  progressSoft: '#F1EAFE',
} as const;

export const toneColors: Record<StatusTone, { fg: string; bg: string }> = {
  info: { fg: colors.info, bg: colors.infoSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  progress: { fg: colors.progress, bg: colors.progressSoft },
  success: { fg: colors.success, bg: colors.successSoft },
  muted: { fg: colors.textSecondary, bg: colors.surfaceAlt },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
};

/** Цвет плашки с иконкой типа груза: ленту легче просматривать глазами. */
export const cargoTints: Record<CargoType, { fg: string; bg: string }> = {
  Machinery: { fg: colors.accentDark, bg: colors.accentSoft },
  Agricultural: { fg: colors.success, bg: colors.successSoft },
  Car: { fg: colors.info, bg: colors.infoSoft },
  Container: { fg: colors.progress, bg: colors.progressSoft },
  Equipment: { fg: colors.warning, bg: colors.warningSoft },
  Other: { fg: colors.textSecondary, bg: colors.surfaceAlt },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 } as const;

/** Начертания шрифта Onest: на iOS и Android вес задаётся отдельным семейством, а не fontWeight. */
export const family = {
  regular: 'Onest_400Regular',
  medium: 'Onest_500Medium',
  semibold: 'Onest_600SemiBold',
  bold: 'Onest_700Bold',
  extrabold: 'Onest_800ExtraBold',
} as const;

export const font = {
  h1: { fontFamily: family.bold, fontSize: 30, letterSpacing: -0.8 },
  h2: { fontFamily: family.bold, fontSize: 22, letterSpacing: -0.4 },
  h3: { fontFamily: family.semibold, fontSize: 17, letterSpacing: -0.2 },
  body: { fontFamily: family.regular, fontSize: 15 },
  bodyBold: { fontFamily: family.semibold, fontSize: 15 },
  small: { fontFamily: family.regular, fontSize: 13 },
  caption: { fontFamily: family.medium, fontSize: 12 },
};

export const shadow = {
  shadowColor: '#111111',
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

export const formatPrice = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;

export const formatNumber = (n: number, digits = 2) =>
  Number(n.toFixed(digits)).toLocaleString('ru-RU', { maximumFractionDigits: digits });

export function formatRelative(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  const hours = Math.round(diffMin / 60);
  if (hours < 24) return `${hours} ч назад`;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/** Приветствие по времени суток на устройстве. */
export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 18) return 'Добрый день';
  if (h >= 18 && h < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

/** «1 заявка», «2 заявки», «5 заявок». */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
