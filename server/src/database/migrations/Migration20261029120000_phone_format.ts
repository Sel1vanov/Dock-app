import { Migration } from '@mikro-orm/migrations';

/**
 * Миграция 4: единый формат телефона.
 * Раньше номер сохранялся так, как его ввели (89161234567, 9161234567, +79161234567),
 * теперь — всегда «+7» и 10 цифр. Существующие номера приводятся к этому виду,
 * ограничение ck_users_phone_format ужесточается.
 */
export class Migration20261029120000_phone_format extends Migration {
  override name = 'Migration20261029120000_phone_format';

  override up(): void {
    this.addSql(`update "users" set "phone" = '+7' || right(regexp_replace("phone", '\\D', '', 'g'), 10)
      where regexp_replace("phone", '\\D', '', 'g') ~ '^[78]?[0-9]{10}$';`);
    this.addSql(`alter table "users" drop constraint "ck_users_phone_format";`);
    // NOT VALID + проверка ниже: если в базе остался номер не из России, миграция не падает,
    // а новые и изменённые строки всё равно проверяются
    this.addSql(`alter table "users"
      add constraint "ck_users_phone_format" check (phone ~ '^\\+7[0-9]{10}$') not valid;`);
    this.addSql(`do $$ begin
      if not exists (select 1 from "users" where "phone" !~ '^\\+7[0-9]{10}$') then
        alter table "users" validate constraint "ck_users_phone_format";
      end if;
    end $$;`);
  }

  override down(): void {
    this.addSql(`alter table "users" drop constraint "ck_users_phone_format";`);
    this.addSql(`alter table "users" add constraint "ck_users_phone_format" check (phone ~ '^\\+?[0-9]{10,15}$');`);
  }
}
