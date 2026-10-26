import type { StatusTone } from '../models/catalog';

/** Дизайн-токены Dock: глубокий синий (надёжность) + сигнальный оранжевый (спецтехника). */
export const colors = {
  navy900: '#0A1630',
  navy800: '#11214A',
  navy700: '#1B2F63',
  navy600: '#2A4384',
  accent: '#FF7A1A',
  accentDark: '#E5620A',
  accentSoft: '#FFF1E6',

  bg: '#F2F4F8',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F8FB',
  border: '#E3E7EF',
  text: '#0F1B33',
  textSecondary: '#5B6782',
  textMuted: '#8D97AD',
  white: '#FFFFFF',

  success: '#16A34A',
  successSoft: '#E7F7EC',
  warning: '#D97706',
  warningSoft: '#FEF4E2',
  danger: '#DC2626',
  dangerSoft: '#FDECEC',
  info: '#2563EB',
  infoSoft: '#E8F0FE',
  progress: '#7C3AED',
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

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const font = {
  h1: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyBold: { fontSize: 15, fontWeight: '600' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
};

export const shadow = {
  shadowColor: '#0A1630',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
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

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
