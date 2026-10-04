import React, { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { CustomInput } from '../ui/CustomInput';
import CustomButton from '../ui/CustomButton';
import { AuthService } from '../../services/AuthService';
import { useRouter } from 'expo-router';

const authService = new AuthService();

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

const router = useRouter();

const handleSubmit = async () => {
  try {
    setLoading(true);
    await authService.signInWithEmail(email, password);
    // Переходим на главный экран
    router.replace('/home');
  } catch (error: any) {
    Alert.alert('Ошибка входа', error.message);
  } finally {
    setLoading(false);
  }
};

  return (
    <View style={styles.formContainer}>
      <CustomInput
        label="Email"
        placeholder="example@mail.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address" // 👈 Специальная клавиатура для Email
      />

      <CustomInput
        label="Пароль"
        placeholder="Введите пароль"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {loading ? (
        <ActivityIndicator color="#2563EB" style={{ marginTop: 12 }} />
      ) : (
        <CustomButton title="Войти" onPress={handleSubmit} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: { width: '100%' },
});