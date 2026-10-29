import { StyleSheet, Text, TextInput, View } from 'react-native';

import { formatPhone } from '../../core/phone';
import type { PhotoStage } from '../../models/dto';
import { useTrackingViewModel } from '../../viewmodels/OrderDetailsViewModels';
import { ContactButtons, OrderStatusBadge, PhotoGrid, RouteView, StarInput, StatusTimeline } from '../components/order';
import {
  Avatar,
  Banner,
  Button,
  Card,
  EmptyState,
  Icon,
  LoadingView,
  RatingLabel,
  ScreenScroll,
} from '../components/ui';
import { colors, family, font, formatDateTime, formatPrice, radius, spacing } from '../theme';

/**
 * TrackingScreen (SAD 5.2): статус рейса (UC-15, UC-16), фотофиксация (UC-17),
 * оплата (UC-12), приёмка груза (UC-18) и отзыв (UC-19).
 */
export function TrackingScreen({ orderId }: { orderId: string }) {
  const vm = useTrackingViewModel(orderId);
  const order = vm.order;

  if (vm.query.isLoading) return <LoadingView />;
  if (!order) return <EmptyState icon="alert-circle" title="Рейс недоступен" text={vm.query.error ?? undefined} />;

  const counterpart = vm.isClient ? order.driver : order.client;
  const loadingPhotos = order.photos.filter((p) => p.stage === 'Loading');
  const unloadingPhotos = order.photos.filter((p) => p.stage === 'Unloading');

  return (
    <ScreenScroll refreshing={vm.query.isRefreshing} onRefresh={vm.query.refresh}>
      <Card>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.meta}>Обновлён {formatDateTime(order.updatedAt)}</Text>
            <Text style={styles.price}>{formatPrice(order.price)}</Text>
          </View>
          <OrderStatusBadge status={order.status} isEscrowLocked={order.isEscrowLocked} />
        </View>
        <View style={[styles.escrow, order.isEscrowLocked && { backgroundColor: colors.successSoft }]}>
          <Icon name="cash-lock" size={18} color={order.isEscrowLocked ? colors.success : colors.textMuted} />
          <Text style={styles.meta}>
            {order.status === 'Completed'
              ? 'Средства переведены исполнителю'
              : order.isEscrowLocked
                ? 'Средства заморожены до приёмки груза (безопасная сделка)'
                : 'Ожидается оплата заказчиком'}
          </Text>
        </View>
        <RouteView origin={order.origin} destination={order.destination} compact />
      </Card>

      {/* ----------------------------------------- Действия водителя ---- */}
      {vm.nextStep ? (
        <Card style={styles.actionCard}>
          <Text style={styles.actionHint}>{vm.nextStep.hint}</Text>
          {vm.nextStep.kind === 'status' ? (
            <Button title={vm.nextStep.label} icon="arrow-right" onPress={vm.advanceStatus} loading={vm.isBusy} />
          ) : null}
          {vm.nextStep.kind === 'photo' ? (
            <Button
              title={vm.nextStep.label}
              icon="camera"
              onPress={() => vm.nextStep?.kind === 'photo' && vm.uploadPhoto(vm.nextStep.stage)}
              loading={vm.uploadingStage !== null}
            />
          ) : null}
          {vm.nextStep.kind === 'wait' ? (
            <View style={styles.waiting}>
              <Icon name="clock-outline" color={colors.textSecondary} />
              <Text style={font.bodyBold}>{vm.nextStep.label}</Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* ---------------------------------------- Действия заказчика ---- */}
      {vm.canPay ? (
        <Banner
          tone="warning"
          icon="cash"
          title="Оплатите заказ, чтобы водитель начал рейс"
          text="Деньги будут заморожены и переведены исполнителю только после того, как вы подтвердите приёмку."
          action={
            <Button
              title={`Оплатить ${formatPrice(order.price)}`}
              icon="cash-lock"
              onPress={vm.payOrder}
              loading={vm.isBusy}
              compact
            />
          }
        />
      ) : null}
      {vm.canConfirmDelivery ? (
        <Banner
          tone="success"
          icon="package-down"
          title="Груз доставлен"
          text="Проверьте груз и фото выгрузки, затем подтвердите приёмку."
          action={
            <Button
              title="Подтвердить приёмку"
              variant="success"
              icon="check-circle"
              onPress={vm.confirmDelivery}
              loading={vm.isBusy}
              compact
            />
          }
        />
      ) : null}

      <Card>
        <Text style={font.h3}>Ход рейса</Text>
        {order.status === 'Cancelled' ? (
          <Text style={styles.meta}>Заказ отменён{order.cancelReason ? `: ${order.cancelReason}` : ''}</Text>
        ) : (
          <StatusTimeline status={order.status} isEscrowLocked={order.isEscrowLocked} />
        )}
      </Card>

      <PhotoSection
        title="Фото погрузки"
        stage="Loading"
        photos={loadingPhotos}
        canUpload={vm.canUploadPhoto('Loading')}
        uploading={vm.uploadingStage === 'Loading'}
        onUpload={vm.uploadPhoto}
      />
      <PhotoSection
        title="Фото выгрузки"
        stage="Unloading"
        photos={unloadingPhotos}
        canUpload={vm.canUploadPhoto('Unloading')}
        uploading={vm.uploadingStage === 'Unloading'}
        onUpload={vm.uploadPhoto}
      />

      {counterpart ? (
        <Card>
          <Text style={styles.meta}>{vm.isClient ? 'Водитель' : 'Заказчик'}</Text>
          <View style={styles.person}>
            <Avatar name={counterpart.fullName} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={font.h3}>{counterpart.fullName}</Text>
              <RatingLabel rating={counterpart.rating} />
              {counterpart.phone ? <Text style={styles.meta}>{formatPhone(counterpart.phone)}</Text> : null}
            </View>
          </View>
          {counterpart.phone && order.status !== 'Cancelled' ? <ContactButtons phone={counterpart.phone} /> : null}
        </Card>
      ) : null}

      {vm.review.canReview ? (
        <Card>
          <Text style={font.h3}>Оцените {vm.isClient ? 'водителя' : 'заказчика'}</Text>
          <StarInput value={vm.review.rating} onChange={vm.review.setRating} />
          <TextInput
            style={styles.reviewInput}
            placeholder="Комментарий (необязательно)"
            placeholderTextColor={colors.textMuted}
            value={vm.review.comment}
            onChangeText={vm.review.setComment}
            multiline
          />
          <Button title="Отправить отзыв" icon="star" onPress={vm.review.submit} loading={vm.isBusy} />
        </Card>
      ) : null}

      <Button title="Детали заявки" variant="ghost" icon="file-document-outline" onPress={vm.openOrder} />
    </ScreenScroll>
  );
}

function PhotoSection({
  title,
  stage,
  photos,
  canUpload,
  uploading,
  onUpload,
}: {
  title: string;
  stage: PhotoStage;
  photos: Parameters<typeof PhotoGrid>[0]['photos'];
  canUpload: boolean;
  uploading: boolean;
  onUpload: (stage: PhotoStage) => void;
}) {
  return (
    <Card>
      <View style={styles.topRow}>
        <Text style={[font.h3, { flex: 1 }]}>{title}</Text>
        {canUpload ? (
          <Button
            title="Добавить"
            icon="image-plus"
            compact
            variant="secondary"
            onPress={() => onUpload(stage)}
            loading={uploading}
          />
        ) : null}
      </View>
      <PhotoGrid photos={photos} emptyText="Фото пока не загружены" />
    </Card>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  meta: { ...font.small, color: colors.textSecondary, flexShrink: 1 },
  price: { fontFamily: family.bold, fontSize: 28, letterSpacing: -0.7, color: colors.text },
  escrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  actionCard: { borderWidth: 2, borderColor: colors.accent, backgroundColor: '#FFFBF7' },
  actionHint: { ...font.body, color: colors.textSecondary },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reviewInput: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...font.body,
    color: colors.text,
    textAlignVertical: 'top',
  },
});
