import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPhone } from '../../core/phone';
import { ROLE_LABELS, vehicleTypeInfo, verificationInfo } from '../../models/catalog';
import { useProfileViewModel } from '../../viewmodels/ProfileViewModels';
import { ReviewCard, ScreenHeader } from '../components/order';
import { Avatar, Badge, Banner, Button, Card, Icon, ScreenScroll, SectionTitle } from '../components/ui';
import { colors, family, font, formatNumber, plural, radius, spacing } from '../theme';

export function ProfileScreen() {
  const vm = useProfileViewModel();
  const { user } = vm;
  const verification = verificationInfo(user.verification);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Профиль" />
      <ScreenScroll refreshing={vm.isRefreshing} onRefresh={vm.refresh}>
        <View style={styles.person}>
          <Avatar name={user.fullName} size={72} color={colors.accent} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={font.h2}>{user.fullName}</Text>
            <Text style={styles.meta}>
              {ROLE_LABELS[user.role]} · {formatPhone(user.phone)}
            </Text>
            {vm.isDriver ? (
              <Badge label={verification.label} tone={verification.tone} icon={verification.icon} />
            ) : null}
          </View>
        </View>

        {vm.isAdmin ? null : (
          <View style={styles.stats}>
            <View style={[styles.stat, styles.statDark]}>
              <Text style={[styles.statValue, { color: colors.white }]}>
                {user.rating ? user.rating.average.toFixed(1).replace('.', ',') : '—'}
              </Text>
              <Text style={[styles.statLabel, { color: '#C9C9C4' }]}>рейтинг</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{user.rating?.count ?? 0}</Text>
              <Text style={styles.statLabel}>{plural(user.rating?.count ?? 0, 'отзыв', 'отзыва', 'отзывов')}</Text>
            </View>
            {vm.isDriver ? (
              <View style={styles.stat}>
                <Text style={styles.statValue}>{vm.vehicles.length}</Text>
                <Text style={styles.statLabel}>ТС</Text>
              </View>
            ) : null}
          </View>
        )}

        {vm.latestReview ? (
          <Pressable onPress={vm.openReviews} accessibilityRole="button" accessibilityLabel="Все отзывы обо мне">
            <ReviewCard review={vm.latestReview} roleLabel={ROLE_LABELS[vm.latestReview.authorRole]} />
          </Pressable>
        ) : null}

        {vm.isDriver ? (
          <>
            {user.verification !== 'verified' ? (
              <Banner
                tone={verification.tone}
                icon={verification.icon}
                title={verification.label}
                text={
                  user.verification === 'pending'
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
            ) : null}

            <SectionTitle
              title="Транспорт"
              action={<Button title="Добавить" icon="plus" variant="ghost" compact onPress={vm.addVehicle} />}
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
                  <View style={styles.row}>
                    <View style={styles.vehicleIcon}>
                      <Icon name={info.icon} size={26} color={colors.accentDark} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={font.h3}>{v.model || info.label}</Text>
                      <Text style={styles.meta}>
                        {info.label} · до {formatNumber(v.weightT)} т · {formatNumber(v.lengthM)}×
                        {formatNumber(v.widthM)}×{formatNumber(v.heightM)} м
                      </Text>
                      <Text style={styles.meta} numberOfLines={2}>
                        Грузы: {v.cargoTypes.map((c) => c.name.toLowerCase()).join(', ')}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => vm.removeVehicle(v.id)}
                      hitSlop={8}
                      accessibilityRole="button"
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
              Проверяйте документы водителей, блокируйте нарушителей и выдавайте временные пароли на вкладке
              «Модерация».
            </Text>
          </Card>
        ) : (
          <Card>
            <Badge label="Безопасная сделка" tone="success" icon="cash-lock" />
            <Text style={styles.meta}>
              Оплата замораживается до начала рейса и переводится водителю только после вашей приёмки груза.
            </Text>
          </Card>
        )}

        <View style={styles.menu}>
          <MenuItem icon="account-edit-outline" label="Мои данные" onPress={vm.editProfile} />
          <MenuItem icon="lock-outline" label="Сменить пароль" onPress={vm.changePassword} />
          {vm.isAdmin ? null : (
            <MenuItem
              icon="star-outline"
              label={vm.reviewsTotal > 0 ? `Отзывы обо мне · ${vm.reviewsTotal}` : 'Отзывы обо мне'}
              onPress={vm.openReviews}
            />
          )}
          {vm.isDriver ? (
            <MenuItem icon="file-document-outline" label="Документы" onPress={vm.openVerification} />
          ) : null}
          <MenuItem icon="logout" label="Выйти" onPress={vm.signOut} danger last />
        </View>
        <Text style={styles.version}>Dock · версия 1.0</Text>
      </ScreenScroll>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger,
  last,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const color = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.menuItem, !last && styles.menuDivider, pressed && { opacity: 0.7 }]}
    >
      <Icon name={icon} size={22} color={color} />
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
      {danger ? null : <Icon name="chevron-right" size={20} color={colors.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meta: { ...font.small, color: colors.textSecondary },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, padding: 14, gap: 2 },
  statDark: { backgroundColor: colors.text },
  statValue: { fontFamily: family.bold, fontSize: 24, letterSpacing: -0.6, color: colors.text },
  statLabel: { ...font.caption, color: colors.textSecondary },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
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
  menu: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 15 },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  menuLabel: { ...font.bodyBold, flex: 1 },
  version: { ...font.caption, color: colors.textMuted, textAlign: 'center' },
});
