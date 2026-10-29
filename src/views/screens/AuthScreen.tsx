import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthFormViewModel } from '../../viewmodels/AuthViewModel';
import { BrandMark } from '../components/order';
import { Banner, Button, Icon, Segmented, TextField } from '../components/ui';
import { colors, family, font, radius, spacing } from '../theme';

const ROLES = [
  { value: 'Client' as const, title: 'Заказчик', text: 'Нужно перевезти груз', icon: 'package-variant-closed' },
  { value: 'Driver' as const, title: 'Водитель', text: 'Есть трал или манипулятор', icon: 'truck-flatbed' },
];

/** AuthScreen (SAD 5.2): вход, регистрация с выбором роли и «Забыли пароль?». */
export function AuthScreen() {
  const vm = useAuthFormViewModel();
  const insets = useSafeAreaInsets();
  const isSignUp = vm.mode === 'signUp';
  const isReset = vm.mode === 'reset';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <BrandMark size={40} />
          <Text style={styles.title}>Перевозка негабаритных грузов напрямую</Text>
          <Text style={styles.tagline}>Без диспетчеров: водители со спецтехникой сами предлагают цену</Text>
          <View style={styles.features}>
            <Feature icon="handshake-outline" text="Торг" />
            <Feature icon="cash-lock" text="Безопасная сделка" />
            <Feature icon="camera-outline" text="Фотофиксация" />
          </View>
        </View>

        <View style={styles.form}>
          {isReset ? (
            <>
              <Text style={font.h2}>Забыли пароль?</Text>
              <Text style={styles.hint}>
                Укажите email аккаунта. Администратор Dock получит просьбу, позвонит на номер из профиля и сообщит
                временный пароль. Затем смените его в профиле.
              </Text>
            </>
          ) : (
            <Segmented
              options={[
                { value: 'signIn', label: 'Вход' },
                { value: 'signUp', label: 'Регистрация' },
              ]}
              value={vm.mode as 'signIn' | 'signUp'}
              onChange={vm.switchMode}
            />
          )}

          {vm.errorMessage ? <Banner tone="danger" icon="alert-circle" title={vm.errorMessage} /> : null}
          {isReset && vm.resetMessage ? (
            <Banner tone="success" icon="check-circle" title="Просьба отправлена" text={vm.resetMessage} />
          ) : null}

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
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[styles.role, selected && styles.roleSelected]}
                    >
                      <Icon name={r.icon} size={28} color={selected ? colors.accentDark : colors.textSecondary} />
                      <Text style={[styles.roleTitle, selected && { color: colors.text }]}>{r.title}</Text>
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
            onSubmitEditing={isReset ? vm.requestReset : undefined}
          />
          {isReset ? null : (
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
          )}
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

          {isReset ? (
            <>
              <Button title="Отправить просьбу" icon="send" onPress={vm.requestReset} loading={vm.isLoading} />
              <Button title="Вернуться ко входу" variant="ghost" onPress={() => vm.switchMode('signIn')} />
            </>
          ) : (
            <Button
              title={isSignUp ? 'Создать аккаунт' : 'Войти'}
              icon={isSignUp ? 'account-outline' : 'arrow-right'}
              onPress={vm.submit}
              loading={vm.isLoading}
            />
          )}
          {vm.mode === 'signIn' ? (
            <Button title="Забыли пароль?" variant="ghost" compact onPress={() => vm.switchMode('reset')} />
          ) : null}
          {isSignUp && vm.values.role === 'Driver' ? (
            <Text style={styles.hint}>
              После регистрации загрузите документы (паспорт, ВУ, СТС) — администратор проверит их и откроет доступ к
              откликам.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.feature}>
      <Icon name={icon} size={16} color={colors.accentDark} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xl },
  hero: { gap: spacing.md, width: '100%', maxWidth: 520, alignSelf: 'center' },
  title: { fontFamily: family.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.9, color: colors.text },
  tagline: { ...font.body, color: colors.textSecondary, lineHeight: 22 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  featureText: { fontFamily: family.medium, fontSize: 13, color: colors.text },
  form: {
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  label: { ...font.caption, color: colors.textSecondary },
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
  hint: { ...font.small, color: colors.textSecondary, lineHeight: 19 },
});
