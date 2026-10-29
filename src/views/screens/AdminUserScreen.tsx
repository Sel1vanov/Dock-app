import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { formatPhone } from '../../core/phone';
import { ROLE_LABELS, vehicleTypeInfo, verificationInfo } from '../../models/catalog';
import { VERIFICATION_DOCS } from '../../services/ProfileService';
import { useAdminUserViewModel } from '../../viewmodels/AdminViewModels';
import { PhotoViewer } from '../components/order';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Icon,
  KeyValue,
  LoadingView,
  RatingLabel,
  ScreenScroll,
  SectionTitle,
} from '../components/ui';
import { colors, font, formatDateTime, formatNumber, radius, spacing } from '../theme';

/** Карточка пользователя для администратора: документы, транспорт, решение по проверке, блокировка. */
export function AdminUserScreen({ userId }: { userId: string }) {
  const vm = useAdminUserViewModel(userId);
  const [opened, setOpened] = useState<string | null>(null);
  const user = vm.user;

  if (vm.query.isLoading) return <LoadingView />;
  if (!user)
    return <EmptyState icon="alert-circle" title="Пользователь недоступен" text={vm.query.error ?? undefined} />;

  const v = verificationInfo(user.verification);
  return (
    <ScreenScroll refreshing={vm.query.isRefreshing} onRefresh={vm.query.refresh}>
      <Card>
        <View style={styles.row}>
          <Avatar name={user.fullName} size={56} color={colors.text} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={font.h2}>{user.fullName}</Text>
            <Text style={styles.meta}>{ROLE_LABELS[user.role]}</Text>
            <RatingLabel rating={user.rating} />
          </View>
        </View>
        <KeyValue icon="email-outline" label="Email" value={user.email} />
        <KeyValue icon="phone" label="Телефон" value={formatPhone(user.phone)} />
        <KeyValue icon="calendar" label="Регистрация" value={formatDateTime(user.createdAt)} />
        <View style={styles.badges}>
          {user.role === 'Driver' ? <Badge label={v.label} tone={v.tone} icon={v.icon} /> : null}
          {user.isBlocked ? <Badge label="Заблокирован" tone="danger" icon="account-lock" /> : null}
        </View>
      </Card>

      {user.role === 'Driver' ? (
        <>
          <SectionTitle title="Документы" />
          {user.documents.length === 0 ? (
            <Card>
              <Text style={styles.meta}>Водитель ещё не загрузил документы.</Text>
            </Card>
          ) : (
            <View style={styles.docs}>
              {VERIFICATION_DOCS.map((d) => {
                const doc = user.documents.find((x) => x.docType === d.key);
                return (
                  <Pressable key={d.key} style={styles.doc} onPress={() => doc && setOpened(doc.url)}>
                    {doc ? (
                      <Image source={{ uri: doc.url }} style={styles.docImage} />
                    ) : (
                      <View style={[styles.docImage, styles.docStub]}>
                        <Icon name="file-hidden" color={colors.textMuted} />
                      </View>
                    )}
                    <Text style={styles.meta} numberOfLines={1}>
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {user.verification === 'pending' ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Отклонить" variant="danger" onPress={vm.reject} disabled={vm.busy} style={{ flex: 1 }} />
              <Button
                title="Подтвердить"
                variant="success"
                icon="shield-check"
                onPress={vm.approve}
                loading={vm.busy}
                style={{ flex: 2 }}
              />
            </View>
          ) : null}

          <SectionTitle title={`Транспорт · ${user.vehicles.length}`} />
          {user.vehicles.map((vehicle) => (
            <Card key={vehicle.id}>
              <Text style={font.h3}>{vehicle.model || vehicleTypeInfo(vehicle.type).label}</Text>
              <Text style={styles.meta}>
                {vehicleTypeInfo(vehicle.type).label} · до {formatNumber(vehicle.weightT)} т ·{' '}
                {formatNumber(vehicle.lengthM)}×{formatNumber(vehicle.widthM)}×{formatNumber(vehicle.heightM)} м
              </Text>
            </Card>
          ))}
        </>
      ) : null}

      {user.role !== 'Admin' ? (
        <Banner
          tone="info"
          icon="lock-reset"
          title="Временный пароль"
          text={
            vm.temporaryPassword
              ? `Новый пароль: ${vm.temporaryPassword}\nСообщите его по телефону ${formatPhone(user.phone)}. Пользователь сменит его в профиле.`
              : 'Если пользователь забыл пароль, выдайте временный и сообщите его по телефону.'
          }
          action={
            vm.temporaryPassword ? undefined : (
              <Button
                title="Выдать временный пароль"
                variant="secondary"
                compact
                icon="key-variant"
                onPress={vm.issueTemporaryPassword}
                disabled={vm.busy}
              />
            )
          }
        />
      ) : null}

      {user.role !== 'Admin' ? (
        user.isBlocked ? (
          <Banner
            tone="danger"
            icon="account-lock"
            title="Пользователь заблокирован"
            text="Вход и все действия в приложении запрещены."
            action={
              <Button
                title="Разблокировать"
                variant="secondary"
                compact
                icon="lock-open-variant"
                onPress={vm.toggleBlock}
                disabled={vm.busy}
              />
            }
          />
        ) : (
          <Banner
            tone="muted"
            icon="account-check"
            title="Доступ открыт"
            text="После блокировки пользователь не сможет войти и пользоваться приложением."
            action={
              <Button
                title="Заблокировать"
                variant="danger"
                compact
                icon="lock"
                onPress={vm.toggleBlock}
                disabled={vm.busy}
              />
            }
          />
        )
      ) : null}

      <PhotoViewer url={opened} onClose={() => setOpened(null)} />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meta: { ...font.small, color: colors.textSecondary },
  badges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  docs: { flexDirection: 'row', gap: spacing.sm },
  doc: { flex: 1, gap: 4 },
  docImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  docStub: { alignItems: 'center', justifyContent: 'center' },
});
