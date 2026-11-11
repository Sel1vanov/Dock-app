import { Migration } from '@mikro-orm/migrations';

/**
 * Миграция 6: один номер телефона — один аккаунт (уникальное ограничение uk_users_phone).
 * Раньше на один номер можно было зарегистрировать несколько аккаунтов — так заблокированный
 * пользователь заводил новый с другим email.
 *
 * Если в базе уже есть аккаунты с одинаковым телефоном, миграция останавливается с понятным
 * сообщением и ничего не меняет: какой из аккаунтов оставить, решает человек.
 */
export class Migration20261111100000_unique_phone extends Migration {
  override name = 'Migration20261111100000_unique_phone';

  override up(): void {
    this.addSql(`do $$
    declare duplicates text;
    begin
      select string_agg(phone || ' (' || emails || ')', '; ') into duplicates
      from (
        select phone, string_agg(email, ', ' order by created_at) as emails
        from "users" group by phone having count(*) > 1
      ) d;
      if duplicates is not null then
        raise exception 'На один телефон зарегистрировано несколько аккаунтов: %. Оставьте у каждого номера один аккаунт (или верните демо-данные: npm run db:reset) и запустите снова', duplicates;
      end if;
    end $$;`);
    this.addSql(`alter table "users" add constraint "uk_users_phone" unique ("phone");`);
  }

  override down(): void {
    this.addSql(`alter table "users" drop constraint "uk_users_phone";`);
  }
}
