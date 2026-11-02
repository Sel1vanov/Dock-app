import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ROLE_LABELS, TRIP_STAGE_LABELS, disputeStatusInfo, verificationInfo } from '../../models/catalog';
import {
  type ModerationFilter,
  useDisputeQueueViewModel,
  useModerationViewModel,
} from '../../viewmodels/AdminViewModels';
import { PagedList, SearchBar } from '../components/lists';
import { ScreenHeader } from '../components/order';
import { Avatar, Badge, Banner, Card, Chip, EmptyState, LoadingView, Segmented } from '../components/ui';
import { colors, font, formatPrice, formatRelative, spacing } from '../theme';

const FILTERS: { value: ModerationFilter; label: string; icon: string }[] = [
  { value: 'pending', label: 'На проверке', icon: 'clock-outline' },
  { value: 'drivers', label: 'Водители', icon: 'truck-flatbed' },
  { value: 'clients', label: 'Заказчики', icon: 'package-variant-closed' },
  { value: 'all', label: 'Все', icon: 'account-multiple' },
];

/** Модерация (UC-02, UC-21, UC-22): проверка документов, пользователи, очередь споров. */
export function ModerationScreen() {
  const [section, setSection] = useState<'users' | 'disputes'>('users');
  const users = useModerationViewModel();
  const disputes = useDisputeQueueViewModel();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Модерация" subtitle="Документы, блокировка, временные пароли, споры">
        <Segmented
          options={[
            { value: 'users', label: 'Пользователи' },
            { value: 'disputes', label: 'Споры', badge: disputes.openCount },
          ]}
          value={section}
          onChange={setSection}
        />
        {section === 'users' ? (
          <SearchBar value={users.search} onChange={users.setSearch} placeholder="Имя или email" />
        ) : null}
      </ScreenHeader>
      {section === 'users' ? <UserList vm={users} /> : <DisputeQueue vm={disputes} />}
    </View>
  );
}

function UserList({ vm }: { vm: ReturnType<typeof useModerationViewModel> }) {
  return (
    <>
      <View style={{ flexGrow: 0, flexShrink: 0 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <Chip
              key={f.value}
              icon={f.icon}
              label={f.label}
              selected={vm.filter === f.value}
              onPress={() => vm.setFilter(f.value)}
            />
          ))}
        </ScrollView>
      </View>

      {vm.isLoading ? (
        <LoadingView />
      ) : (
        <PagedList
          items={vm.items}
          total={vm.total}
          isRefreshing={vm.isRefreshing}
          isLoadingMore={vm.isLoadingMore}
          hasMore={vm.hasMore}
          onRefresh={vm.refresh}
          onEndReached={vm.loadMore}
          header={
            vm.error ? <Banner tone="danger" icon="alert-circle" title="Не удалось загрузить" text={vm.error} /> : null
          }
          empty={
            vm.error ? null : (
              <EmptyState
                icon={vm.filter === 'pending' ? 'shield-check' : 'account-search'}
                title={vm.filter === 'pending' ? 'Очередь пуста' : 'Никого не найдено'}
                text={vm.filter === 'pending' ? 'Все документы водителей проверены' : 'Измените запрос или фильтр'}
              />
            )
          }
          renderItem={({ item: user }) => {
            const v = verificationInfo(user.verification);
            return (
              <Card onPress={() => vm.openUser(user.id)}>
                <View style={styles.row}>
                  <Avatar name={user.fullName} color={user.isBlocked ? colors.textMuted : colors.text} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={font.h3}>{user.fullName}</Text>
                    <Text style={styles.meta}>
                      {ROLE_LABELS[user.role]} · {user.email}
                    </Text>
                  </View>
                </View>
                <View style={styles.badges}>
                  {user.role === 'Driver' ? <Badge label={v.label} tone={v.tone} icon={v.icon} /> : null}
                  {user.isBlocked ? <Badge label="Заблокирован" tone="danger" icon="account-lock" /> : null}
                </View>
              </Card>
            );
          }}
        />
      )}
    </>
  );
}

/** Очередь споров (UC-21): нажатие открывает карточку заявки, где администратор принимает решение. */
function DisputeQueue({ vm }: { vm: ReturnType<typeof useDisputeQueueViewModel> }) {
  return (
    <>
      <View style={{ flexGrow: 0, flexShrink: 0 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Chip icon="scale-balance" label="Ждут решения" selected={vm.onlyOpen} onPress={() => vm.setOnlyOpen(true)} />
          <Chip icon="history" label="Все споры" selected={!vm.onlyOpen} onPress={() => vm.setOnlyOpen(false)} />
        </ScrollView>
      </View>
      {vm.isLoading ? (
        <LoadingView />
      ) : (
        <PagedList
          items={vm.items}
          total={vm.total}
          isRefreshing={vm.isRefreshing}
          isLoadingMore={vm.isLoadingMore}
          hasMore={vm.hasMore}
          onRefresh={vm.refresh}
          onEndReached={vm.loadMore}
          header={
            vm.error ? <Banner tone="danger" icon="alert-circle" title="Не удалось загрузить" text={vm.error} /> : null
          }
          empty={
            vm.error ? null : (
              <EmptyState
                icon="scale-balance"
                title={vm.onlyOpen ? 'Открытых споров нет' : 'Споров пока не было'}
                text="Спор открывает заказчик или водитель на экране рейса после оплаты заказа"
              />
            )
          }
          renderItem={({ item: dispute }) => {
            const status = disputeStatusInfo(dispute.status);
            return (
              <Card onPress={() => vm.openOrder(dispute.order.id)}>
                <View style={styles.row}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={font.h3}>{dispute.order.title}</Text>
                    <Text style={styles.meta}>
                      {formatPrice(dispute.order.price)} · {dispute.order.clientName} → {dispute.order.driverName}
                    </Text>
                  </View>
                  <Badge label={status.label} tone={status.tone} icon={status.icon} />
                </View>
                <Text style={font.body} numberOfLines={3}>
                  «{dispute.reason}»
                </Text>
                <Text style={styles.meta}>
                  {ROLE_LABELS[dispute.openedBy.role]} {dispute.openedBy.fullName} · {formatRelative(dispute.createdAt)}{' '}
                  · этап: {TRIP_STAGE_LABELS[dispute.orderStatusAtOpen]}
                </Text>
              </Card>
            );
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meta: { ...font.small, color: colors.textSecondary },
  badges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
