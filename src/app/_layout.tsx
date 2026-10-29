import { Onest_400Regular } from '@expo-google-fonts/onest/400Regular';
import { Onest_500Medium } from '@expo-google-fonts/onest/500Medium';
import { Onest_600SemiBold } from '@expo-google-fonts/onest/600SemiBold';
import { Onest_700Bold } from '@expo-google-fonts/onest/700Bold';
import { Onest_800ExtraBold } from '@expo-google-fonts/onest/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../viewmodels/AuthViewModel';
import { NotificationsProvider } from '../viewmodels/NotificationsViewModel';
import { ToastHost } from '../views/components/ToastHost';
import { LoadingView } from '../views/components/ui';
import { colors, family } from '../views/theme';

function RootNavigator() {
  const { currentUser, isInitializing } = useAuth();
  if (isInitializing) return <LoadingView />;
  const isSignedIn = Boolean(currentUser);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: family.semibold, fontSize: 17 },
        headerBackTitle: 'Назад',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="order/[id]" options={{ title: 'Заявка' }} />
        <Stack.Screen name="order/edit/[id]" options={{ title: 'Изменить заявку' }} />
        <Stack.Screen name="tracking/[id]" options={{ title: 'Рейс' }} />
        <Stack.Screen name="vehicle/new" options={{ title: 'Новое ТС', presentation: 'modal' }} />
        <Stack.Screen name="vehicle/[id]" options={{ title: 'Транспорт' }} />
        <Stack.Screen name="verification" options={{ title: 'Верификация' }} />
        <Stack.Screen name="profile-edit" options={{ title: 'Мои данные' }} />
        <Stack.Screen name="password" options={{ title: 'Смена пароля' }} />
        <Stack.Screen name="reviews" options={{ title: 'Отзывы обо мне' }} />
        <Stack.Screen name="notifications" options={{ title: 'Уведомления' }} />
        <Stack.Screen name="admin/user/[id]" options={{ title: 'Пользователь' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // Шрифт Onest: пять начертаний, каждое — отдельное семейство (см. family в views/theme.ts).
  const [fontsLoaded, fontError] = useFonts({
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    Onest_700Bold,
    Onest_800ExtraBold,
  });
  if (!fontsLoaded && !fontError) return <LoadingView />;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationsProvider>
          <StatusBar style="dark" />
          <RootNavigator />
          <ToastHost />
        </NotificationsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
