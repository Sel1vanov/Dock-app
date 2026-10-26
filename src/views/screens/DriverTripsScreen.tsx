import { Text, View } from 'react-native';

import { useDriverTripsViewModel } from '../../viewmodels/OrderViewModels';
import { GradientHeader, MyBidBadge, OrderCard } from '../components/order';
import { Banner, EmptyState, LoadingView, ScreenScroll, SectionTitle, Segmented } from '../components/ui';
import { colors, font } from '../theme';

/** «Мои рейсы» водителя: активные/завершённые рейсы и отправленные отклики. */
export function DriverTripsScreen() {
  const vm = useDriverTripsViewModel();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GradientHeader subtitle="Работа" title="Мои рейсы">
        <Segmented
          options={[
            { value: 'trips', label: 'Рейсы', badge: vm.activeTrips.length },
            { value: 'bids', label: 'Отклики', badge: vm.pendingBidsCount },
          ]}
          value={vm.tab}
          onChange={vm.setTab}
        />
      </GradientHeader>

      {vm.isLoading ? (
        <LoadingView />
      ) : (
        <ScreenScroll refreshing={vm.isRefreshing} onRefresh={vm.refresh}>
          {vm.error ? <Banner tone="danger" icon="alert-circle" title="Не удалось загрузить" text={vm.error} /> : null}

          {vm.tab === 'trips' ? (
            <>
              {vm.activeTrips.length === 0 && vm.finishedTrips.length === 0 ? (
                <EmptyState
                  icon="truck-fast"
                  title="Рейсов пока нет"
                  text="Когда заказчик выберет ваш отклик, рейс появится здесь"
                />
              ) : null}
              {vm.activeTrips.map((o) => (
                <OrderCard key={o.id} order={o} onPress={() => vm.openTrip(o.id)} />
              ))}
              {vm.finishedTrips.length > 0 ? <SectionTitle title="Завершённые" /> : null}
              {vm.finishedTrips.map((o) => (
                <OrderCard key={o.id} order={o} onPress={() => vm.openTrip(o.id)} />
              ))}
            </>
          ) : (
            <>
              {vm.bids.length === 0 ? (
                <EmptyState
                  icon="handshake"
                  title="Откликов нет"
                  text="Откликайтесь на заявки в ленте «Поиск грузов»"
                />
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
            </>
          )}
        </ScreenScroll>
      )}
    </View>
  );
}
