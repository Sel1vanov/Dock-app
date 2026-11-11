/** Базовые UI-компоненты Dock. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type ComponentRef, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type ColorValue,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';

import type { StatusTone } from '../../models/catalog';
import { colors, family, font, radius, shadow, spacing, toneColors } from '../theme';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export function Icon({ name, size = 20, color = colors.text }: { name: string; size?: number; color?: ColorValue }) {
  return <MaterialCommunityIcons name={name as IconName} size={size} color={color as string} />;
}

// --------------------------------------------------------------- Button ---

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  compact,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: ViewStyle;
}) {
  const palette = {
    primary: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.text, border: 'transparent' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
    success: { bg: colors.success, fg: colors.white, border: colors.success },
  }[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={compact ? 16 : 20} color={palette.fg} /> : null}
          {title ? (
            <Text style={[styles.buttonText, compact && { fontSize: 14 }, { color: palette.fg }]}>{title}</Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

// ----------------------------------------------------------------- Card ---

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92, transform: [{ scale: 0.995 }] }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {action}
    </View>
  );
}

// ------------------------------------------------------------- TextField ---

export function TextField({
  label,
  error,
  icon,
  suffix,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string; icon?: string; suffix?: string; style?: ViewStyle }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrap, error ? { borderColor: colors.danger } : null]}>
        {icon ? <Icon name={icon} size={18} color={colors.textMuted} /> : null}
        <TextInput placeholderTextColor={colors.textMuted} style={styles.input} {...props} />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ------------------------------------------------------- Chip / Segmented ---

export function Chip({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const fg = selected ? colors.white : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && { color: colors.text }]}>{o.label}</Text>
            {o.badge ? (
              <View style={styles.segmentBadge}>
                <Text style={styles.segmentBadgeText}>{o.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- Badge ---

export function Badge({ label, tone, icon }: { label: string; tone: StatusTone; icon?: string }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {icon ? <Icon name={icon} size={14} color={c.fg} /> : null}
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 44, color = colors.navy700 }: { name: string; size?: number; color?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials || '?'}</Text>
    </View>
  );
}

export function RatingLabel({ rating }: { rating: { average: number; count: number } | null }) {
  if (!rating) return <Text style={styles.muted}>Нет отзывов</Text>;
  return (
    <View style={styles.row}>
      <Icon name="star" size={15} color="#F5A524" />
      <Text style={styles.ratingText}>
        {rating.average.toFixed(1).replace('.', ',')} <Text style={styles.muted}>({rating.count})</Text>
      </Text>
    </View>
  );
}

// --------------------------------------------------- Состояния экрана ---

export function Banner({
  tone,
  icon,
  title,
  text,
  action,
}: {
  tone: StatusTone;
  icon: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  const c = toneColors[tone];
  return (
    <View style={[styles.banner, { backgroundColor: c.bg }]}>
      <Icon name={icon} size={22} color={c.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.bannerTitle, { color: c.fg }]}>{title}</Text>
        {text ? <Text style={styles.bannerText}>{text}</Text> : null}
        {action ? <View style={{ marginTop: spacing.sm, alignItems: 'flex-start' }}>{action}</View> : null}
      </View>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={36} color={colors.accentDark} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
}

export function LoadingView() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

// ------------------------------------------------------------ Клавиатура ---

/**
 * Не даёт экранной клавиатуре закрыть поля ввода на Android.
 * В режиме «от края до края» Android не сжимает окно под клавиатуру, поэтому обёртка сама получает нижний
 * отступ на высоту перекрытия: список внутри становится ниже и прокручивается к полю, в которое вводят.
 * Перекрытие считается по реальному положению обёртки на экране, так что шапка и нижние вкладки учитываются
 * сами, а если система всё же сжала окно, отступ получается нулевым.
 * На iOS то же делает сам ScrollView — см. keyboardScrollProps.
 */
export function KeyboardAvoider({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', (event) => {
        const keyboardTop = event.endCoordinates.screenY;
        ref.current?.measureInWindow((_x, y, _width, height) => {
          setInset(Math.max(0, Math.round(y + height - keyboardTop)));
        });
      }),
      Keyboard.addListener('keyboardDidHide', () => setInset(0)),
    ];
    return () => subscriptions.forEach((s) => s.remove());
  }, []);

  return (
    <View ref={ref} collapsable={false} style={[styles.keyboardAvoider, style, { paddingBottom: inset }]}>
      {children}
    </View>
  );
}

/**
 * Свойства ScrollView для экранов с полями ввода. На iOS список сам добавляет отступ под клавиатуру
 * и прокручивается к активному полю, а клавиатуру можно убрать, потянув список вниз.
 */
export const keyboardScrollProps = {
  keyboardShouldPersistTaps: 'handled',
  automaticallyAdjustKeyboardInsets: Platform.OS === 'ios',
  keyboardDismissMode: Platform.OS === 'ios' ? 'interactive' : 'none',
} as const;

export function ScreenScroll({
  children,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
}) {
  return (
    <KeyboardAvoider>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={[styles.scrollContent, contentStyle]}
        {...keyboardScrollProps}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.accent} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </KeyboardAvoider>
  );
}

export function KeyValue({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <Icon name={icon} size={18} color={colors.textMuted} />
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  muted: { ...font.small, color: colors.textMuted },
  button: {
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  buttonCompact: { minHeight: 40, paddingHorizontal: spacing.lg, borderRadius: 20 },
  buttonText: { fontFamily: family.semibold, fontSize: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionTitleText: { ...font.h3, color: colors.text },
  label: { ...font.caption, color: colors.textSecondary },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
    backgroundColor: colors.surfaceAlt,
  },
  input: {
    flex: 1,
    minWidth: 0,
    ...font.body,
    color: colors.text,
    paddingVertical: spacing.md,
    outlineStyle: 'none',
  } as never,
  suffix: { ...font.bodyBold, color: colors.textMuted },
  errorText: { ...font.caption, color: colors.danger },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#E4E4E0',
  },
  chipSelected: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontFamily: family.medium, fontSize: 14, color: colors.text },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  segmentActive: { backgroundColor: colors.surface, ...shadow },
  segmentText: { fontFamily: family.semibold, fontSize: 14, color: colors.textSecondary },
  segmentBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  segmentBadgeText: { color: colors.onAccent, fontSize: 11, fontFamily: family.bold },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  badgeText: { fontFamily: family.semibold, fontSize: 12 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontFamily: family.bold },
  ratingText: { fontFamily: family.semibold, fontSize: 13, color: colors.text },
  banner: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'flex-start',
  },
  bannerTitle: { ...font.bodyBold },
  bannerText: { ...font.small, color: colors.textSecondary, lineHeight: 19 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { ...font.h3, color: colors.text, textAlign: 'center' },
  emptyText: { ...font.small, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 40 },
  keyboardAvoider: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  kv: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kvLabel: { ...font.small, color: colors.textSecondary, flex: 1 },
  kvValue: { ...font.bodyBold, color: colors.text, maxWidth: '60%' },
});
