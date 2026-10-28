import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ROLE_LABELS, verificationInfo } from '../../models/catalog';
import { type ModerationFilter, useModerationViewModel } from '../../viewmodels/AdminViewModels';
import { PagedList, SearchBar } from '../components/lists';
import { GradientHeader } from '../components/order';
import { Avatar, Badge, Banner, Card, Chip, EmptyState, LoadingView } from '../components/ui';
import { colors, font, spacing } from '../theme';

const FILTERS: { value: ModerationFilter; label: string; icon: string }[] = [
  { value: 'pending', label: 'На проверке', icon: 'clock-outline' },
  { value: 'drivers', label: 'Водители', icon: 'truck-flatbed' },
  { value: 'clients', label: 'Заказчики', icon: 'package-variant-closed' },
  { value: 'all', label: 'Все', icon: 'account-multiple' },
];

/** Модерация (UC-02, UC-22): очередь проверки документов и поиск пользователей. */
export function ModerationScreen() {
  const vm = useModerationViewModel();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GradientHeader subtitle="Администратор" title="Модерация">
        <SearchBar value={vm.search} onChange={vm.setSearch} placeholder="Имя или email" dark />
      </GradientHeader>
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
                  <Avatar name={user.fullName} color={user.isBlocked ? colors.textMuted : colors.navy600} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={font.h3}>{user.fullName}</Text>
                    <Text style={styles.meta}>
                      {ROLE_LABELS[user.role]} · {user.email}
                    </Text>
                  </View>
                </View>
                <View style={styles.badges}>
                  {user.role === 'Driver' ? <Badge label={v.label} tone={v.tone} icon={v.icon} /> : null}
                  {user.isBlocked ? <Badge label="Заблокирован" tone="danger" icon="cancel" /> : null}
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meta: { ...font.small, color: colors.textSecondary },
  badges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
