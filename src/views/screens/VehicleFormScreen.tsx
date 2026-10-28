import { StyleSheet, Text, View } from 'react-native';

import { CARGO_TYPES, VEHICLE_TYPES } from '../../models/catalog';
import { useVehicleFormViewModel } from '../../viewmodels/ProfileViewModels';
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  LoadingView,
  ScreenScroll,
  SectionTitle,
  TextField,
} from '../components/ui';
import { colors, font, spacing } from '../theme';

/** Добавление и изменение ТС: габаритно-весовые характеристики (Vehicle из SAD) и типы перевозимых грузов. */
export function VehicleFormScreen({ vehicleId }: { vehicleId?: string }) {
  const vm = useVehicleFormViewModel(vehicleId);
  const { values, errors } = vm;

  if (vm.isLoading) return <LoadingView />;
  if (vm.loadError) return <EmptyState icon="alert-circle" title="ТС недоступно" text={vm.loadError} />;

  return (
    <ScreenScroll>
      <SectionTitle title="Тип транспорта" />
      <View style={styles.chips}>
        {VEHICLE_TYPES.map((t) => (
          <Chip
            key={t.value}
            icon={t.icon}
            label={t.label}
            selected={values.type === t.value}
            onPress={() => vm.setType(t.value)}
          />
        ))}
      </View>

      <Card>
        <TextField
          label="Марка, модель или госномер"
          placeholder="МАЗ-5440 + трал ЧМЗАП"
          value={values.model}
          onChangeText={(t) => vm.setField('model', t)}
          error={errors.model}
          maxLength={80}
        />
      </Card>

      <SectionTitle title="Какие грузы возите" />
      <View style={styles.chips}>
        {CARGO_TYPES.map((t) => (
          <Chip
            key={t.value}
            icon={t.icon}
            label={t.label}
            selected={values.cargoTypes.includes(t.value)}
            onPress={() => vm.toggleCargoType(t.value)}
          />
        ))}
      </View>
      {errors.cargoTypes ? <Text style={styles.error}>{errors.cargoTypes}</Text> : null}
      <Text style={styles.note}>Лента покажет только заявки с этими типами груза.</Text>

      <SectionTitle title="Характеристики" />
      <Card>
        <TextField
          label="Грузоподъёмность"
          suffix="т"
          keyboardType="decimal-pad"
          placeholder="20"
          value={values.weightT}
          onChangeText={(t) => vm.setField('weightT', t)}
          error={errors.weightT}
        />
        <View style={styles.grid}>
          <TextField
            style={styles.cell}
            label="Длина платформы"
            suffix="м"
            keyboardType="decimal-pad"
            placeholder="13,6"
            value={values.lengthM}
            onChangeText={(t) => vm.setField('lengthM', t)}
            error={errors.lengthM}
          />
          <TextField
            style={styles.cell}
            label="Ширина"
            suffix="м"
            keyboardType="decimal-pad"
            placeholder="3,0"
            value={values.widthM}
            onChangeText={(t) => vm.setField('widthM', t)}
            error={errors.widthM}
          />
        </View>
        <TextField
          label="Допустимая высота груза"
          suffix="м"
          keyboardType="decimal-pad"
          placeholder="3,2"
          value={values.heightM}
          onChangeText={(t) => vm.setField('heightM', t)}
          error={errors.heightM}
        />
      </Card>

      {vm.submitError ? (
        <Banner tone="danger" icon="alert-circle" title="Не удалось сохранить" text={vm.submitError} />
      ) : null}
      <Button
        title={vm.isEdit ? 'Сохранить изменения' : 'Сохранить ТС'}
        icon="check-circle"
        onPress={vm.submit}
        loading={vm.isSubmitting}
      />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { flexGrow: 1, flexBasis: '45%' },
  error: { ...font.caption, color: colors.danger },
  note: { ...font.small, color: colors.textMuted },
});
