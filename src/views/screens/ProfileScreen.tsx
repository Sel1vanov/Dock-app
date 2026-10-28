import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ROLE_LABELS, vehicleTypeInfo, verificationInfo } from '../../models/catalog';
import { useProfileViewModel } from '../../viewmodels/ProfileViewModels';
import { GradientHeader } from '../components/order';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  Icon,
  KeyValue,
  RatingLabel,
  ScreenScroll,
  SectionTitle,
} from '../components/ui';
import { colors, font, formatNumber, spacing } from '../theme';

export function ProfileScreen() {
  const vm = useProfileViewModel();
  const { user } = vm;
  const verification = verificationInfo(user.verification);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GradientHeader subtitle={ROLE_LABELS[user.role]} title="Профиль" />
      <ScreenScroll refreshing={vm.isRefreshing} onRefresh={vm.refresh}>
        <Card>
          <View style={styles.person}>
            <Avatar name={user.fullName} size={60} color={colors.accent} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={font.h2}>{user.fullName}</Text>
              {vm.isAdmin ? (
                <Badge label="Администратор" tone="progress" icon="shield-account" />
              ) : (
                <RatingLabel rating={vm.rating} />
              )}
            </View>
            <Button title="" icon="pencil" variant="ghost" compact onPress={vm.editProfile} />
          </View>
          <KeyValue icon="email-outline" label="Email" value={user.email} />
          <KeyValue icon="phone" label="Телефон" value={user.phone} />
        </Card>

        {vm.isDriver ? (
          <>
            <SectionTitle title="Верификация" />
            <Banner
              tone={verification.tone}
              icon={verification.icon}
              title={verification.label}
              text={
                user.verification === 'verified'
                  ? 'Вам доступны отклики на заявки.'
                  : user.verification === 'pending'
                    ? 'Администратор проверяет паспорт, ВУ и СТС.'
                    : user.verification === 'rejected'
                      ? 'Загрузите документы заново и отправьте на проверку.'
                      : 'Загрузите документы, чтобы откликаться на заявки.'
              }
              action={
                user.verification === 'none' || user.verification === 'rejected' ? (
                  <Button
                    title="Пройти верификацию"
                    compact
                    icon="card-account-details"
                    onPress={vm.openVerification}
                  />
                ) : undefined
              }
            />

            <SectionTitle
              title="Мой транспорт"
              action={<Button title="Добавить" icon="plus-circle" variant="ghost" compact onPress={vm.addVehicle} />}
            />
            {vm.vehiclesError ? (
              <Banner
                tone="danger"
                icon="alert-circle"
                title="Не удалось загрузить транспорт"
                text={vm.vehiclesError}
              />
            ) : null}
            {vm.vehicles.length === 0 && !vm.isLoading && !vm.vehiclesError ? (
              <Card>
                <Text style={styles.meta}>
                  Добавьте ТС — по его габаритам и типам грузов фильтруется лента заказов.
                </Text>
              </Card>
            ) : null}
            {vm.vehicles.map((v) => {
              const info = vehicleTypeInfo(v.type);
              return (
                <Card key={v.id} onPress={() => vm.editVehicle(v.id)}>
                  <View style={styles.person}>
                    <View style={styles.vehicleIcon}>
                      <Icon name={info.icon} size={26} color={colors.navy700} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={font.h3}>{v.model || info.label}</Text>
                      <Text style={styles.meta}>
                        {info.label} · до {formatNumber(v.weightT)} т
                      </Text>
                      <Text style={styles.meta}>
                        Платформа {formatNumber(v.lengthM)}×{formatNumber(v.widthM)} м, высота груза до{' '}
                        {formatNumber(v.heightM)} м
                      </Text>
                      <Text style={styles.meta} numberOfLines={2}>
                        Грузы: {v.cargoTypes.map((c) => c.name.toLowerCase()).join(', ')}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => vm.removeVehicle(v.id)}
                      hitSlop={8}
                      accessibilityLabel="Удалить ТС"
                      style={styles.trash}
                    >
                      <Icon name="trash-can-outline" size={20} color={colors.danger} />
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </>
        ) : vm.isAdmin ? (
          <Card>
            <Badge label="Модерация" tone="progress" icon="shield-check" />
            <Text style={styles.meta}>
              Проверяйте документы водителей и блокируйте нарушителей на вкладке «Модерация».
            </Text>
          </Card>
        ) : (
          <Card>
            <Badge label="Безопасная сделка" tone="success" icon="cash-lock" />
            <Text style={styles.meta}>
              Оплата замораживается при старте рейса и переводится водителю только после вашей приёмки груза.
            </Text>
          </Card>
        )}

        <Button
          title="Выйти"
          variant="secondary"
          icon="logout"
          onPress={vm.signOut}
          style={{ marginTop: spacing.md }}
        />
        <Text style={styles.version}>Dock · версия 1.0</Text>
      </ScreenScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meta: { ...font.small, color: colors.textSecondary },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trash: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  version: { ...font.caption, color: colors.textMuted, textAlign: 'center' },
});
