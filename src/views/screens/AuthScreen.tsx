import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthFormViewModel } from '../../viewmodels/AuthViewModel';
import { Banner, Button, Icon, Segmented, TextField } from '../components/ui';
import { colors, font, radius, shadow, spacing } from '../theme';

const ROLES = [
  { value: 'Client' as const, title: 'Заказчик', text: 'Нужно перевезти груз', icon: 'package-variant-closed' },
  { value: 'Driver' as const, title: 'Водитель', text: 'Есть трал или манипулятор', icon: 'truck-flatbed' },
];

/** AuthScreen (SAD 5.2): вход и регистрация с выбором роли. */
export function AuthScreen() {
  const vm = useAuthFormViewModel();
  const insets = useSafeAreaInsets();
  const isSignUp = vm.mode === 'signUp';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <LinearGradient
          colors={[colors.navy900, colors.navy600]}
          style={[styles.hero, { paddingTop: insets.top + 36 }]}
        >
          <View style={styles.logo}>
            <Icon name="truck-flatbed" size={34} color={colors.white} />
          </View>
          <Text style={styles.brand}>Dock</Text>
          <Text style={styles.tagline}>Перевозка негабаритных грузов{'\n'}напрямую — без диспетчеров</Text>
          <View style={styles.features}>
            <Feature icon="handshake" text="Торг" />
            <Feature icon="cash-lock" text="Безопасная сделка" />
            <Feature icon="camera" text="Фотофиксация" />
          </View>
        </LinearGradient>

        <View style={styles.formWrap}>
          <View style={styles.form}>
            <Segmented
              options={[
                { value: 'signIn', label: 'Вход' },
                { value: 'signUp', label: 'Регистрация' },
              ]}
              value={vm.mode}
              onChange={vm.switchMode}
            />

            {vm.errorMessage ? <Banner tone="danger" icon="alert-circle" title={vm.errorMessage} /> : null}

            {isSignUp && (
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.label}>Я —</Text>
                <View style={styles.roles}>
                  {ROLES.map((r) => {
                    const selected = vm.values.role === r.value;
                    return (
                      <Pressable
                        key={r.value}
                        onPress={() => vm.setField('role', r.value)}
                        style={[styles.role, selected && styles.roleSelected]}
                      >
                        <Icon name={r.icon} size={28} color={selected ? colors.accent : colors.navy600} />
                        <Text style={[styles.roleTitle, selected && { color: colors.navy900 }]}>{r.title}</Text>
                        <Text style={styles.roleText}>{r.text}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {isSignUp && (
              <TextField
                label="Имя и фамилия"
                icon="account-outline"
                placeholder="Иван Иванов"
                value={vm.values.fullName}
                onChangeText={(t) => vm.setField('fullName', t)}
                error={vm.fieldErrors.fullName}
              />
            )}
            {isSignUp && (
              <TextField
                label="Телефон"
                icon="phone"
                placeholder="+7 999 111-22-33"
                keyboardType="phone-pad"
                value={vm.values.phone}
                onChangeText={(t) => vm.setField('phone', t)}
                error={vm.fieldErrors.phone}
              />
            )}
            <TextField
              label="Email"
              icon="email-outline"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={vm.values.email}
              onChangeText={(t) => vm.setField('email', t)}
              error={vm.fieldErrors.email}
            />
            <TextField
              label="Пароль"
              icon="lock-outline"
              placeholder={isSignUp ? 'Минимум 8 символов, буквы и цифры' : 'Ваш пароль'}
              secureTextEntry
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={vm.values.password}
              onChangeText={(t) => vm.setField('password', t)}
              error={vm.fieldErrors.password}
              onSubmitEditing={isSignUp ? undefined : vm.submit}
              maxLength={72}
            />
            {isSignUp && (
              <TextField
                label="Повторите пароль"
                icon="lock-check-outline"
                placeholder="Ещё раз пароль"
                secureTextEntry
                autoComplete="new-password"
                value={vm.values.passwordConfirm}
                onChangeText={(t) => vm.setField('passwordConfirm', t)}
                error={vm.fieldErrors.passwordConfirm}
                onSubmitEditing={vm.submit}
                maxLength={72}
              />
            )}

            <Button
              title={isSignUp ? 'Создать аккаунт' : 'Войти'}
              icon={isSignUp ? 'account-outline' : 'arrow-right'}
              onPress={vm.submit}
              loading={vm.isLoading}
            />
            {isSignUp && vm.values.role === 'Driver' ? (
              <Text style={styles.hint}>
                После регистрации загрузите документы (паспорт, ВУ, СТС) — администратор проверит их и откроет доступ к
                откликам.
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.feature}>
      <Icon name={icon} size={16} color={colors.accent} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 48,
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logo: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  brand: { fontSize: 38, fontWeight: '900', color: colors.white, letterSpacing: -1 },
  tagline: { ...font.body, color: '#C5D1EC', textAlign: 'center', lineHeight: 22 },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  featureText: { ...font.caption, color: colors.white },
  formWrap: { paddingHorizontal: spacing.lg, marginTop: -28, marginBottom: spacing.xxl },
  form: {
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    ...shadow,
  },
  label: { ...font.caption, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  roles: { flexDirection: 'row', gap: spacing.md },
  role: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    gap: 4,
  },
  roleSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  roleTitle: { ...font.h3, color: colors.textSecondary },
  roleText: { ...font.caption, color: colors.textSecondary },
  hint: { ...font.small, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
});
