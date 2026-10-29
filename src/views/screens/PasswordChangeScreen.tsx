import { Text } from 'react-native';

import { usePasswordChangeViewModel } from '../../viewmodels/ProfileViewModels';
import { Banner, Button, Card, ScreenScroll, TextField } from '../components/ui';
import { colors, font } from '../theme';

/** Смена пароля по текущему паролю. Остальные устройства после смены выйдут из аккаунта. */
export function PasswordChangeScreen() {
  const vm = usePasswordChangeViewModel();
  return (
    <ScreenScroll>
      <Card>
        <TextField
          label="Текущий пароль"
          icon="lock-outline"
          secureTextEntry
          autoComplete="current-password"
          value={vm.values.currentPassword}
          onChangeText={(t) => vm.setField('currentPassword', t)}
          error={vm.errors.currentPassword}
          maxLength={72}
        />
        <TextField
          label="Новый пароль"
          icon="lock-reset"
          placeholder="Минимум 8 символов, буквы и цифры"
          secureTextEntry
          autoComplete="new-password"
          value={vm.values.newPassword}
          onChangeText={(t) => vm.setField('newPassword', t)}
          error={vm.errors.newPassword}
          maxLength={72}
        />
        <TextField
          label="Повторите новый пароль"
          icon="lock-check-outline"
          secureTextEntry
          autoComplete="new-password"
          value={vm.values.newPasswordConfirm}
          onChangeText={(t) => vm.setField('newPasswordConfirm', t)}
          error={vm.errors.newPasswordConfirm}
          onSubmitEditing={vm.submit}
          maxLength={72}
        />
        <Text style={{ ...font.small, color: colors.textSecondary }}>
          После смены пароля на других устройствах нужно будет войти заново.
        </Text>
      </Card>
      {vm.submitError ? (
        <Banner tone="danger" icon="alert-circle" title="Не удалось сменить пароль" text={vm.submitError} />
      ) : null}
      <Button title="Сменить пароль" icon="check-circle" onPress={vm.submit} loading={vm.isSubmitting} />
    </ScreenScroll>
  );
}
