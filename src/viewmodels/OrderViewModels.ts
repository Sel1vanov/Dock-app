/**
 * OrderViewModel (SAD 5.2): создание и изменение заявок, списки заказов, лента водителя.
 * Поиск, фильтры и сортировка выполняются на сервере; списки грузятся страницами.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { ApiError } from '../core/errors';
import { showToast } from '../core/toast';
import { oversizeReasons } from '../models/domain';
import type { CargoType, DimensionsDTO, OrderSort, VehicleDTO } from '../models/dto';
import { type CreateOrderForm, type FieldErrors, createOrderSchema, validate } from '../models/schemas';
import { BidService } from '../services/BidService';
import { OrderService } from '../services/OrderService';
import { VehicleService } from '../services/VehicleService';
import { useCurrentUser } from './AuthViewModel';
import { useAction, useDebouncedValue, usePagedQuery, useQuery } from './useAsync';

/** Общие для списков параметры поиска, фильтра и сортировки. */
function useListFilters() {
  const [search, setSearch] = useState('');
  const [cargoType, setCargoType] = useState<CargoType | null>(null);
  const [sort, setSort] = useState<OrderSort>('-createdAt');
  const q = useDebouncedValue(search.trim());
  return {
    search,
    setSearch,
    cargoType,
    setCargoType,
    sort,
    setSort,
    params: { q: q || undefined, cargoType, sort },
    hasFilters: Boolean(q) || cargoType !== null,
    reset: () => {
      setSearch('');
      setCargoType(null);
    },
  };
}

// --------------------------------------------------------- Заказчик ---

export function useClientOrdersViewModel() {
  const user = useCurrentUser();
  const filters = useListFilters();
  const [status, setStatus] = useState<'active' | 'archive'>('active');
  const list = usePagedQuery(
    (offset) => OrderService.getMyOrders(status, filters.params, offset),
    [status, filters.params.q, filters.params.cargoType, filters.params.sort],
  );

  return {
    ...list,
    user,
    filters,
    status,
    setStatus,
    openOrder: (id: string) => router.push(`/order/${id}`),
    createOrder: () => router.navigate('/create'),
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

const num = (n: number) => String(Number(n.toFixed(3))).replace('.', ',');

/**
 * Форма заявки: создание (UC-03, UC-04, UC-05 адресами) и изменение (пока нет откликов).
 * orderId передаётся только при изменении.
 */
export function useOrderFormViewModel(orderId?: string) {
  const isEdit = Boolean(orderId);
  const [values, setValues] = useState<CreateOrderForm>(EMPTY_ORDER);
  const [errors, setErrors] = useState<FieldErrors<CreateOrderForm>>({});
  const existing = useQuery(orderId ? () => OrderService.getOrderDetails(orderId) : null, [orderId]);

  // Форма изменения заполняется данными заявки один раз, когда они загрузились.
  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  const o = existing.data;
  if (o && filledFrom !== o.id) {
    setFilledFrom(o.id);
    setValues({
      type: o.cargo.type,
      description: o.cargo.description ?? '',
      lengthM: num(o.cargo.lengthM),
      widthM: num(o.cargo.widthM),
      heightM: num(o.cargo.heightM),
      weightT: num(o.cargo.weightT),
      origin: o.origin,
      destination: o.destination,
      price: String(Math.round(o.price)),
    });
  }

  const action = useAction(async (data: Parameters<typeof OrderService.createOrder>[0]) => {
    try {
      if (existing.data) {
        await OrderService.updateOrder(existing.data, data);
        showToast('Изменения сохранены');
        router.back();
      } else {
        await OrderService.createOrder(data);
        setValues(EMPTY_ORDER);
        showToast('Заявка опубликована — водители увидят её в ленте');
        router.navigate('/orders');
      }
    } catch (e) {
      if (e instanceof ApiError) setErrors(mapServerFields(e.fieldErrors));
      throw e;
    }
  });

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
    // Обязательные поля и диапазоны проверяются до отправки запроса.
    const checked = validate(createOrderSchema, values);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    await action.run(checked.data);
  };

  return {
    isEdit,
    isLoading: existing.isLoading,
    loadError: existing.error,
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

/** Имена полей API → имена полей формы, чтобы ошибка сервера подсветила нужное поле. */
function mapServerFields(fields: Record<string, string>): FieldErrors<CreateOrderForm> {
  const map: Record<string, keyof CreateOrderForm> = {
    cargoTypeCode: 'type',
    weightKg: 'weightT',
    originAddress: 'origin',
    destinationAddress: 'destination',
  };
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [map[k] ?? k, v]));
}

// ---------------------------------------------------------- Водитель ---

/** OrderFeedScreen: UC-08 + UC-09 — лента под выбранное ТС с поиском и сортировкой. */
export function useOrderFeedViewModel() {
  const user = useCurrentUser();
  const vehiclesQuery = useQuery(() => VehicleService.getMyVehicles(), [user.id]);
  const vehicles = vehiclesQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedVehicle: VehicleDTO | null = vehicles.find((v) => v.id === selectedId) ?? vehicles[0] ?? null;
  const filters = useListFilters();

  const feed = usePagedQuery(
    selectedVehicle ? (offset) => OrderService.getFeed(selectedVehicle, filters.params, offset) : null,
    [selectedVehicle?.id, filters.params.q, filters.params.cargoType, filters.params.sort],
  );

  return {
    ...feed,
    user,
    filters,
    vehicles,
    selectedVehicle,
    selectVehicle: setSelectedId,
    hiddenCount: feed.lastPage?.hiddenCount ?? 0,
    isLoading: vehiclesQuery.isLoading || (Boolean(selectedVehicle) && feed.isLoading),
    isRefreshing: feed.isRefreshing || vehiclesQuery.isRefreshing,
    error: vehiclesQuery.error ?? feed.error,
    refresh: async () => {
      await Promise.all([vehiclesQuery.refresh(), feed.refresh()]);
    },
    canBid: user.verification === 'verified',
    openOrder: (id: string) => router.push(`/order/${id}`),
    addVehicle: () => router.push('/vehicle/new'),
    openVerification: () => router.push('/verification'),
  };
}

/** Вкладка «Мои рейсы»: назначенные рейсы (постранично) и отправленные отклики. */
export function useDriverTripsViewModel() {
  const [tab, setTab] = useState<'trips' | 'bids'>('trips');
  const [status, setStatus] = useState<'active' | 'archive'>('active');
  const trips = usePagedQuery((offset) => OrderService.getMyOrders(status, { sort: '-createdAt' }, offset), [status]);
  const bids = useQuery(() => BidService.getMyBids(), []);
  const pendingBids = (bids.data ?? []).filter((b) => b.status === 'Pending');

  return {
    tab,
    setTab,
    status,
    setStatus,
    trips,
    bids: bids.data ?? [],
    pendingBidsCount: pendingBids.length,
    isLoading: tab === 'trips' ? trips.isLoading : bids.isLoading,
    isRefreshing: trips.isRefreshing || bids.isRefreshing,
    error: tab === 'trips' ? trips.error : bids.error,
    refresh: async () => {
      await Promise.all([trips.refresh(), bids.refresh()]);
    },
    openTrip: (id: string) => router.push(`/tracking/${id}`),
    openOrder: (id: string) => router.push(`/order/${id}`),
  };
}
