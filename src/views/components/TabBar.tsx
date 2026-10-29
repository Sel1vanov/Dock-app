import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, family, spacing } from '../theme';

/**
 * Нижняя навигация — тёмная «капсула»: активная вкладка подсвечена оранжевым и подписана,
 * остальные — только иконкой (подпись озвучивается программой экранного доступа).
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.capsule} role="tablist">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = index === state.index;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const icon = options.tabBarIcon?.({ focused, color: focused ? colors.onAccent : colors.white, size: 22 });
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={({ pressed }) => [styles.tab, focused && styles.tabActive, pressed && { opacity: 0.85 }]}
            >
              {icon}
              {focused ? <Text style={styles.label}>{label}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: spacing.sm, backgroundColor: colors.bg },
  capsule: {
    flexDirection: 'row',
    gap: 4,
    padding: 6,
    borderRadius: 32,
    backgroundColor: colors.text,
    shadowColor: '#111111',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  tab: {
    minWidth: 56,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tabActive: { backgroundColor: colors.accent, paddingHorizontal: 18 },
  label: { fontFamily: family.semibold, fontSize: 14, color: colors.onAccent },
});
