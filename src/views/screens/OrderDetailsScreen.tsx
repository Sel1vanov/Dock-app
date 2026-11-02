import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatPhone } from '../../core/phone';
import { bidStatusInfo, cargoTypeInfo, vehicleTypeInfo } from '../../models/catalog';
import { oversizeReasons } from '../../models/domain';
import type { BidDTO } from '../../models/dto';
import { useOrderDetailsViewModel } from '../../viewmodels/OrderDetailsViewModels';
import { DisputeCard, DisputeControls } from '../components/dispute';
import {
  CargoTypeIcon,
  ContactButtons,
  DimensionTiles,
  MyBidBadge,
  OrderStatusBadge,
  PromptModal,
  RouteView,
} from '../components/order';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Icon,
  LoadingView,
  RatingLabel,
  ScreenScroll,
  SectionTitle,
  TextField,
} from '../components/ui';
import { colors, family, font, formatNumber, formatPrice, formatRelative, radius, spacing } from '../theme';

/** Карточка заявки: торг (UC-10, UC-11), выбор исполнителя (UC-06), отмена (UC-07), спор (UC-20, UC-21). */
export function OrderDetailsScreen({ orderId }: { orderId: string }) {
  const vm = useOrderDetailsViewModel(orderId);
  const [cancelOpen, setCancelOpen] = useState(false);
  const order = vm.order;

  if (vm.query.isLoading) return <LoadingView />;
  if (!order) {
    return (
      <EmptyState
        icon="alert-circle"
        title="Заказ недоступен"
        text={vm.query.error ?? 'Возможно, он уже закрыт'}
        action={<Button title="Повторить" variant="secondary" onPress={vm.query.refresh} />}
      />
    );
  }

  const type = cargoTypeInfo(order.cargo.type);
  const oversize = oversizeReasons(order.cargo);

  return (
    <ScreenScroll refreshing={vm.query.isRefreshing} onRefresh={vm.query.refresh}>
      <Card>
        <View style={styles.heroTop}>
          <CargoTypeIcon cargo={order.cargo} size={56} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.heroTitle}>{order.cargo.description || type.label}</Text>
            <Text style={styles.meta}>
              {type.label} · опубликована {formatRelative(order.createdAt)}
            </Text>
          </View>
        </View>
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.meta}>{order.driverId ? 'Согласованная цена' : 'Цена заказчика'}</Text>
            <Text style={styles.price}>{formatPrice(order.price)}</Text>
          </View>
          <OrderStatusBadge status={order.status} isEscrowLocked={order.isEscrowLocked} />
        </View>
        {order.status === 'Cancelled' && order.cancelReason ? (
          <Text style={styles.meta}>Причина отмены: {order.cancelReason}</Text>
        ) : null}
      </Card>

      {order.dispute ? <DisputeCard dispute={order.dispute} price={order.price} actions={vm.dispute} /> : null}

      {vm.canEditOrder ? (
        <View style={styles.editRow}>
          <Button title="Изменить" variant="secondary" icon="pencil" onPress={vm.editOrder} style={{ flex: 1 }} />
          {vm.canDeleteOrder ? (
            <Button
              title="Удалить"
              variant="danger"
              icon="trash-can-outline"
              onPress={vm.deleteOrder}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
      ) : null}

      <Card>
        <RouteView origin={order.origin} destination={order.destination} />
      </Card>

      <Card>
        <Text style={font.h3}>Габариты и вес</Text>
        <DimensionTiles dims={order.cargo} />
        {oversize.length > 0 ? (
          <Banner
            tone="warning"
            icon="shield-alert"
            title="Негабарит"
            text={`${oversize.join(', ')} — нужно спецразрешение на проезд`}
          />
        ) : null}
      </Card>

      {vm.hasTrip ? <Button title="Открыть рейс и фотофиксацию" icon="truck-fast" onPress={vm.openTracking} /> : null}

      {/* ------------------------------------------------ Водитель ------ */}
      {vm.isDriverRole && order.client ? (
        <Card>
          <Text style={styles.meta}>Заказчик</Text>
          <PersonRow name={order.client.fullName} rating={order.client.rating} phone={order.client.phone} />
          {vm.isAssignedDriver && order.client.phone ? <ContactButtons phone={order.client.phone} /> : null}
        </Card>
      ) : null}

      {vm.isDriverRole && vm.isBiddingOpen ? <DriverBidSection vm={vm} /> : null}

      {vm.isDriverRole && order.myBid && !vm.isBiddingOpen && !vm.isAssignedDriver ? (
        <Banner tone="muted" icon="handshake" title="Исполнитель выбран" text="Заказчик выбрал другое предложение" />
      ) : null}

      {/* ------------------------------------------------ Заказчик ------ */}
      {vm.isClient && vm.isBiddingOpen ? (
        <>
          <SectionTitle title={`Отклики водителей · ${order.bids.length}`} />
          {order.bids.length === 0 ? (
            <Card>
              <EmptyState
                icon="clock-outline"
                title="Пока нет откликов"
                text="Заявку видят водители, у которых груз помещается в транспорт. Обычно первые отклики приходят в течение часа."
              />
            </Card>
          ) : null}
          {order.bids.map((bid) => (
            <BidCard
              key={bid.id}
              bid={bid}
              orderPrice={order.price}
              onAccept={vm.acceptBid}
              onReject={vm.rejectBid}
              onCounter={vm.openCounter}
              busy={vm.isBusy}
            />
          ))}
        </>
      ) : null}

      {vm.isClient && order.driver ? (
        <Card>
          <Text style={styles.meta}>Исполнитель</Text>
          <PersonRow
            name={order.driver.fullName}
            rating={order.driver.rating}
            verified={order.driver.isVerified}
            phone={order.driver.phone}
          />
          {order.driver.phone ? <ContactButtons phone={order.driver.phone} /> : null}
        </Card>
      ) : null}

      {/* ------------------------------------------- Администратор ------ */}
      {vm.isAdmin ? (
        <Card>
          <Text style={styles.meta}>Заказчик</Text>
          <PersonRow name={order.client.fullName} rating={order.client.rating} phone={order.client.phone} />
          {order.client.phone ? <ContactButtons phone={order.client.phone} /> : null}
          {order.driver ? (
            <>
              <Text style={styles.meta}>Исполнитель</Text>
              <PersonRow
                name={order.driver.fullName}
                rating={order.driver.rating}
                verified={order.driver.isVerified}
                phone={order.driver.phone}
              />
              {order.driver.phone ? <ContactButtons phone={order.driver.phone} /> : null}
            </>
          ) : null}
        </Card>
      ) : null}

      <DisputeControls actions={vm.dispute} />

      {vm.canCancel ? (
        <Button title="Отменить заявку" variant="danger" icon="close-circle" onPress={() => setCancelOpen(true)} />
      ) : null}

      <PromptModal
        visible={cancelOpen}
        title="Отменить заявку?"
        placeholder="Причина отмены (необязательно)"
        confirmText="Отменить"
        onCancel={() => setCancelOpen(false)}
        onConfirm={async (reason) => {
          setCancelOpen(false);
          await vm.cancelOrder(reason);
        }}
      />

      <PromptModal
        visible={vm.counterBid !== null}
        title="Встречная цена"
        message={
          vm.counterBid
            ? `${vm.counterBid.driver.fullName} предлагает ${formatPrice(vm.counterBid.price)}. Водитель получит уведомление и сможет согласиться.`
            : undefined
        }
        placeholder="Ваша цена"
        confirmText="Предложить"
        confirmVariant="primary"
        numeric
        onCancel={vm.closeCounter}
        onConfirm={vm.submitCounter}
      />
    </ScreenScroll>
  );
}

