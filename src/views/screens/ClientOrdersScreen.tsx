import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { isOpenForBids } from '../../models/domain';
import { useClientOrdersViewModel } from '../../viewmodels/OrderViewModels';
import { GradientHeader, OrderCard } from '../components/order';
import { Badge, Banner, Button, EmptyState, LoadingView, ScreenScroll, Segmented } from '../components/ui';
import { colors, font, spacing } from '../theme';

/** «Мои заявки» заказчика (UC-06, UC-07 — из карточки заявки). */
export function ClientOrdersScreen() {
  const vm = useClientOrdersViewModel();
  const firstName = vm.user.fullName.split(' ')[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GradientHeader subtitle={`Здравствуйте, ${firstName}`} title="Мои заявки">
        <Segmented
          options={[
            { value: 'active', label: 'Активные', badge: vm.activeCount },
            { value: 'archive', label: 'Архив' },
          ]}
          value={vm.filter}
          onChange={vm.setFilter}
        />
      </GradientHeader>

      {vm.isLoading ? (
        <LoadingView />
      ) : (
        <ScreenScroll refreshing={vm.isRefreshing} onRefresh={vm.refresh}>
          {vm.error ? <Banner tone="danger" icon="alert-circle" title="Не удалось загрузить" text={vm.error} /> : null}
          {vm.orders.length === 0 && !vm.error ? (
            <EmptyState
              icon="package-variant"
              title={vm.filter === 'active' ? 'Активных заявок нет' : 'Архив пуст'}
              text="Опишите груз и маршрут — водители со спецтехникой предложат свои цены"
              action={<Button title="Создать заявку" icon="plus-circle" onPress={() => router.navigate('/create')} />}
            />
          ) : null}
          {vm.orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onPress={() => vm.openOrder(order.id)}
              footer={
                isOpenForBids(order) ? (
                  order.bidsCount > 0 ? (
                    <Badge label={`Отклики: ${order.bidsCount}`} tone="warning" icon="handshake" />
                  ) : (
                    <Text style={{ ...font.small, color: colors.textMuted }}>Ждём откликов</Text>
                  )
                ) : null
              }
            />
          ))}
          <View style={{ height: spacing.lg }} />
        </ScreenScroll>
      )}
    </View>
  );
}
