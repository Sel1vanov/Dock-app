import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { useCurrentUser } from '../../viewmodels/AuthViewModel';
import { TabBar } from '../../views/components/TabBar';
import { Icon } from '../../views/components/ui';
import { colors } from '../../views/theme';

function tabIcon(name: string) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon name={name} color={color} size={size} />;
  }
  return TabIcon;
}

/** Вкладки зависят от роли: заказчик, водитель и администратор видят разные разделы. */
export default function TabsLayout() {
  const user = useCurrentUser();
  const isDriver = user.role === 'Driver';
  const isClient = user.role === 'Client';
  const isAdmin = user.role === 'Admin';

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Protected guard={isClient}>
        <Tabs.Screen name="orders" options={{ title: 'Заявки', tabBarIcon: tabIcon('clipboard-list-outline') }} />
        <Tabs.Screen name="create" options={{ title: 'Создать', tabBarIcon: tabIcon('plus') }} />
      </Tabs.Protected>
      <Tabs.Protected guard={isDriver}>
        <Tabs.Screen name="feed" options={{ title: 'Грузы', tabBarIcon: tabIcon('magnify') }} />
        <Tabs.Screen name="trips" options={{ title: 'Рейсы', tabBarIcon: tabIcon('truck-outline') }} />
      </Tabs.Protected>
      <Tabs.Protected guard={isAdmin}>
        <Tabs.Screen name="moderation" options={{ title: 'Модерация', tabBarIcon: tabIcon('shield-check-outline') }} />
      </Tabs.Protected>
      <Tabs.Screen name="profile" options={{ title: 'Профиль', tabBarIcon: tabIcon('account-outline') }} />
    </Tabs>
  );
}