function DriverBidSection({ vm }: { vm: ReturnType<typeof useOrderDetailsViewModel> }) {
  const order = vm.order!;
  const fit = vm.compatibility;

  return (
    <>
      <SectionTitle title="Ваше предложение" />
      {fit ? (
        fit.ok ? (
          <Banner
            tone="success"
            icon="check-circle"
            title="Груз помещается"
            text={`${vehicleTypeInfo(fit.vehicle.type).label}${fit.vehicle.model ? ` ${fit.vehicle.model}` : ''}: до ${formatNumber(fit.vehicle.weightT)} т`}
          />
        ) : (
          <Banner tone="danger" icon="alert-circle" title="Ваше ТС не подходит" text={fit.issues.join(', ')} />
        )
      ) : null}

      {vm.needsVerification ? (
        <Banner
          tone="warning"
          icon="shield-alert"
          title="Отклики после верификации"
          text="Администратор должен проверить ваши документы."
          action={
            vm.user.verification === 'none' ? (
              <Button title="Загрузить документы" compact onPress={vm.openVerification} />
            ) : undefined
          }
        />
      ) : null}

      {!vm.hasVehicles ? (
        <Banner
          tone="info"
          icon="truck-flatbed"
          title="Нет транспорта"
          text="Добавьте ТС, чтобы откликаться"
          action={<Button title="Добавить ТС" compact onPress={vm.addVehicle} />}
        />
      ) : null}

      {order.myBid?.status === 'Pending' && order.myBid.counterPrice ? (
        <Banner
          tone="warning"
          icon="swap-horizontal"
          title={`Заказчик предлагает ${formatPrice(order.myBid.counterPrice)}`}
          text={`Ваша цена — ${formatPrice(order.myBid.price)}. Согласитесь или предложите другую цену ниже.`}
          action={
            <Button
              title={`Согласиться на ${formatPrice(order.myBid.counterPrice)}`}
              icon="check-circle"
              compact
              onPress={vm.acceptCounter}
              loading={vm.isBusy}
            />
          }
        />
      ) : null}

      {vm.canBid && vm.hasVehicles ? (
        <Card>
          {order.myBid ? (
            <MyBidBadge status={order.myBid.status} price={order.myBid.price} counterPrice={order.myBid.counterPrice} />
          ) : null}
          {!order.myBid ? (
            <Button
              title={`Откликнуться за ${formatPrice(order.price)}`}
              icon="handshake"
              onPress={() => vm.submitBid(true)}
              loading={vm.isBusy}
            />
          ) : null}
          <Text style={styles.divider}>{order.myBid ? 'Изменить предложение' : 'или предложите свою цену'}</Text>
          <TextField
            label="Ваша цена"
            suffix="₽"
            keyboardType="number-pad"
            value={vm.bidForm.price}
            onChangeText={(t) => vm.setBidField('price', t)}
            error={vm.bidErrors.price}
          />
          <TextField
            label="Комментарий"
            placeholder="Когда сможете приехать, условия погрузки…"
            value={vm.bidForm.comment}
            onChangeText={(t) => vm.setBidField('comment', t)}
            error={vm.bidErrors.comment}
            multiline
          />
          <Button
            title={order.myBid ? 'Сохранить предложение' : 'Предложить свою цену'}
            variant="secondary"
            icon="currency-rub"
            onPress={() => vm.submitBid(false)}
            loading={vm.isBusy}
          />
          {order.myBid?.status === 'Pending' ? (
            <Button title="Отозвать отклик" variant="ghost" icon="close-circle" onPress={vm.withdrawBid} />
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

function PersonRow({
  name,
  rating,
  verified,
  phone,
}: {
  name: string;
  rating: BidDTO['driver']['rating'];
  verified?: boolean;
  phone?: string | null;
}) {
  return (
    <View style={styles.person}>
      <Avatar name={name} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.nameRow}>
          <Text style={font.h3}>{name}</Text>
          {verified ? <Icon name="shield-check" size={16} color={colors.success} /> : null}
        </View>
        <RatingLabel rating={rating} />
        {phone ? <Text style={styles.meta}>{formatPhone(phone)}</Text> : null}
      </View>
    </View>
  );
}

function BidCard({
  bid,
  orderPrice,
  onAccept,
  onReject,
  onCounter,
  busy,
}: {
  bid: BidDTO;
  orderPrice: number;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onCounter: (id: string) => void;
  busy: boolean;
}) {
  const diff = bid.price - orderPrice;
  const status = bidStatusInfo(bid.status);
  const vehicle = bid.vehicles[0];
  return (
    <Card style={bid.status === 'Rejected' ? { opacity: 0.6 } : undefined}>
      <View style={styles.person}>
        <Avatar name={bid.driver.fullName} color={colors.text} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.nameRow}>
            <Text style={font.h3}>{bid.driver.fullName}</Text>
            {bid.driver.isVerified ? <Icon name="shield-check" size={16} color={colors.success} /> : null}
          </View>
          <RatingLabel rating={bid.driver.rating} />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.bidPrice}>{formatPrice(bid.price)}</Text>
          {diff !== 0 ? (
            <Text
              style={[styles.meta, { color: diff < 0 ? colors.success : colors.warning, fontFamily: family.semibold }]}
            >
              {diff > 0 ? '+' : '−'}
              {formatPrice(Math.abs(diff))}
            </Text>
          ) : (
            <Text style={styles.meta}>по вашей цене</Text>
          )}
        </View>
      </View>
      {vehicle ? (
        <View style={styles.vehicle}>
          <Icon name={vehicleTypeInfo(vehicle.type).icon} size={18} color={colors.textSecondary} />
          <Text style={styles.meta}>
            {vehicleTypeInfo(vehicle.type).label}
            {vehicle.model ? ` ${vehicle.model}` : ''} · до {formatNumber(vehicle.weightT)} т ·{' '}
            {formatNumber(vehicle.lengthM)}×{formatNumber(vehicle.widthM)} м
            {bid.vehicles.length > 1 ? ` · ещё ТС: ${bid.vehicles.length - 1}` : ''}
          </Text>
        </View>
      ) : null}
      {bid.comment ? <Text style={styles.comment}>«{bid.comment}»</Text> : null}
      {bid.status === 'Pending' && bid.counterPrice ? (
        <View style={styles.counter}>
          <Icon name="swap-horizontal" size={18} color={colors.warning} />
          <Text style={styles.counterText}>Вы предложили {formatPrice(bid.counterPrice)} — ждём ответа водителя</Text>
        </View>
      ) : null}
      {bid.status === 'Pending' ? (
        <View style={{ gap: spacing.sm }}>
          <Button
            title={`Выбрать за ${formatPrice(bid.price)}`}
            icon="check-circle"
            compact
            onPress={() => onAccept(bid.id)}
            disabled={busy}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              title="Своя цена"
              icon="swap-horizontal"
              variant="secondary"
              compact
              onPress={() => onCounter(bid.id)}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <Button
              title="Отклонить"
              variant="secondary"
              compact
              onPress={() => onReject(bid.id)}
              disabled={busy}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : (
        <Badge label={status.label} tone={status.tone} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  heroTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  heroTitle: { ...font.h2, color: colors.text },
  meta: { ...font.small, color: colors.textSecondary },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  price: { fontFamily: family.bold, fontSize: 30, letterSpacing: -0.8, color: colors.text },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bidPrice: { fontFamily: family.bold, fontSize: 19, letterSpacing: -0.3, color: colors.text },
  vehicle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  comment: { ...font.body, color: colors.text, fontStyle: 'italic' },
  divider: { ...font.small, color: colors.textMuted, textAlign: 'center' },
  editRow: { flexDirection: 'row', gap: spacing.sm },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  counterText: { ...font.small, color: colors.text, flex: 1 },
});
