import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../supabase';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Слушаем изменения состояния авторизации в Supabase
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const inHome = segments[0] === 'home';

      if (session && !inHome) {
        // Если пользователь авторизован, отправляем на /home
        router.replace('/home');
      } else if (!session && inHome) {
        // Если сессии нет, отправляем на экран входа /
        router.replace('/');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}