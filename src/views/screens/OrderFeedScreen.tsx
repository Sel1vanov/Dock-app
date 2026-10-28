import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { vehicleTypeInfo } from '../../models/catalog';
import { useOrderFeedViewModel } from '../../viewmodels/OrderViewModels';
import { OrderFilterBar, PagedList, SearchBar } from '../components/lists';
import { GradientHeader, MyBidBadge, OrderCard } from '../components/order';
import { Banner, Button, Chip, EmptyState, Icon, LoadingView, ScreenScroll } from '../components/ui';
import { colors, font, formatNumber, spacing } from '../theme';

/**
 * OrderFeedScreen (SAD 5.2): UC-08 «Список доступных заявок» + UC-09 «Фильтр по параметрам ТС».
 * Габариты, масса и типы грузов ТС, а также поиск и сортировка применяются на сервере.
 */
export function OrderFeedScreen() {
  const vm = useOrderFeedViewModel();
  const v = vm.selectedVehicle;

  const verificationBanner = !vm.canBid ? (
    <Banner
      tone="warning"
      icon="shield-alert"
      title={vm.user.verification === 'pending' ? 'Документы на проверке' : 'Пройдите верификацию'}
      text={
        vm.user.verification === 'pending'
          ? 'Пока администратор проверяет документы, заявки доступны только для просмотра.'
          : vm.user.verification === 'rejected'
            ? 'Документы отклонены. Загрузите их заново, чтобы откликаться на заявки.'
            : 'Чтобы откликаться на заявки, загрузите паспорт, ВУ и СТС.'
      }
      action={
        vm.user.verification !== 'pending' ? (
          <Button title="Загрузить документы" compact icon="card-account-details" onPress={vm.openVerification} />
        ) : undefined
      }
    />
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GradientHeader subtitle="Поиск грузов" title="Заявки для вас">
        {vm.vehicles.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {vm.vehicles.map((vehicle) => (
                <Chip
                  key={vehicle.id}
                  icon={vehicleTypeInfo(vehicle.type).icon}
                  label={vehicle.model || vehicleTypeInfo(vehicle.type).label}
                  selected={vehicle.id === v?.id}
                  onPress={() => vm.selectVehicle(vehicle.id)}
                  onDark
                />
              ))}
              <Chip icon="plus-circle" label="ТС" onPress={vm.addVehicle} onDark />
            </ScrollView>
            {v ? (
              <View style={styles.filter}>
                <Icon name="cube-outline" size={16} color="#9FB0D6" />
                <Text style={styles.filterText} numberOfLines={1}>
                  до {formatNumber(v.weightT)} т · {formatNumber(v.lengthM)}×{formatNumber(v.widthM)}×
                  {formatNumber(v.heightM)} м · {v.cargoTypes.map((c) => c.name.toLowerCase()).join(', ')}
                </Text>
              </View>
            ) : null}
            <SearchBar
              value={vm.filters.search}
              onChange={vm.filters.setSearch}
              placeholder="Поиск по грузу или адресу"
              dark
            />
          </View>
        ) : null}
      </GradientHeader>

      {vm.vehicles.length > 0 ? (
        <OrderFilterBar
          cargoType={vm.filters.cargoType}
          onCargoType={vm.filters.setCargoType}
          sort={vm.filters.sort}
          onSort={vm.filters.setSort}
        />
      ) : null}

      {vm.isLoading ? (
        <LoadingView />
      ) : vm.vehicles.length === 0 ? (
        <ScreenScroll refreshing={vm.isRefreshing} onRefresh={vm.refresh}>
          {vm.error ? <Banner tone="danger" icon="alert-circle" title="Не удалось загрузить" text={vm.error} /> : null}
          {verificationBanner}
          <EmptyState
            icon="truck-flatbed"
            title="Добавьте свой транспорт"
            text="Лента покажет только те грузы, которые помещаются в ваш трал или манипулятор и подходят по типу"
            action={<Button title="Добавить ТС" icon="plus-circle" onPress={vm.addVehicle} />}
          />
        </ScreenScroll>
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
            <>
              {vm.error ? (
                <Banner
                  tone="danger"
                  icon="alert-circle"
                  title="Не удалось загрузить"
                  text={vm.error}
                  action={<Button title="Повторить" compact variant="secondary" onPress={vm.refresh} />}
                />
              ) : null}
              {verificationBanner}
              {vm.total > 0 || vm.hiddenCount > 0 ? (
                <Text style={styles.hidden}>
                  Подходит заявок: {vm.total}
                  {vm.hiddenCount > 0 ? ` · не подходят под это ТС: ${vm.hiddenCount}` : ''}
                </Text>
              ) : null}
            </>
          }
          empty={
            vm.error ? null : (
              <EmptyState
                icon="magnify"
                title={vm.filters.hasFilters ? 'Ничего не найдено' : 'Подходящих заявок пока нет'}
                text={
                  vm.filters.hasFilters
                    ? 'Измените запрос или сбросьте фильтр'
                    : 'Потяните вниз, чтобы обновить ленту, или выберите другое ТС'
                }
                action={
                  vm.filters.hasFilters ? (
                    <Button title="Сбросить фильтры" variant="secondary" onPress={vm.filters.reset} />
                  ) : undefined
                }
              />
            )
          }
          renderItem={({ item: order }) => (
            <OrderCard
              order={order}
              onPress={() => vm.openOrder(order.id)}
              footer={order.myBid ? <MyBidBadge status={order.myBid.status} price={order.myBid.price} /> : null}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterText: { ...font.small, color: '#C5D1EC', fontWeight: '600', flex: 1 },
  hidden: { ...font.small, color: colors.textMuted },
});
