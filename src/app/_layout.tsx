import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../viewmodels/AuthViewModel';
import { LoadingView } from '../views/components/ui';
import { colors } from '../views/theme';

function RootNavigator() {
  const { currentUser, isInitializing } = useAuth();
  if (isInitializing) return <LoadingView />;
  const isSignedIn = Boolean(currentUser);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy900 },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
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
        <Stack.Screen name="tracking/[id]" options={{ title: 'Рейс' }} />
        <Stack.Screen name="vehicle/new" options={{ title: 'Новое ТС', presentation: 'modal' }} />
        <Stack.Screen name="verification" options={{ title: 'Верификация' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
