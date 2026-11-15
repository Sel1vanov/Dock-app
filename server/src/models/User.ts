import { Collection, type Opt } from '@mikro-orm/core';
import {
  Check,
  Entity,
  Enum,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/es';

import { UserRole, VerificationStatus } from './enums.js';
import { Vehicle } from './Vehicle.js';
import { VerificationDocument } from './VerificationDocument.js';

// пользователь: заказчик, водитель или админ (SAD 5, класс User)
// пароль лежит только как bcrypt-хеш. поле скрыто при сериализации и по умолчанию не выбирается
// из базы (lazy) - его явно запрашивает только логин
@Entity({ tableName: 'users' })
@Check({
  name: 'ck_users_email_format',
  expression: `email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'`,
})
@Check({ name: 'ck_users_full_name', expression: 'char_length(btrim(full_name)) >= 2' })
@Check({ name: 'ck_users_phone_format', expression: `phone ~ '^\\+7[0-9]{10}$'` })
@Check({ name: 'ck_users_verification_driver_only', expression: `role = 'Driver' or verification_status = 'none'` })
// очередь модерации у админа: WHERE verification_status = 'pending' ORDER BY updated_at
@Index({ name: 'idx_users_verification_pending', properties: ['updatedAt'], where: `verification_status = 'pending'` })
export class User {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Unique({ name: 'uk_users_email' })
  @Property({ type: 'string', length: 254 })
  email!: string;

  @Property({ type: 'string', length: 100, hidden: true, lazy: true })
  passwordHash!: string;

  @Enum({ items: () => UserRole, default: UserRole.Client })
  role: Opt<UserRole> = UserRole.Client;

  @Property({ type: 'string', length: 100 })
  fullName!: string;

  // один номер - один аккаунт, чтобы заблокированный не завел второй на тот же телефон
  @Unique({ name: 'uk_users_phone' })
  @Property({ type: 'string', length: 20 })
  phone!: string;

  // проверку документов проходят только водители (UC-01, UC-02)
  @Enum({ items: () => VerificationStatus, default: VerificationStatus.None })
  verificationStatus: Opt<VerificationStatus> = VerificationStatus.None;

  @Property({ type: 'datetime', nullable: true })
  verifiedAt: Date | null = null;

  // админ, который принял решение. если его аккаунт удалят - решение останется (SET NULL)
  @ManyToOne(() => User, { nullable: true, deleteRule: 'set null' })
  verifiedBy: User | null = null;

  @Property({ type: 'boolean', default: false })
  isBlocked: Opt<boolean> = false;

  // когда последний раз меняли пароль. токены, выданные раньше, больше не принимаются
  @Property({ type: 'datetime', nullable: true })
  passwordChangedAt: Date | null = null;

  @Property({ type: 'datetime', defaultRaw: 'now()' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'datetime', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  @OneToMany(() => Vehicle, (v) => v.driver)
  vehicles = new Collection<Vehicle>(this);

  @OneToMany(() => VerificationDocument, (d) => d.user)
  documents = new Collection<VerificationDocument>(this);
}
