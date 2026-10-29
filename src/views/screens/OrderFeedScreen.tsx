import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { vehicleTypeInfo } from '../../models/catalog';
import { useOrderFeedViewModel } from '../../viewmodels/OrderViewModels';
import { OptionsModal, OrderFilterBar, PagedList, SearchBar } from '../components/lists';
import { MyBidBadge, OrderCard, ScreenHeader } from '../components/order';
import { Banner, Button, EmptyState, Icon, LoadingView, ScreenScroll } from '../components/ui';
import { colors, family, font, formatNumber, greeting, plural, radius, spacing } from '../theme';

const ADD_VEHICLE = '__add__';

/**
 * OrderFeedScreen (SAD 5.2): UC-08 «Список доступных заявок» + UC-09 «Фильтр по параметрам ТС».
 * Габариты, масса и типы грузов ТС, а также поиск и сортировка применяются на сервере.
 */
export function OrderFeedScreen() {
  const vm = useOrderFeedViewModel();
  const v = vm.selectedVehicle;
  const [pickerOpen, setPickerOpen] = useState(false);
  const firstName = vm.user.fullName.split(' ')[0];

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

  const subtitle =
    !v || vm.isLoading
      ? undefined
      : vm.filters.hasFilters
        ? `Найдено: ${vm.total}`
        : `${vm.total} ${plural(vm.total, 'груз подходит', 'груза подходят', 'грузов подходят')} под ваш транспорт`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={`${greeting()}, ${firstName}`} subtitle={subtitle}>
        {v ? (
          <>
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Выбрать транспорт для ленты"
              style={({ pressed }) => [styles.vehicle, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.vehicleIcon}>
                <Icon name={vehicleTypeInfo(v.type).icon} size={26} color={colors.text} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.vehicleTitle} numberOfLines={1}>
                  {v.model || vehicleTypeInfo(v.type).label}
                </Text>
                <Text style={styles.vehicleMeta} numberOfLines={1}>
                  до {formatNumber(v.weightT)} т · {formatNumber(v.lengthM)}×{formatNumber(v.widthM)}×
                  {formatNumber(v.heightM)} м
                </Text>
              </View>
              <Icon name="chevron-down" size={22} color={colors.textSecondary} />
            </Pressable>
            <SearchBar
              value={vm.filters.search}
              onChange={vm.filters.setSearch}
              placeholder="Поиск по грузу или адресу"
            />
          </>
        ) : null}
      </ScreenHeader>

      {v ? (
        <OrderFilterBar
          cargoType={vm.filters.cargoType}
          onCargoType={vm.filters.setCargoType}
          sort={vm.filters.sort}
          onSort={vm.filters.setSort}
        />
      ) : null}

      {vm.isLoading ? (
        <LoadingView />
      ) : !v ? (
        <ScreenScroll refreshing={vm.isRefreshing} onRefresh={vm.refresh}>
          {vm.error ? <Banner tone="danger" icon="alert-circle" title="Не удалось загрузить" text={vm.error} /> : null}
          {verificationBanner}
          <EmptyState
            icon="truck-flatbed"
            title="Добавьте свой транспорт"
            text="Лента покажет только те грузы, которые помещаются в ваш трал или манипулятор и подходят по типу"
            action={<Button title="Добавить ТС" icon="plus" onPress={vm.addVehicle} />}
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
              {vm.hiddenCount > 0 ? (
                <Text style={styles.hidden}>Ещё не подходят под это ТС: {vm.hiddenCount}</Text>
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
              footer={
                order.myBid ? (
                  <MyBidBadge
                    status={order.myBid.status}
                    price={order.myBid.price}
                    counterPrice={order.myBid.counterPrice}
                  />
                ) : null
              }
            />
          )}
        />
      )}

      <OptionsModal
        visible={pickerOpen}
        title="Лента подбирается под транспорт"
        options={[
          ...vm.vehicles.map((x) => ({
            value: x.id,
            label: `${x.model || vehicleTypeInfo(x.type).label} · до ${formatNumber(x.weightT)} т`,
            icon: vehicleTypeInfo(x.type).icon,
          })),
          { value: ADD_VEHICLE, label: 'Добавить транспорт', icon: 'plus' },
        ]}
        value={v?.id ?? ''}
        onSelect={(id) => {
          setPickerOpen(false);
          if (id === ADD_VEHICLE) vm.addVehicle();
          else vm.selectVehicle(id);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  vehicle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: 10,
    paddingRight: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  vehicleIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleTitle: { fontFamily: family.semibold, fontSize: 15, color: colors.text },
  vehicleMeta: { ...font.small, color: colors.textSecondary },
  hidden: { ...font.small, color: colors.textMuted },
});
