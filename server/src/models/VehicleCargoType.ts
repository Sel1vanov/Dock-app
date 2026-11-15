import { PrimaryKeyProp } from '@mikro-orm/core';
import { Entity, ManyToOne } from '@mikro-orm/decorators/es';

import { CargoType } from './CargoType.js';
import { Vehicle } from './Vehicle.js';

// промежуточная таблица N:M между ТС и типами груза. составной PK
// (vehicle_id, cargo_type_code) не дает добавить один тип дважды
//  - удалили ТС -> его строки тоже удаляются (CASCADE)
//  - тип груза, который кто-то возит, удалить нельзя (RESTRICT)
@Entity({ tableName: 'vehicle_cargo_types' })
export class VehicleCargoType {
  [PrimaryKeyProp]?: ['vehicle', 'cargoType'];

  @ManyToOne(() => Vehicle, { primary: true, deleteRule: 'cascade' })
  vehicle!: Vehicle;

  @ManyToOne(() => CargoType, { primary: true, deleteRule: 'restrict' })
  cargoType!: CargoType;
}
