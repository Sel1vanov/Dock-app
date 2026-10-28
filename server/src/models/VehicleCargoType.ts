import { PrimaryKeyProp } from '@mikro-orm/core';
import { Entity, ManyToOne } from '@mikro-orm/decorators/es';

import { CargoType } from './CargoType.js';
import { Vehicle } from './Vehicle.js';

/**
 * Промежуточная таблица связи N:M «ТС ↔ типы груза». Составной первичный ключ
 * (vehicle_id, cargo_type_code) не даёт добавить один тип дважды.
 *  - ТС удалено → его строки удаляются (CASCADE);
 *  - тип груза, который кто-то возит, удалить нельзя (RESTRICT).
 */
@Entity({ tableName: 'vehicle_cargo_types', rowLevelSecurity: true })
export class VehicleCargoType {
  [PrimaryKeyProp]?: ['vehicle', 'cargoType'];

  @ManyToOne(() => Vehicle, { primary: true, deleteRule: 'cascade' })
  vehicle!: Vehicle;

  @ManyToOne(() => CargoType, { primary: true, deleteRule: 'restrict' })
  cargoType!: CargoType;
}
