import { Text, View } from 'react-native';

import { useDriverTripsViewModel } from '../../viewmodels/OrderViewModels';
import { PagedList } from '../components/lists';
import { GradientHeader, MyBidBadge, OrderCard } from '../components/order';
import { Banner, Chip, EmptyState, LoadingView, ScreenScroll, Segmented } from '../components/ui';
import { colors, font, spacing } from '../theme';

/** «Мои рейсы» водителя: рейсы (активные/завершённые, подгрузка страницами) и отправленные отклики. */
export function DriverTripsScreen() {
  const vm = useDriverTripsViewModel();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GradientHeader subtitle="Работа" title="Мои рейсы">
        <Segmented
          options={[
            { value: 'trips', label: 'Рейсы' },
            { value: 'bids', label: 'Отклики', badge: vm.pendingBidsCount },
          ]}
          value={vm.tab}
          onChange={vm.setTab}
        />
      </GradientHeader>

      {vm.isLoading ? (
        <LoadingView />
      ) : vm.tab === 'trips' ? (
        <PagedList
          items={vm.trips.items}
          total={vm.trips.total}
          isRefreshing={vm.isRefreshing}
          isLoadingMore={vm.trips.isLoadingMore}
          hasMore={vm.trips.hasMore}
          onRefresh={vm.refresh}
          onEndReached={vm.trips.loadMore}
          header={
            <>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
                <Chip label="В работе" selected={vm.status === 'active'} onPress={() => vm.setStatus('active')} />
                <Chip label="Завершённые" selected={vm.status === 'archive'} onPress={() => vm.setStatus('archive')} />
              </View>
              {vm.error ? (
                <Banner tone="danger" icon="alert-circle" title="Не удалось загрузить" text={vm.error} />
              ) : null}
            </>
          }
          empty={
            vm.error ? null : (
              <EmptyState
                icon="truck-fast"
                title={vm.status === 'active' ? 'Активных рейсов нет' : 'Завершённых рейсов нет'}
                text="Когда заказчик выберет ваш отклик, рейс появится здесь"
              />
            )
          }
          renderItem={({ item }) => <OrderCard order={item} onPress={() => vm.openTrip(item.id)} />}
        />
      ) : (
        <ScreenScroll refreshing={vm.isRefreshing} onRefresh={vm.refresh}>
          {vm.error ? <Banner tone="danger" icon="alert-circle" title="Не удалось загрузить" text={vm.error} /> : null}
          {vm.bids.length === 0 && !vm.error ? (
            <EmptyState icon="handshake" title="Откликов нет" text="Откликайтесь на заявки в ленте «Поиск грузов»" />
          ) : null}
          {vm.bids.map((b) => (
            <OrderCard
              key={b.id}
              order={b.order}
              onPress={() => vm.openOrder(b.order.id)}
              footer={<MyBidBadge status={b.status} price={b.price} />}
            />
          ))}
          {vm.bids.length > 0 ? (
            <Text style={{ ...font.small, color: colors.textMuted, textAlign: 'center' }}>
              Откройте заявку, чтобы изменить цену или отозвать отклик
            </Text>
          ) : null}
        </ScreenScroll>
      )}
    </View>
  );
}
