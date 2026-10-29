import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useUnreadCount } from '../../viewmodels/NotificationsViewModel';
import { colors, family } from '../theme';
import { Icon } from './ui';

/** Колокольчик в шапке: число непрочитанных уведомлений, нажатие — экран уведомлений. */
export function NotificationBell() {
  const { unreadCount } = useUnreadCount();
  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `Уведомления, непрочитанных: ${unreadCount}` : 'Уведомления'}
      style={({ pressed }) => [styles.bell, pressed && { opacity: 0.8 }]}
    >
      <Icon name="bell-outline" size={22} color={colors.text} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.onAccent, fontSize: 10, fontFamily: family.bold },
});
