import { Migration } from '@mikro-orm/migrations';

/**
 * Миграция 2 — изменение существующей схемы:
 *  1. Верификация водителя: флаг users.is_verified заменён статусом verification_status
 *     (none → pending → verified/rejected) с датой и автором решения. Данные переносятся:
 *     is_verified = true становится 'verified'.
 *  2. Новая таблица verification_documents — сканы паспорта, ВУ и СТС (UC-01).
 *  3. Поиск заявок по тексту: расширение pg_trgm и GIN-индекс для ILIKE '%…%'.
 */
export class Migration20261028110000_verification_and_search extends Migration {
  override name = 'Migration20261028110000_verification_and_search';

  override up(): void {
    // 1. Статус верификации вместо логического флага (с переносом данных)
    this.addSql(`alter table "users"
      add column "verification_status" text not null default 'none',
      add column "verified_at" timestamptz null,
      add column "verified_by_id" uuid null;`);
    this.addSql(
      `update "users" set "verification_status" = 'verified', "verified_at" = "updated_at" where "is_verified";`,
    );
    this.addSql(`alter table "users" drop column "is_verified";`);
    this.addSql(`alter table "users"
      add constraint "users_verification_status_check" check ("verification_status" in ('none', 'pending', 'verified', 'rejected')),
      add constraint "ck_users_verification_driver_only" check (role = 'Driver' or verification_status = 'none'),
      add constraint "users_verified_by_id_foreign" foreign key ("verified_by_id") references "users" ("id") on delete set null;`);
    // Очередь модерации: только заявки «на проверке»
    this.addSql(
      `create index "idx_users_verification_pending" on "users" ("updated_at") where verification_status = 'pending';`,
    );

    // 2. Документы для верификации
    this.addSql(`create table "verification_documents" (
      "id" uuid not null default gen_random_uuid(),
      "user_id" uuid not null,
      "doc_type" text not null,
      "file_key" varchar(255) not null,
      "uploaded_at" timestamptz not null default now(),
      constraint "verification_documents_pkey" primary key ("id"),
      constraint "uk_verification_documents_user_type" unique ("user_id", "doc_type"),
      constraint "uk_verification_documents_file_key" unique ("file_key"),
      constraint "verification_documents_doc_type_check" check ("doc_type" in ('passport', 'license', 'sts')),
      constraint "verification_documents_user_id_foreign" foreign key ("user_id") references "users" ("id") on delete cascade
    );`);
    this.addSql(`alter table "verification_documents" enable row level security;`);

    // 3. Триграммный индекс для поиска (в Supabase расширения принято ставить в схему extensions)
    this.addSql(`do $$
      begin
        if exists (select 1 from pg_namespace where nspname = 'extensions') then
          create extension if not exists pg_trgm with schema extensions;
        else
          create extension if not exists pg_trgm;
        end if;
      end $$;`);
    this.addSql(`create index "idx_orders_search_trgm" on "orders" using gin
      ((coalesce(description, '') || ' ' || origin_address || ' ' || destination_address) gin_trgm_ops);`);
  }

  override down(): void {
    this.addSql(`drop index if exists "idx_orders_search_trgm";`);
    this.addSql(`drop table if exists "verification_documents";`);
    this.addSql(`drop index if exists "idx_users_verification_pending";`);
    this.addSql(`alter table "users" add column "is_verified" boolean not null default false;`);
    this.addSql(`update "users" set "is_verified" = ("verification_status" = 'verified');`);
    this.addSql(`alter table "users"
      drop constraint if exists "users_verified_by_id_foreign",
      drop constraint if exists "ck_users_verification_driver_only",
      drop constraint if exists "users_verification_status_check",
      drop column "verified_by_id",
      drop column "verified_at",
      drop column "verification_status";`);
  }
}
