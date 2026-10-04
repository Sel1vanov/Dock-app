import React, { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { CustomInput } from '../ui/CustomInput';
import { CustomButton } from '../ui/CustomButton';
import { AuthService } from '../../services/AuthService';
import { useRouter } from 'expo-router';

const authService = new AuthService();

export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

const router = useRouter();

const handleRegister = async () => {
  if (password !== confirmPassword) {
    Alert.alert('Ошибка', 'Пароли не совпадают');
    return;
  }

  try {
    setLoading(true);
    await authService.signUpWithEmail(email, password);
    Alert.alert('Успех', 'Регистрация прошла успешно!', [
      { text: 'OK', onPress: () => router.replace('/home') }
    ]);
  } catch (error: any) {
    Alert.alert('Ошибка регистрации', error.message);
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
        keyboardType="email-address"
      />

      <CustomInput
        label="Пароль"
        placeholder="Придумайте пароль"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <CustomInput
        label="Повторите пароль"
        placeholder="Повторите пароль"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      {loading ? (
        <ActivityIndicator color="#2563EB" style={{ marginTop: 12 }} />
      ) : (
        <CustomButton title="Зарегистрироваться" onPress={handleRegister} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: { width: '100%' },
});