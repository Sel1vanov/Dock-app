import { StyleSheet, Text, View } from 'react-native';

import { notificationInfo } from '../../models/catalog';
import type { NotificationDTO } from '../../models/dto';
import { useNotificationsViewModel } from '../../viewmodels/NotificationsViewModel';
import { PagedList } from '../components/lists';
import { Banner, Button, Card, EmptyState, Icon, LoadingView } from '../components/ui';
import { colors, family, font, formatRelative, spacing, toneColors } from '../theme';

/** Уведомления о новых откликах, встречной цене, этапах рейса, отзывах и проверке документов. */
export function NotificationsScreen() {
  const vm = useNotificationsViewModel();
  if (vm.isLoading) return <LoadingView />;

  return (
    <PagedList
      items={vm.items}
      total={vm.total}
      isRefreshing={vm.isRefreshing}
      isLoadingMore={vm.isLoadingMore}
      hasMore={vm.hasMore}
      onRefresh={vm.refresh}
      onEndReached={vm.loadMore}
      header={
        <>
          {vm.error ? <Banner tone="danger" icon="alert-circle" title="Не удалось загрузить" text={vm.error} /> : null}
          {vm.unreadCount > 0 ? (
            <View style={styles.headerRow}>
              <Text style={styles.meta}>Непрочитанных: {vm.unreadCount}</Text>
              <Button title="Прочитать все" icon="check-all" variant="ghost" compact onPress={vm.markAllRead} />
            </View>
          ) : null}
        </>
      }
      empty={
        vm.error ? null : (
          <EmptyState
            icon="bell-outline"
            title="Уведомлений пока нет"
            text="Здесь появятся новые отклики, встречные цены, этапы рейса и отзывы"
          />
        )
      }
      renderItem={({ item }) => <NotificationRow n={item} read={vm.isRead(item)} onPress={() => vm.open(item)} />}
    />
  );
}

function NotificationRow({ n, read, onPress }: { n: NotificationDTO; read: boolean; onPress: () => void }) {
  const info = notificationInfo(n.type);
  const tone = toneColors[info.tone];
  return (
    <Card onPress={onPress} style={read ? undefined : styles.unread}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: tone.bg }]}>
          <Icon name={info.icon} size={22} color={tone.fg} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, read && { fontFamily: family.medium }]} numberOfLines={2}>
              {n.title}
            </Text>
            {read ? null : <View style={styles.dot} accessibilityLabel="Новое" />}
          </View>
          <Text style={styles.body}>{n.body}</Text>
          <Text style={styles.meta}>{formatRelative(n.createdAt)}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...font.bodyBold, color: colors.text, flex: 1 },
  body: { ...font.small, color: colors.textSecondary, lineHeight: 19 },
  meta: { ...font.caption, color: colors.textMuted },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  unread: { borderColor: '#FFD9BF' },
});
