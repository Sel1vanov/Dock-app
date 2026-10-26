import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { CARGO_TYPES } from '../../models/catalog';
import { useOrderCreateViewModel } from '../../viewmodels/OrderViewModels';
import { DimensionTiles, GradientHeader } from '../components/order';
import { Banner, Button, Card, Icon, ScreenScroll, SectionTitle, TextField } from '../components/ui';
import { colors, font, radius, spacing } from '../theme';

/** OrderCreateScreen (SAD 5.2): UC-03 «Создать заявку», UC-04 «Указать габариты и вес», UC-05 «Маршрут». */
export function OrderCreateScreen() {
  const vm = useOrderCreateViewModel();
  const { values, errors } = vm;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <GradientHeader subtitle="Новая заявка" title="Что перевозим?" />
      <ScreenScroll>
        <SectionTitle title="Тип груза" />
        <View style={styles.types}>
          {CARGO_TYPES.map((t) => {
            const selected = values.type === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => vm.setCargoType(t.value)}
                style={[styles.type, selected && styles.typeSelected]}
              >
                <Icon name={t.icon} size={30} color={selected ? colors.accent : colors.navy600} />
                <Text style={[styles.typeText, selected && { color: colors.navy900 }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Card>
          <TextField
            label="Описание"
            placeholder="Например: экскаватор JCB 3CX, без навесного"
            value={values.description}
            onChangeText={(t) => vm.setField('description', t)}
            error={errors.description}
            multiline
          />
        </Card>

        <SectionTitle title="Габариты и вес" />
        <Card>
          <View style={styles.grid}>
            <TextField
              style={styles.cell}
              label="Длина"
              suffix="м"
              keyboardType="decimal-pad"
              placeholder="0,0"
              value={values.lengthM}
              onChangeText={(t) => vm.setField('lengthM', t)}
              error={errors.lengthM}
            />
            <TextField
              style={styles.cell}
              label="Ширина"
              suffix="м"
              keyboardType="decimal-pad"
              placeholder="0,0"
              value={values.widthM}
              onChangeText={(t) => vm.setField('widthM', t)}
              error={errors.widthM}
            />
            <TextField
              style={styles.cell}
              label="Высота"
              suffix="м"
              keyboardType="decimal-pad"
              placeholder="0,0"
              value={values.heightM}
              onChangeText={(t) => vm.setField('heightM', t)}
              error={errors.heightM}
            />
            <TextField
              style={styles.cell}
              label="Масса"
              suffix="т"
              keyboardType="decimal-pad"
              placeholder="0,0"
              value={values.weightT}
              onChangeText={(t) => vm.setField('weightT', t)}
              error={errors.weightT}
            />
          </View>
          {vm.preview.complete ? <DimensionTiles dims={vm.preview.dims} accent /> : null}
          {vm.preview.oversize.length > 0 ? (
            <Banner
              tone="warning"
              icon="shield-alert"
              title="Негабаритный груз"
              text={`${vm.preview.oversize.join(', ')}. Водителю потребуется спецразрешение — заявку увидят только подходящие тралы.`}
            />
          ) : null}
        </Card>

        <SectionTitle title="Маршрут" />
        <Card>
          <TextField
            label="Адрес погрузки (A)"
            icon="map-marker-outline"
            placeholder="Город, улица, дом"
            value={values.origin}
            onChangeText={(t) => vm.setField('origin', t)}
            error={errors.origin}
          />
          <TextField
            label="Адрес выгрузки (Б)"
            icon="map-marker-check"
            placeholder="Город, улица, дом"
            value={values.destination}
            onChangeText={(t) => vm.setField('destination', t)}
            error={errors.destination}
          />
          <Text style={styles.note}>Выбор точек на карте появится на следующем этапе.</Text>
        </Card>

        <SectionTitle title="Начальная цена" />
        <Card>
          <TextField
            suffix="₽"
            keyboardType="number-pad"
            placeholder="45 000"
            value={values.price}
            onChangeText={(t) => vm.setField('price', t)}
            error={errors.price}
          />
          <Text style={styles.note}>Водители смогут согласиться с ценой или предложить свою.</Text>
        </Card>

        {vm.submitError ? (
          <Banner tone="danger" icon="alert-circle" title="Не удалось опубликовать" text={vm.submitError} />
        ) : null}
        <Button title="Опубликовать заявку" icon="check-circle" onPress={vm.submit} loading={vm.isSubmitting} />
      </ScreenScroll>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  type: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  typeSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  typeText: { ...font.caption, color: colors.textSecondary, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { flexGrow: 1, flexBasis: '45%' },
  note: { ...font.small, color: colors.textMuted },
});
