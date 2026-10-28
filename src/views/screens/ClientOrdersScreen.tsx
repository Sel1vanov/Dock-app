import { Text, View } from 'react-native';

import { isOpenForBids } from '../../models/domain';
import { useClientOrdersViewModel } from '../../viewmodels/OrderViewModels';
import { OrderFilterBar, PagedList, SearchBar } from '../components/lists';
import { GradientHeader, OrderCard } from '../components/order';
import { Badge, Banner, Button, EmptyState, LoadingView, Segmented } from '../components/ui';
import { colors, font } from '../theme';

/** «Мои заявки» заказчика: серверный поиск, фильтр по типу груза, сортировка, подгрузка страницами. */
export function ClientOrdersScreen() {
  const vm = useClientOrdersViewModel();
  const { filters } = vm;
  const firstName = vm.user.fullName.split(' ')[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GradientHeader subtitle={`Здравствуйте, ${firstName}`} title="Мои заявки">
        <Segmented
          options={[
            { value: 'active', label: 'Активные' },
            { value: 'archive', label: 'Архив' },
          ]}
          value={vm.status}
          onChange={vm.setStatus}
        />
        <SearchBar value={filters.search} onChange={filters.setSearch} placeholder="Поиск по грузу или адресу" dark />
      </GradientHeader>
      <OrderFilterBar
        cargoType={filters.cargoType}
        onCargoType={filters.setCargoType}
        sort={filters.sort}
        onSort={filters.setSort}
      />

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
            vm.error ? (
              <Banner
                tone="danger"
                icon="alert-circle"
                title="Не удалось загрузить"
                text={vm.error}
                action={<Button title="Повторить" compact variant="secondary" onPress={vm.refresh} />}
              />
            ) : vm.total > 0 ? (
              <Text style={{ ...font.small, color: colors.textMuted }}>Найдено заявок: {vm.total}</Text>
            ) : null
          }
          empty={
            vm.error ? null : filters.hasFilters ? (
              <EmptyState
                icon="magnify-close"
                title="Ничего не найдено"
                text="Попробуйте изменить запрос или фильтр"
                action={<Button title="Сбросить фильтры" variant="secondary" onPress={filters.reset} />}
              />
            ) : (
              <EmptyState
                icon="package-variant"
                title={vm.status === 'active' ? 'Активных заявок нет' : 'Архив пуст'}
                text="Опишите груз и маршрут — водители со спецтехникой предложат свои цены"
                action={<Button title="Создать заявку" icon="plus-circle" onPress={vm.createOrder} />}
              />
            )
          }
          renderItem={({ item: order }) => (
            <OrderCard
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
          )}
        />
      )}
    </View>
  );
}
