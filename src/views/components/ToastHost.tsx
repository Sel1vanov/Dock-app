/** Показывает уведомления из core/toast поверх всех экранов на 2,5 секунды. */
import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { subscribeToasts, type ToastMessage } from '../../core/toast';
import { colors, font, radius, shadow, spacing } from '../theme';
import { Icon } from './ui';

const useNativeDriver = Platform.OS !== 'web';

const TONES = {
  success: { bg: colors.success, icon: 'check-circle' },
  info: { bg: colors.navy700, icon: 'information' },
  danger: { bg: colors.danger, icon: 'alert-circle' },
} as const;

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(
    () =>
      subscribeToasts((next) => {
        setToast(next);
        opacity.setValue(0);
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver }),
          Animated.delay(2500),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver }),
        ]).start(({ finished }) => {
          if (finished) setToast((current) => (current?.id === next.id ? null : current));
        });
      }),
    [opacity],
  );

  if (!toast) return null;
  const tone = TONES[toast.tone];
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { top: insets.top + spacing.md, backgroundColor: tone.bg, opacity }]}
    >
      <Icon name={tone.icon} size={20} color={colors.white} />
      <Text style={styles.text}>{toast.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    maxWidth: 520,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    zIndex: 1000,
    ...shadow,
  },
  text: { ...font.bodyBold, color: colors.white, flex: 1 },
});
