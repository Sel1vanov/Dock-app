import { formatPhoneInput } from '../../core/phone';
import { useProfileEditViewModel } from '../../viewmodels/ProfileViewModels';
import { Banner, Button, Card, ScreenScroll, TextField } from '../components/ui';

/** Изменение имени и телефона. Email и роль меняются только администратором. */
export function ProfileEditScreen() {
  const vm = useProfileEditViewModel();
  return (
    <ScreenScroll>
      <Card>
        <TextField
          label="Имя и фамилия"
          icon="account-outline"
          value={vm.values.fullName}
          onChangeText={(t) => vm.setField('fullName', t)}
          error={vm.errors.fullName}
          maxLength={100}
        />
        <TextField
          label="Телефон"
          icon="phone"
          placeholder="+7 (999) 111-22-33"
          keyboardType="phone-pad"
          autoComplete="tel"
          value={vm.values.phone}
          onChangeText={(t) => vm.setField('phone', formatPhoneInput(t))}
          error={vm.errors.phone}
        />
      </Card>
      {vm.submitError ? (
        <Banner tone="danger" icon="alert-circle" title="Не удалось сохранить" text={vm.submitError} />
      ) : null}
      <Button title="Сохранить" icon="check-circle" onPress={vm.submit} loading={vm.isSubmitting} />
    </ScreenScroll>
  );
}
