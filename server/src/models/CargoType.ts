import { type Opt, PrimaryKeyProp } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';

// справочник типов груза (Vision 4.2: выбор категории груза по иконкам)
// PK - код ('Machinery', 'Car' ...): он не меняется, читается в api и не нужен join,
// чтобы понять, что за тип. строки справочника создает первая миграция
@Entity({ tableName: 'cargo_types' })
export class CargoType {
  [PrimaryKeyProp]?: 'code';

  @PrimaryKey({ type: 'string', length: 32 })
  code!: string;

  @Unique({ name: 'uk_cargo_types_name' })
  @Property({ type: 'string', length: 64 })
  name!: string;

  @Property({ type: 'smallint', default: 0 })
  sortOrder: Opt<number> = 0;
}
