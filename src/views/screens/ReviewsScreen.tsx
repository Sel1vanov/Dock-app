import { StyleSheet, Text, View } from 'react-native';

import { ROLE_LABELS } from '../../models/catalog';
import { useReviewsViewModel } from '../../viewmodels/ProfileViewModels';
import { PagedList } from '../components/lists';
import { ReviewCard } from '../components/order';
import { Banner, EmptyState, LoadingView, RatingLabel } from '../components/ui';
import { colors, font, spacing } from '../theme';

/** Отзывы обо мне (UC-19): оценки и комментарии контрагентов, новые сверху. */
export function ReviewsScreen() {
  const vm = useReviewsViewModel();
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
          <View style={styles.summary}>
            <Text style={styles.meta}>Средняя оценка</Text>
            <RatingLabel rating={vm.rating} />
          </View>
        </>
      }
      empty={
        vm.error ? null : (
          <EmptyState icon="star-outline" title="Отзывов пока нет" text="Отзыв оставляют после завершения заказа" />
        )
      }
      renderItem={({ item }) => <ReviewCard review={item} roleLabel={ROLE_LABELS[item.authorRole]} />}
    />
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  meta: { ...font.small, color: colors.textSecondary },
});
