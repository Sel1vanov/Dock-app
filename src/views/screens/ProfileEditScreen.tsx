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
          keyboardType="phone-pad"
          value={vm.values.phone}
          onChangeText={(t) => vm.setField('phone', t)}
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
