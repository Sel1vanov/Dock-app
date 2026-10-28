import { type Opt, PrimaryKeyProp } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';

/**
 * Справочник типов груза (Vision 4.2: выбор категорий груза по иконкам).
 * Первичный ключ — неизменяемый код ('Machinery', 'Car' …): он стабилен, читаем в API
 * и не требует соединения с таблицей, чтобы понять, о каком типе речь.
 * Строки справочника создаёт начальная миграция.
 */
@Entity({ tableName: 'cargo_types', rowLevelSecurity: true })
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
