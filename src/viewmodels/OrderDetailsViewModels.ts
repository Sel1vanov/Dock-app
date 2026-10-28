/**
 * Карточка заказа (торг, выбор исполнителя) и TrackingViewModel (SAD 5.2: статусы и фотофиксация).
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { errorMessage } from '../core/errors';
import { chooseImageSource, confirmAction, notify, pickImage } from '../core/platform';
import { showToast } from '../core/toast';
import {
  canCancel,
  canConfirmDelivery,
  canDelete,
  canEdit,
  canPay,
  checkCompatibility,
  driverNextStep,
  isOpenForBids,
} from '../models/domain';
import type { OrderDetailsDTO, PhotoStage } from '../models/dto';
import { type BidForm, type FieldErrors, bidSchema, reviewSchema, validate } from '../models/schemas';
import { BidService } from '../services/BidService';
import { OrderService } from '../services/OrderService';
import { ReviewService } from '../services/ReviewService';
import { TrackingService } from '../services/TrackingService';
import { VehicleService } from '../services/VehicleService';
import { useCurrentUser } from './AuthViewModel';
import { useAction, useQuery } from './useAsync';

const formatPrice = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;

/** Общая часть: загрузка заказа, роль пользователя в нём и действия, общие для обоих экранов. */
function useOrderBase(orderId: string) {
  const user = useCurrentUser();
  const query = useQuery(() => OrderService.getOrderDetails(orderId), [orderId, user.id]);
  const order = query.data;
  const isClient = Boolean(order && order.clientId === user.id);
  const isAssignedDriver = Boolean(order && order.driverId === user.id);

  /** Выполнить действие и перечитать заказ. Успех — короткое уведомление, ошибку показываем диалогом. */
  const action = useAction(async (fn: () => Promise<unknown>, successText?: string) => {
    await fn();
    if (successText) showToast(successText);
    await query.reload();
  });
  const { error: actionError, clearError } = action;
  useEffect(() => {
    if (actionError) {
      notify('Не получилось', actionError);
      clearError();
    }
  }, [actionError, clearError]);

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const canReview = order ? ReviewService.canReview(order, user.id) : false;

  const leaveReview = () => {
    if (!order) return;
    const checked = validate(reviewSchema, { rating: reviewRating, comment: reviewComment });
    if (!checked.ok) {
      notify('Отзыв', checked.errors.rating ?? checked.errors.comment);
      return;
    }
    void action.run(() => ReviewService.leaveReview(order, user.id, checked.data), 'Спасибо за отзыв!');
  };

  const cancelOrder = async (reason: string) => {
    if (!order) return false;
    return action.run(() => OrderService.cancelOrder(order, reason), 'Заявка отменена');
  };

  return {
    user,
    order,
    query,
    isClient,
    isAssignedDriver,
    isBusy: action.isRunning,
    runAction: action.run,
    canCancel: Boolean(order && isClient && canCancel(order)),
    cancelOrder,
    review: {
      canReview,
      rating: reviewRating,
      comment: reviewComment,
      setRating: setReviewRating,
      setComment: setReviewComment,
      submit: leaveReview,
    },
  };
}

// ----------------------------------------------------- Карточка заказа ---

