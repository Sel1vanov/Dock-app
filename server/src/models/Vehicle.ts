import { Collection, DecimalType, type Opt } from '@mikro-orm/core';
import { Check, Entity, Enum, Index, ManyToMany, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es';

import { CargoType } from './CargoType.js';
import { VehicleType } from './enums.js';
import { User } from './User.js';
import { VehicleCargoType } from './VehicleCargoType.js';

/** Транспорт водителя с габаритно-весовыми характеристиками (SAD 5, класс Vehicle). */
@Entity({ tableName: 'vehicles' })
@Check({ name: 'ck_vehicles_max_weight', expression: 'max_weight_kg > 0 and max_weight_kg <= 200000' })
@Check({
  name: 'ck_vehicles_dimensions',
  expression: 'length_m > 0 and length_m <= 40 and width_m > 0 and width_m <= 6 and height_m > 0 and height_m <= 8',
})
export class Vehicle {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  /** Удаление водителя удаляет и его ТС: без владельца запись о машине не имеет смысла. */
  @Index({ name: 'idx_vehicles_driver' })
  @ManyToOne(() => User, { deleteRule: 'cascade' })
  driver!: User;

  @Enum({ items: () => VehicleType, fieldName: 'vehicle_type' })
  type!: VehicleType;

  @Property({ type: 'string', length: 80, nullable: true })
  model: string | null = null;

  @Property({ type: new DecimalType('number'), precision: 10, scale: 2 })
  maxWeightKg!: number;

  @Property({ type: new DecimalType('number'), precision: 5, scale: 2 })
  lengthM!: number;

  @Property({ type: new DecimalType('number'), precision: 5, scale: 2 })
  widthM!: number;

  @Property({ type: new DecimalType('number'), precision: 5, scale: 2 })
  heightM!: number;

  /** N:M «какие типы грузов возит ТС» через промежуточную таблицу vehicle_cargo_types. */
  @ManyToMany(() => CargoType, undefined, { pivotEntity: () => VehicleCargoType, owner: true })
  cargoTypes = new Collection<CargoType>(this);

  @Property({ type: 'datetime', defaultRaw: 'now()' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'datetime', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();
}
