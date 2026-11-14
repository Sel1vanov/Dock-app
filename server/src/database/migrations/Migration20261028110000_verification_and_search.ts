import { Migration } from '@mikro-orm/migrations';

// миграция 2 - меняем существующую схему:
//  1. верификация водителя: вместо флага users.is_verified теперь статус verification_status
//     (none -> pending -> verified/rejected) + дата и кто решил. старые данные переносятся:
//     is_verified = true становится 'verified'
//  2. новая таблица verification_documents - сканы паспорта, ВУ и СТС (UC-01)
//  3. поиск заявок по тексту: расширение pg_trgm и GIN-индекс под ILIKE '%...%'
export class Migration20261028110000_verification_and_search extends Migration {
  override name = 'Migration20261028110000_verification_and_search';

  override up(): void {
    // 1. статус верификации вместо bool-флага (с переносом данных)
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
    // очередь модерации - только те, кто на проверке
    this.addSql(
      `create index "idx_users_verification_pending" on "users" ("updated_at") where verification_status = 'pending';`,
    );

    // 2. документы для верификации
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

    // 3. триграммный индекс для поиска
    this.addSql(`create extension if not exists pg_trgm;`);
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
