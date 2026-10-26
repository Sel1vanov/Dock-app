import { StyleSheet, Text, View } from 'react-native';

import { vehicleTypeInfo } from '../../models/catalog';
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GradientHeader subtitle={vm.isDriver ? 'Водитель / перевозчик' : 'Заказчик'} title="Профиль" />
      <ScreenScroll refreshing={vm.isRefreshing} onRefresh={vm.refresh}>
        <Card>
          <View style={styles.person}>
            <Avatar name={user.fullName} size={60} color={colors.accent} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={font.h2}>{user.fullName}</Text>
              <RatingLabel rating={vm.rating} />
            </View>
          </View>
          <KeyValue icon="email-outline" label="Email" value={user.email} />
          <KeyValue icon="phone" label="Телефон" value={user.phone ?? '—'} />
        </Card>

        {vm.isDriver ? (
          <>
            <SectionTitle title="Верификация" />
            {user.verification === 'verified' ? (
              <Banner
                tone="success"
                icon="shield-check"
                title="Документы подтверждены"
                text="Вам доступны отклики на заявки."
              />
            ) : user.verification === 'pending' ? (
              <Banner
                tone="info"
                icon="clock-outline"
                title="На проверке"
                text="Администратор проверяет паспорт, ВУ и СТС."
              />
            ) : (
              <Banner
                tone="warning"
                icon="shield-alert"
                title="Не пройдена"
                text="Загрузите документы, чтобы откликаться на заявки."
                action={
                  <Button
                    title="Пройти верификацию"
                    compact
                    icon="card-account-details"
                    onPress={vm.openVerification}
                  />
                }
              />
            )}

            <SectionTitle
              title="Мой транспорт"
              action={<Button title="Добавить" icon="plus-circle" variant="ghost" compact onPress={vm.addVehicle} />}
            />
            {vm.vehicles.length === 0 ? (
              <Card>
                <Text style={styles.meta}>Добавьте ТС — по его габаритам фильтруется лента заказов.</Text>
              </Card>
            ) : null}
            {vm.vehicles.map((v) => {
              const info = vehicleTypeInfo(v.type);
              return (
                <Card key={v.id}>
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
                    </View>
                    <Button
                      title=""
                      icon="trash-can-outline"
                      variant="ghost"
                      compact
                      onPress={() => vm.removeVehicle(v.id)}
                    />
                  </View>
                </Card>
              );
            })}
          </>
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
        <Text style={styles.version}>Dock · промежуточная версия 0.6</Text>
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
  version: { ...font.caption, color: colors.textMuted, textAlign: 'center' },
});
