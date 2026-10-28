/**
 * Доменные правила (концептуальные операции классов из SAD, раздел 5):
 * Vehicle.checkCompatibility(), статусная модель Order и права участников.
 * Чистые функции без обращений к сети — их используют сервисы и ViewModel.
 * Те же правила продублированы в триггерах БД, чтобы их нельзя было обойти.
 */
import type { CargoDTO, DimensionsDTO, OrderStatus, PhotoDTO, PhotoStage, VehicleDTO } from './dto';

// ---------------------------------------------------------------- Vehicle ---

export interface CompatibilityResult {
  ok: boolean;
  issues: string[];
}

/** UC-09: помещается ли груз в ТС по массе и габаритам и возит ли ТС такой тип груза. */
export function checkCompatibility(vehicle: VehicleDTO, cargo: CargoDTO): CompatibilityResult {
  const issues: string[] = [];
  if (!vehicle.cargoTypes.some((c) => c.code === cargo.type)) issues.push(`не возит: ${cargo.typeName.toLowerCase()}`);
  if (cargo.weightT > vehicle.weightT) issues.push(`масса ${fmt(cargo.weightT)} т > ${fmt(vehicle.weightT)} т`);
  if (cargo.lengthM > vehicle.lengthM) issues.push(`длина ${fmt(cargo.lengthM)} м > ${fmt(vehicle.lengthM)} м`);
  if (cargo.widthM > vehicle.widthM) issues.push(`ширина ${fmt(cargo.widthM)} м > ${fmt(vehicle.widthM)} м`);
  if (cargo.heightM > vehicle.heightM) issues.push(`высота ${fmt(cargo.heightM)} м > ${fmt(vehicle.heightM)} м`);
  return { ok: issues.length === 0, issues };
}

/**
 * Предельные габариты без спецразрешения (ПДД РФ, прил. к ОП): ширина 2,55 м, высота 4 м,
 * длина автопоезда 20 м. Груз за этими пределами — негабаритный (Vision, раздел 6; UC-23).
 */
export const LEGAL_LIMITS = { widthM: 2.55, heightM: 4, lengthM: 20 } as const;

export function oversizeReasons(cargo: DimensionsDTO): string[] {
  const reasons: string[] = [];
  if (cargo.widthM > LEGAL_LIMITS.widthM) reasons.push(`ширина больше ${fmt(LEGAL_LIMITS.widthM)} м`);
  if (cargo.heightM > LEGAL_LIMITS.heightM) reasons.push(`высота больше ${fmt(LEGAL_LIMITS.heightM)} м`);
  if (cargo.lengthM > LEGAL_LIMITS.lengthM) reasons.push(`длина больше ${fmt(LEGAL_LIMITS.lengthM)} м`);
  return reasons;
}

// ------------------------------------------------------------------ Order ---

export interface OrderState {
  status: OrderStatus;
  isEscrowLocked: boolean;
}

/** Шаги прогресса заказа для экрана отслеживания (UC-16). */
export const ORDER_TIMELINE: { key: string; label: string }[] = [
  { key: 'published', label: 'Опубликован' },
  { key: 'assigned', label: 'Исполнитель выбран' },
  { key: 'paid', label: 'Оплачен' },
  { key: 'loading', label: 'Погрузка' },
  { key: 'transit', label: 'В пути' },
  { key: 'unloading', label: 'Выгрузка' },
  { key: 'completed', label: 'Завершён' },
];

/** Индекс текущего шага ORDER_TIMELINE (-1 — заказ отменён). */
export function timelineIndex({ status, isEscrowLocked }: OrderState): number {
  switch (status) {
    case 'Created':
    case 'Bidding':
      return 0;
    case 'Assigned':
      return isEscrowLocked ? 2 : 1;
    case 'Loading':
      return 3;
    case 'InTransit':
      return 4;
    case 'Unloading':
      return 5;
    case 'Completed':
      return 6;
    case 'Cancelled':
      return -1;
  }
}

export const isOpenForBids = (s: OrderState) => s.status === 'Created' || s.status === 'Bidding';

export const isActiveTrip = (s: OrderState) =>
  s.status === 'Assigned' || s.status === 'Loading' || s.status === 'InTransit' || s.status === 'Unloading';

/** Изменить или удалить можно только заявку, на которую ещё никто не откликнулся. */
export const canEdit = (s: OrderState) => s.status === 'Created';
export const canDelete = canEdit;

/** UC-07: отменить можно до оплаты. */
export const canCancel = (s: OrderState) => isOpenForBids(s) || (s.status === 'Assigned' && !s.isEscrowLocked);

/** UC-12: оплата после выбора исполнителя. */
export const canPay = (s: OrderState) => s.status === 'Assigned' && !s.isEscrowLocked;

export const hasPhoto = (photos: PhotoDTO[], stage: PhotoStage) => photos.some((p) => p.stage === stage);

/** UC-18: приёмка — после фотофиксации выгрузки. */
export const canConfirmDelivery = (s: OrderState, photos: PhotoDTO[]) =>
  s.status === 'Unloading' && hasPhoto(photos, 'Unloading');

/** Следующее действие водителя по рейсу (UC-15, UC-17). */
export type DriverStep =
  | { kind: 'status'; to: OrderStatus; label: string; hint: string }
  | { kind: 'photo'; stage: PhotoStage; label: string; hint: string }
  | { kind: 'wait'; label: string; hint: string };

export function driverNextStep(s: OrderState, photos: PhotoDTO[]): DriverStep | null {
  switch (s.status) {
    case 'Assigned':
      return s.isEscrowLocked
        ? {
            kind: 'status',
            to: 'Loading',
            label: 'Прибыл на погрузку',
            hint: 'Оплата заморожена — можно ехать за грузом',
          }
        : { kind: 'wait', label: 'Ожидаем оплату', hint: 'Рейс начнётся после оплаты заказчиком (безопасная сделка)' };
    case 'Loading':
      return hasPhoto(photos, 'Loading')
        ? {
            kind: 'status',
            to: 'InTransit',
            label: 'Груз загружен — в путь',
            hint: 'Фотофиксация погрузки прикреплена',
          }
        : {
            kind: 'photo',
            stage: 'Loading',
            label: 'Сфотографировать груз',
            hint: 'Сделайте фото закреплённого груза перед выездом',
          };
    case 'InTransit':
      return { kind: 'status', to: 'Unloading', label: 'Прибыл на выгрузку', hint: 'Отметьте прибытие в точку Б' };
    case 'Unloading':
      return hasPhoto(photos, 'Unloading')
        ? { kind: 'wait', label: 'Ожидаем приёмку', hint: 'Заказчик проверит груз и подтвердит приёмку' }
        : {
            kind: 'photo',
            stage: 'Unloading',
            label: 'Фото выгрузки',
            hint: 'Сфотографируйте выгруженный груз — это цифровой акт',
          };
    default:
      return null;
  }
}

function fmt(n: number) {
  return Number(n.toFixed(2)).toString().replace('.', ',');
}
