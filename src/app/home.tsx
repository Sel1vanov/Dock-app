import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../supabase';

export default function HomeScreen() {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/'); // Возвращаем на экран входа
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Главный экран (Dock)</Text>
      <Text style={styles.subtitle}>Вы успешно вошли в систему!</Text>

      <Button title="Выйти из аккаунта" onPress={handleSignOut} color="#EF4444" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
  },
});