export function useOrderDetailsViewModel(orderId: string) {
  const base = useOrderBase(orderId);
  const { user, order, isClient, runAction } = base;
  const isDriverRole = user.role === 'Driver';

  const vehiclesQuery = useQuery(isDriverRole ? () => VehicleService.getMyVehicles() : null, [user.id, isDriverRole]);
  const vehicles = useMemo(() => vehiclesQuery.data ?? [], [vehiclesQuery.data]);

  /** Совместимость груза с ТС водителя (UC-09) — лучшая из машин. */
  const compatibility = useMemo(() => {
    if (!order || !isDriverRole) return null;
    const results = vehicles.map((v) => ({ vehicle: v, ...checkCompatibility(v, order.cargo) }));
    return results.find((r) => r.ok) ?? results[0] ?? null;
  }, [order, vehicles, isDriverRole]);

  const [bidForm, setBidForm] = useState<BidForm>({ price: '', comment: '' });
  const [bidErrors, setBidErrors] = useState<FieldErrors<BidForm>>({});
  // Цена в форме — текущий отклик или цена заказчика; обновляется, когда они меняются на сервере.
  const bidSource = order ? `${order.id}:${order.myBid?.price ?? order.price}` : null;
  const [bidFormSource, setBidFormSource] = useState<string | null>(null);
  if (order && bidSource !== bidFormSource) {
    setBidFormSource(bidSource);
    setBidForm({ price: String(order.myBid?.price ?? order.price), comment: '' });
  }

  const setBidField = (key: keyof BidForm, value: string) => {
    setBidForm((f) => ({ ...f, [key]: value }));
    setBidErrors((e) => ({ ...e, [key]: undefined }));
  };

  /** UC-10 — по цене заказчика; UC-11 — со встречной ценой из формы. */
  const submitBid = async (atClientPrice: boolean) => {
    if (!order) return;
    const checked = validate(bidSchema, atClientPrice ? { ...bidForm, price: String(order.price) } : bidForm);
    if (!checked.ok) {
      setBidErrors(checked.errors);
      return;
    }
    if (order.myBid) {
      await runAction(() => BidService.updateBid(order.myBid!.id, checked.data), 'Отклик обновлён');
    } else {
      await runAction(
        () => BidService.placeBid(user, vehicles, order, checked.data),
        'Отклик отправлен — заказчик увидит ваше предложение',
      );
    }
  };

  const withdrawBid = async () => {
    if (!order?.myBid) return;
    if (await confirmAction('Отозвать отклик?', 'Заказчик больше не увидит ваше предложение', 'Отозвать')) {
      void runAction(() => BidService.withdrawBid(order.myBid!.id), 'Отклик отозван');
    }
  };

  const acceptBid = async (bidId: string) => {
    const bid = order?.bids.find((b) => b.id === bidId);
    if (!bid) return;
    const confirmed = await confirmAction(
      'Выбрать исполнителя?',
      `${bid.driver.fullName} за ${formatPrice(bid.price)}. Остальные отклики будут отклонены.`,
      'Выбрать',
    );
    if (confirmed)
      void runAction(() => BidService.acceptBid(bidId), 'Исполнитель выбран. Оплатите заказ на экране рейса');
  };

  const rejectBid = async (bidId: string) => {
    if (await confirmAction('Отклонить отклик?', 'Водитель увидит, что предложение отклонено', 'Отклонить')) {
      void runAction(() => BidService.rejectBid(bidId), 'Отклик отклонён');
    }
  };

  /** Изменение и удаление — только своей заявки, пока на неё нет откликов. */
  const canEditOrder = Boolean(order && isClient && canEdit(order));
  const deleteOrder = async () => {
    if (!order) return;
    const confirmed = await confirmAction(
      'Удалить заявку?',
      'Заявка будет удалена без возможности восстановления',
      'Удалить',
    );
    if (!confirmed) return;
    try {
      await OrderService.deleteOrder(order);
      showToast('Заявка удалена');
      router.back();
    } catch (e) {
      notify('Не получилось', errorMessage(e));
    }
  };

  return {
    ...base,
    canEditOrder,
    canDeleteOrder: Boolean(order && isClient && canDelete(order)),
    editOrder: () => router.push(`/order/edit/${orderId}`),
    deleteOrder,
    isDriverRole,
    vehicles,
    compatibility,
    hasVehicles: vehicles.length > 0,
    canBid: Boolean(order && isDriverRole && isOpenForBids(order) && user.verification === 'verified'),
    needsVerification: isDriverRole && user.verification !== 'verified',
    isBiddingOpen: Boolean(order && isOpenForBids(order)),
    showBidsList: Boolean(order && isClient && order.bids.length > 0),
    bidForm,
    bidErrors,
    setBidField,
    submitBid,
    withdrawBid,
    acceptBid,
    rejectBid,
    hasTrip: Boolean(order && order.driverId && order.status !== 'Created' && order.status !== 'Bidding'),
    openTracking: () => router.push(`/tracking/${orderId}`),
    openVerification: () => router.push('/verification'),
    addVehicle: () => router.push('/vehicle/new'),
  };
}

// ------------------------------------------------- TrackingViewModel ---

export function useTrackingViewModel(orderId: string) {
  const base = useOrderBase(orderId);
  const { order, isClient, isAssignedDriver, runAction } = base;
  const [uploadingStage, setUploadingStage] = useState<PhotoStage | null>(null);

  const nextStep = order && isAssignedDriver ? driverNextStep(order, order.photos) : null;

  /** UC-15: смена статуса рейса. */
  const advanceStatus = async () => {
    if (!order || nextStep?.kind !== 'status') return;
    if (await confirmAction(nextStep.label, 'Заказчик увидит новый статус рейса', 'Подтвердить')) {
      void runAction(() => TrackingService.advanceStatus(order), 'Статус рейса обновлён');
    }
  };

  /** UC-17: фотофиксация груза. */
  const uploadPhoto = async (stage: PhotoStage) => {
    if (!order) return;
    const source = await chooseImageSource();
    if (!source) return;
    setUploadingStage(stage);
    try {
      await runAction(async () => {
        const base64 = await pickImage(source);
        if (base64) {
          await TrackingService.uploadPhotoReport(order.id, stage, base64);
          showToast('Фото загружено');
        }
      });
    } finally {
      setUploadingStage(null);
    }
  };

  /** UC-12/13: безопасная сделка (демо без платёжного шлюза). */
  const payOrder = async (o: OrderDetailsDTO) => {
    const confirmed = await confirmAction(
      'Оплатить заказ',
      `${formatPrice(o.price)} будут заморожены на счёте безопасной сделки и переведены водителю только после приёмки груза.\n\n(Демо-режим: платёжный шлюз подключается на следующем этапе.)`,
      'Оплатить',
    );
    if (confirmed) void runAction(() => OrderService.payOrder(o), 'Оплата заморожена до приёмки груза');
  };

  /** UC-18 */
  const confirmDelivery = async (o: OrderDetailsDTO) => {
    const confirmed = await confirmAction(
      'Подтвердить приёмку груза?',
      'Груз получен без повреждений. Средства будут переведены водителю.',
      'Подтвердить',
    );
    if (confirmed)
      void runAction(() => OrderService.confirmDelivery(o), 'Приёмка подтверждена, средства переведены водителю');
  };

  return {
    ...base,
    nextStep,
    advanceStatus,
    uploadPhoto,
    uploadingStage,
    canUploadPhoto: (stage: PhotoStage) =>
      Boolean(order && isAssignedDriver && order.status === (stage === 'Loading' ? 'Loading' : 'Unloading')),
    canPay: Boolean(order && isClient && canPay(order)),
    payOrder: () => order && payOrder(order),
    canConfirmDelivery: Boolean(order && isClient && canConfirmDelivery(order, order.photos)),
    confirmDelivery: () => order && confirmDelivery(order),
    openOrder: () => router.push(`/order/${orderId}`),
  };
}
