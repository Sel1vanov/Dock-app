import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { vehicleTypeInfo } from '../../models/catalog';
import { useOrderFeedViewModel } from '../../viewmodels/OrderViewModels';
import { GradientHeader, MyBidBadge, OrderCard } from '../components/order';
import { Banner, Button, Chip, EmptyState, Icon, LoadingView, ScreenScroll } from '../components/ui';
import { colors, font, formatNumber, spacing } from '../theme';

/** OrderFeedScreen (SAD 5.2): UC-08 «Список доступных заявок» + UC-09 «Фильтр по параметрам ТС». */
export function OrderFeedScreen() {
  const vm = useOrderFeedViewModel();
  const v = vm.selectedVehicle;

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
                />
              ))}
              <Chip icon="plus-circle" label="ТС" onPress={vm.addVehicle} />
            </ScrollView>
            {v ? (
              <View style={styles.filter}>
                <Icon name="cube-outline" size={16} color="#9FB0D6" />
                <Text style={styles.filterText}>
                  до {formatNumber(v.weightT)} т · {formatNumber(v.lengthM)}×{formatNumber(v.widthM)}×
                  {formatNumber(v.heightM)} м
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </GradientHeader>

      {vm.isLoading ? (
        <LoadingView />
      ) : (
        <ScreenScroll refreshing={vm.isRefreshing} onRefresh={vm.refresh}>
          {vm.error ? <Banner tone="danger" icon="alert-circle" title="Не удалось загрузить" text={vm.error} /> : null}

          {!vm.canBid ? (
            <Banner
              tone="warning"
              icon="shield-alert"
              title={vm.user.verification === 'pending' ? 'Документы на проверке' : 'Пройдите верификацию'}
              text={
                vm.user.verification === 'pending'
                  ? 'Пока администратор проверяет документы, заявки доступны только для просмотра.'
                  : 'Чтобы откликаться на заявки, загрузите паспорт, ВУ и СТС.'
              }
              action={
                vm.user.verification === 'none' ? (
                  <Button
                    title="Загрузить документы"
                    compact
                    icon="card-account-details"
                    onPress={vm.openVerification}
                  />
                ) : undefined
              }
            />
          ) : null}

          {vm.vehicles.length === 0 ? (
            <EmptyState
              icon="truck-flatbed"
              title="Добавьте свой транспорт"
              text="Лента автоматически покажет только те грузы, которые помещаются в ваш трал или манипулятор"
              action={<Button title="Добавить ТС" icon="plus-circle" onPress={vm.addVehicle} />}
            />
          ) : (
            <>
              {vm.orders.length === 0 ? (
                <EmptyState
                  icon="magnify"
                  title="Подходящих заявок пока нет"
                  text="Потяните вниз, чтобы обновить ленту"
                />
              ) : null}
              {vm.orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onPress={() => vm.openOrder(order.id)}
                  footer={order.myBid ? <MyBidBadge status={order.myBid.status} price={order.myBid.price} /> : null}
                />
              ))}
              {vm.hiddenCount > 0 ? (
                <Text style={styles.hidden}>
                  Скрыто по габаритам и массе: {vm.hiddenCount}. Выберите другое ТС, чтобы увидеть их.
                </Text>
              ) : null}
            </>
          )}
        </ScreenScroll>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterText: { ...font.small, color: '#C5D1EC', fontWeight: '600' },
  hidden: { ...font.small, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
});
