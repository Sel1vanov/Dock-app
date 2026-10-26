import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { useCurrentUser } from '../../viewmodels/AuthViewModel';
import { Icon } from '../../views/components/ui';
import { colors } from '../../views/theme';

const tabIcon =
  (name: string) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Icon name={name} color={color} size={size} />;

/** Вкладки зависят от роли: заказчик и водитель видят разные разделы. */
export default function TabsLayout() {
  const user = useCurrentUser();
  const isDriver = user.role === 'Driver';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.surface },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Protected guard={!isDriver}>
        <Tabs.Screen name="orders" options={{ title: 'Мои заявки', tabBarIcon: tabIcon('clipboard-list') }} />
        <Tabs.Screen name="create" options={{ title: 'Создать', tabBarIcon: tabIcon('plus-circle') }} />
      </Tabs.Protected>
      <Tabs.Protected guard={isDriver}>
        <Tabs.Screen name="feed" options={{ title: 'Поиск грузов', tabBarIcon: tabIcon('magnify') }} />
        <Tabs.Screen name="trips" options={{ title: 'Мои рейсы', tabBarIcon: tabIcon('truck-fast') }} />
      </Tabs.Protected>
      <Tabs.Screen name="profile" options={{ title: 'Профиль', tabBarIcon: tabIcon('account-circle') }} />
    </Tabs>
  );
}
