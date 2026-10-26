/**
 * OrderViewModel (SAD 5.2): создание заявок, списки заказов, лента водителя с фильтрацией.
 * Разбит на отдельные хуки по экранам; общий у них — OrderService.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { oversizeReasons } from '../models/domain';
import type { CargoType, DimensionsDTO, VehicleDTO } from '../models/dto';
import { type CreateOrderForm, type FieldErrors, createOrderSchema, validate } from '../models/schemas';
import { BidService } from '../services/BidService';
import { OrderService } from '../services/OrderService';
import { VehicleService } from '../services/VehicleService';
import { useCurrentUser } from './AuthViewModel';
import { useAction, useQuery } from './useAsync';

// --------------------------------------------------------- Заказчик ---

export function useClientOrdersViewModel() {
  const user = useCurrentUser();
  const query = useQuery(() => OrderService.getClientOrders(user.id), [user.id]);
  const orders = query.data ?? [];
  const [filter, setFilter] = useState<'active' | 'archive'>('active');

  const visible = useMemo(
    () =>
      orders.filter((o) =>
        filter === 'active'
          ? o.status !== 'Completed' && o.status !== 'Cancelled'
          : o.status === 'Completed' || o.status === 'Cancelled',
      ),
    [orders, filter],
  );

  return {
    ...query,
    user,
    orders: visible,
    filter,
    setFilter,
    activeCount: orders.filter((o) => o.status !== 'Completed' && o.status !== 'Cancelled').length,
    openOrder: (id: string) => router.push(`/order/${id}`),
  };
}

const EMPTY_ORDER: CreateOrderForm = {
  type: 'Machinery',
  description: '',
  lengthM: '',
  widthM: '',
  heightM: '',
  weightT: '',
  origin: '',
  destination: '',
  price: '',
};

/** OrderCreateScreen: UC-03, UC-04 (габариты и вес), UC-05 (пока адресами, карта — следующий этап). */
export function useOrderCreateViewModel() {
  const user = useCurrentUser();
  const [values, setValues] = useState<CreateOrderForm>(EMPTY_ORDER);
  const [errors, setErrors] = useState<FieldErrors<CreateOrderForm>>({});
  const action = useAction(OrderService.createOrder);

  const setField = <K extends keyof CreateOrderForm>(key: K, value: CreateOrderForm[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  /** Предпросмотр габаритов, пока форма заполняется: подсказка про негабарит. */
  const preview = useMemo(() => {
    const n = (s: string) => Number(s.replace(',', '.'));
    const dims: DimensionsDTO = {
      lengthM: n(values.lengthM),
      widthM: n(values.widthM),
      heightM: n(values.heightM),
      weightT: n(values.weightT),
    };
    const complete = Object.values(dims).every((x) => Number.isFinite(x) && x > 0);
    return { dims, complete, oversize: complete ? oversizeReasons(dims) : [] };
  }, [values.lengthM, values.widthM, values.heightM, values.weightT]);

  const submit = async () => {
    const checked = validate(createOrderSchema, values);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    const ok = await action.run(user.id, checked.data);
    if (ok) {
      setValues(EMPTY_ORDER);
      router.navigate('/orders');
    }
  };

  return {
    values,
    errors,
    preview,
    setField,
    setCargoType: (type: CargoType) => setField('type', type),
    submit,
    isSubmitting: action.isRunning,
    submitError: action.error,
  };
}

// ---------------------------------------------------------- Водитель ---

/** OrderFeedScreen: UC-08 + UC-09 — лента под выбранное ТС. */
export function useOrderFeedViewModel() {
  const user = useCurrentUser();
  const vehiclesQuery = useQuery(() => VehicleService.getMyVehicles(user.id), [user.id]);
  const vehicles = vehiclesQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedVehicle: VehicleDTO | null = vehicles.find((v) => v.id === selectedId) ?? vehicles[0] ?? null;

  const feedQuery = useQuery(selectedVehicle ? () => OrderService.getFeed(selectedVehicle) : null, [
    selectedVehicle?.id,
  ]);

  return {
    user,
    vehicles,
    selectedVehicle,
    selectVehicle: setSelectedId,
    orders: feedQuery.data?.orders ?? [],
    hiddenCount: feedQuery.data?.hiddenCount ?? 0,
    isLoading: vehiclesQuery.isLoading || (Boolean(selectedVehicle) && feedQuery.isLoading),
    isRefreshing: feedQuery.isRefreshing || vehiclesQuery.isRefreshing,
    error: vehiclesQuery.error ?? feedQuery.error,
    refresh: async () => {
      await Promise.all([vehiclesQuery.refresh(), feedQuery.refresh()]);
    },
    canBid: user.verification === 'verified',
    openOrder: (id: string) => router.push(`/order/${id}`),
    addVehicle: () => router.push('/vehicle/new'),
    openVerification: () => router.push('/verification'),
  };
}

/** Вкладка «Мои рейсы»: назначенные рейсы и отправленные отклики. */
export function useDriverTripsViewModel() {
  const user = useCurrentUser();
  const [tab, setTab] = useState<'trips' | 'bids'>('trips');
  const trips = useQuery(() => OrderService.getDriverTrips(user.id), [user.id]);
  const bids = useQuery(() => BidService.getMyBids(user.id), [user.id]);

  const active = (trips.data ?? []).filter((o) => o.status !== 'Completed' && o.status !== 'Cancelled');
  const finished = (trips.data ?? []).filter((o) => o.status === 'Completed' || o.status === 'Cancelled');
  const pendingBids = (bids.data ?? []).filter((b) => b.status === 'Pending');

  return {
    tab,
    setTab,
    activeTrips: active,
    finishedTrips: finished,
    bids: bids.data ?? [],
    pendingBidsCount: pendingBids.length,
    isLoading: trips.isLoading || bids.isLoading,
    isRefreshing: trips.isRefreshing || bids.isRefreshing,
    error: trips.error ?? bids.error,
    refresh: async () => {
      await Promise.all([trips.refresh(), bids.refresh()]);
    },
    openTrip: (id: string) => router.push(`/tracking/${id}`),
    openOrder: (id: string) => router.push(`/order/${id}`),
  };
}
