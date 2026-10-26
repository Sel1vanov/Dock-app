import type { BidStatus, CargoType, OrderStatus, VehicleType } from './dto';

/** Справочники: русские подписи и иконки (MaterialCommunityIcons) для перечислений БД. */

export const CARGO_TYPES: { value: CargoType; label: string; icon: string }[] = [
  { value: 'Car', label: 'Автомобиль', icon: 'car-side' },
  { value: 'Container', label: 'Контейнер', icon: 'truck-cargo-container' },
  { value: 'Machinery', label: 'Спецтехника', icon: 'excavator' },
  { value: 'Agricultural', label: 'Сельхозтехника', icon: 'tractor' },
  { value: 'Equipment', label: 'Оборудование', icon: 'factory' },
  { value: 'Other', label: 'Другое', icon: 'package-variant-closed' },
];

export const VEHICLE_TYPES: { value: VehicleType; label: string; icon: string }[] = [
  { value: 'Trawl', label: 'Трал', icon: 'truck-flatbed' },
  { value: 'Manipulator', label: 'Манипулятор', icon: 'crane' },
  { value: 'TowTruck', label: 'Эвакуатор', icon: 'tow-truck' },
  { value: 'Flatbed', label: 'Бортовой', icon: 'truck' },
  { value: 'Other', label: 'Другое', icon: 'truck-outline' },
];

export function cargoTypeInfo(type: CargoType) {
  return CARGO_TYPES.find((c) => c.value === type) ?? CARGO_TYPES[CARGO_TYPES.length - 1];
}

export function vehicleTypeInfo(type: VehicleType) {
  return VEHICLE_TYPES.find((v) => v.value === type) ?? VEHICLE_TYPES[VEHICLE_TYPES.length - 1];
}

export type StatusTone = 'info' | 'warning' | 'progress' | 'success' | 'muted' | 'danger';

/** Подпись статуса заказа так, как она описана в Vision (статусная модель водителя). */
export function orderStatusInfo(
  status: OrderStatus,
  isEscrowLocked: boolean,
): { label: string; tone: StatusTone; icon: string } {
  switch (status) {
    case 'Created':
      return { label: 'Поиск исполнителя', tone: 'info', icon: 'magnify' };
    case 'Bidding':
      return { label: 'Идёт торг', tone: 'info', icon: 'handshake' };
    case 'Assigned':
      return isEscrowLocked
        ? { label: 'Оплачен · ожидает погрузки', tone: 'progress', icon: 'cash-lock' }
        : { label: 'Ожидает оплаты', tone: 'warning', icon: 'cash' };
    case 'Loading':
      return { label: 'Прибыл на погрузку', tone: 'progress', icon: 'package-up' };
    case 'InTransit':
      return { label: 'В пути', tone: 'progress', icon: 'truck-fast' };
    case 'Unloading':
      return { label: 'Прибыл на выгрузку', tone: 'progress', icon: 'package-down' };
    case 'Completed':
      return { label: 'Завершён', tone: 'success', icon: 'check-circle' };
    case 'Cancelled':
      return { label: 'Отменён', tone: 'muted', icon: 'close-circle' };
    case 'Disputed':
      return { label: 'Открыт спор', tone: 'danger', icon: 'alert-circle' };
  }
}

export function bidStatusInfo(status: BidStatus): { label: string; tone: StatusTone } {
  switch (status) {
    case 'Pending':
      return { label: 'Ожидает ответа', tone: 'info' };
    case 'Accepted':
      return { label: 'Выбран исполнителем', tone: 'success' };
    case 'Rejected':
      return { label: 'Отклонён', tone: 'muted' };
  }
}
