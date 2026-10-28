import { Migration } from '@mikro-orm/migrations';

/**
 * Миграция 1 — начальная схема Dock: 8 таблиц, связи 1:N, связь N:M через vehicle_cargo_types,
 * ограничения целостности и индексы под запросы API. Применяется к пустой базе.
 *
 * Сгенерирована по ORM-моделям (scripts/schema-sql.ts) и дополнена:
 *  - строками справочника cargo_types (без них нельзя создать ни одной заявки);
 *  - включением Row Level Security: в Supabase таблицы схемы public видны через автоматический
 *    REST (PostgREST). RLS без политик закрывает этот путь — данные доступны только через наш API,
 *    который подключается владельцем таблиц. В обычном PostgreSQL эти команды ни на что не влияют.
 */
export class Migration20261028100000_initial_schema extends Migration {
  override name = 'Migration20261028100000_initial_schema';

  override up(): void {
    // ------------------------------------------------------------ cargo_types (справочник)
    this.addSql(`create table "cargo_types" (
      "code" varchar(32) not null,
      "name" varchar(64) not null,
      "sort_order" smallint not null default 0,
      constraint "cargo_types_pkey" primary key ("code"),
      constraint "uk_cargo_types_name" unique ("name")
    );`);
    this.addSql(`insert into "cargo_types" ("code", "name", "sort_order") values
      ('Car', 'Автомобиль', 1),
      ('Container', 'Контейнер', 2),
      ('Machinery', 'Спецтехника', 3),
      ('Agricultural', 'Сельхозтехника', 4),
      ('Equipment', 'Оборудование', 5),
      ('Other', 'Другое', 6);`);

    // ------------------------------------------------------------------------ users
    this.addSql(`create table "users" (
      "id" uuid not null default gen_random_uuid(),
      "email" varchar(254) not null,
      "password_hash" varchar(100) not null,
      "role" text not null default 'Client',
      "full_name" varchar(100) not null,
      "phone" varchar(20) not null,
      "is_verified" boolean not null default false,
      "is_blocked" boolean not null default false,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      constraint "users_pkey" primary key ("id"),
      constraint "uk_users_email" unique ("email"),
      constraint "users_role_check" check ("role" in ('Client', 'Driver', 'Admin')),
      constraint "ck_users_email_format" check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'),
      constraint "ck_users_full_name" check (char_length(btrim(full_name)) >= 2),
      constraint "ck_users_phone_format" check (phone ~ '^\\+?[0-9]{10,15}$')
    );`);

    // --------------------------------------------------------------------- vehicles
    this.addSql(`create table "vehicles" (
      "id" uuid not null default gen_random_uuid(),
      "driver_id" uuid not null,
      "vehicle_type" text not null,
      "model" varchar(80) null,
      "max_weight_kg" numeric(10,2) not null,
      "length_m" numeric(5,2) not null,
      "width_m" numeric(5,2) not null,
      "height_m" numeric(5,2) not null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      constraint "vehicles_pkey" primary key ("id"),
      constraint "vehicles_vehicle_type_check" check ("vehicle_type" in ('Trawl', 'Manipulator', 'TowTruck', 'Flatbed', 'Other')),
      constraint "ck_vehicles_max_weight" check (max_weight_kg > 0 and max_weight_kg <= 200000),
      constraint "ck_vehicles_dimensions" check (length_m > 0 and length_m <= 40 and width_m > 0 and width_m <= 6 and height_m > 0 and height_m <= 8),
      constraint "vehicles_driver_id_foreign" foreign key ("driver_id") references "users" ("id") on delete cascade
    );`);
    this.addSql(`create index "idx_vehicles_driver" on "vehicles" ("driver_id");`);

    // ---------------------------------------------- vehicle_cargo_types (связь N:M)
    this.addSql(`create table "vehicle_cargo_types" (
      "vehicle_id" uuid not null,
      "cargo_type_code" varchar(32) not null,
      constraint "vehicle_cargo_types_pkey" primary key ("vehicle_id", "cargo_type_code"),
      constraint "vehicle_cargo_types_vehicle_id_foreign" foreign key ("vehicle_id") references "vehicles" ("id") on update cascade on delete cascade,
      constraint "vehicle_cargo_types_cargo_type_code_foreign" foreign key ("cargo_type_code") references "cargo_types" ("code") on update cascade on delete restrict
    );`);

    // ----------------------------------------------------------------------- orders
    this.addSql(`create table "orders" (
      "id" uuid not null default gen_random_uuid(),
      "client_id" uuid not null,
      "driver_id" uuid null,
      "cargo_type_code" varchar(32) not null,
      "description" varchar(500) null,
      "cargo_weight_kg" numeric(10,2) not null,
      "cargo_length_m" numeric(5,2) not null,
      "cargo_width_m" numeric(5,2) not null,
      "cargo_height_m" numeric(5,2) not null,
      "origin_address" varchar(300) not null,
      "destination_address" varchar(300) not null,
      "price" numeric(12,2) not null,
      "status" text not null default 'Created',
      "is_escrow_locked" boolean not null default false,
      "cancel_reason" varchar(300) null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      constraint "orders_pkey" primary key ("id"),
      constraint "orders_status_check" check ("status" in ('Created', 'Bidding', 'Assigned', 'Loading', 'InTransit', 'Unloading', 'Completed', 'Cancelled')),
      constraint "ck_orders_cargo_dimensions" check (cargo_weight_kg > 0 and cargo_length_m > 0 and cargo_width_m > 0 and cargo_height_m > 0),
      constraint "ck_orders_price_positive" check (price > 0),
      constraint "ck_orders_addresses" check (char_length(btrim(origin_address)) >= 3 and char_length(btrim(destination_address)) >= 3),
      constraint "ck_orders_driver_by_status" check ((status in ('Created', 'Bidding') and driver_id is null)
        or (status in ('Assigned', 'Loading', 'InTransit', 'Unloading', 'Completed') and driver_id is not null)
        or status = 'Cancelled'),
      constraint "ck_orders_escrow_by_status" check ((not is_escrow_locked or status in ('Assigned', 'Loading', 'InTransit', 'Unloading'))
        and (is_escrow_locked or status not in ('Loading', 'InTransit', 'Unloading'))),
      constraint "ck_orders_cancel_reason" check (cancel_reason is null or status = 'Cancelled'),
      constraint "orders_client_id_foreign" foreign key ("client_id") references "users" ("id") on delete restrict,
      constraint "orders_driver_id_foreign" foreign key ("driver_id") references "users" ("id") on delete restrict,
      constraint "orders_cargo_type_code_foreign" foreign key ("cargo_type_code") references "cargo_types" ("code") on delete restrict
    );`);
    // «Мои заявки» заказчика: WHERE client_id = ? ORDER BY created_at DESC
    this.addSql(`create index "idx_orders_client_created" on "orders" ("client_id", "created_at" desc);`);
    // «Мои рейсы» водителя: WHERE driver_id = ? ORDER BY updated_at DESC (заявки без водителя не индексируются)
    this.addSql(`create index "idx_orders_driver_updated" on "orders" ("driver_id", "updated_at" desc) where driver_id is not null;`);
    // Лента водителя: только открытые заявки, новые сверху
    this.addSql(`create index "idx_orders_open_created" on "orders" ("created_at" desc) where status in ('Created', 'Bidding');`);

    // ------------------------------------------------------------------------- bids
    this.addSql(`create table "bids" (
      "id" uuid not null default gen_random_uuid(),
      "order_id" uuid not null,
      "driver_id" uuid not null,
      "offered_price" numeric(12,2) not null,
      "comment" varchar(300) null,
      "status" text not null default 'Pending',
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      constraint "bids_pkey" primary key ("id"),
      constraint "uk_bids_order_driver" unique ("order_id", "driver_id"),
      constraint "bids_status_check" check ("status" in ('Pending', 'Accepted', 'Rejected')),
      constraint "ck_bids_price_positive" check (offered_price > 0),
      constraint "bids_order_id_foreign" foreign key ("order_id") references "orders" ("id") on delete cascade,
      constraint "bids_driver_id_foreign" foreign key ("driver_id") references "users" ("id") on delete cascade
    );`);
    // Не больше одного принятого отклика на заявку
    this.addSql(`create unique index "uk_bids_one_accepted" on "bids" ("order_id") where status = 'Accepted';`);
    // «Мои отклики» водителя
    this.addSql(`create index "idx_bids_driver_created" on "bids" ("driver_id", "created_at" desc);`);

    // ----------------------------------------------------------------- order_photos
    this.addSql(`create table "order_photos" (
      "id" uuid not null default gen_random_uuid(),
      "order_id" uuid not null,
      "stage" text not null,
      "file_key" varchar(255) not null,
      "uploaded_at" timestamptz not null default now(),
      constraint "order_photos_pkey" primary key ("id"),
      constraint "uk_order_photos_file_key" unique ("file_key"),
      constraint "order_photos_stage_check" check ("stage" in ('Loading', 'Unloading')),
      constraint "order_photos_order_id_foreign" foreign key ("order_id") references "orders" ("id") on delete cascade
    );`);
    this.addSql(`create index "idx_order_photos_order" on "order_photos" ("order_id");`);

    // ---------------------------------------------------------------------- reviews
    this.addSql(`create table "reviews" (
      "id" uuid not null default gen_random_uuid(),
      "order_id" uuid not null,
      "author_id" uuid not null,
      "target_id" uuid not null,
      "rating" smallint not null,
      "comment" varchar(500) null,
      "created_at" timestamptz not null default now(),
      constraint "reviews_pkey" primary key ("id"),
      constraint "uk_reviews_order_author" unique ("order_id", "author_id"),
      constraint "ck_reviews_rating_range" check (rating between 1 and 5),
      constraint "ck_reviews_not_self" check (author_id <> target_id),
      constraint "reviews_order_id_foreign" foreign key ("order_id") references "orders" ("id") on delete cascade,
      constraint "reviews_author_id_foreign" foreign key ("author_id") references "users" ("id") on delete restrict,
      constraint "reviews_target_id_foreign" foreign key ("target_id") references "users" ("id") on delete restrict
    );`);
    this.addSql(`create index "idx_reviews_target" on "reviews" ("target_id");`);

    for (const table of TABLES) {
      this.addSql(`alter table "${table}" enable row level security;`);
    }
  }

  override down(): void {
    for (const table of [...TABLES].reverse()) {
      this.addSql(`drop table if exists "${table}";`);
    }
  }
}

const TABLES = ['cargo_types', 'users', 'vehicles', 'vehicle_cargo_types', 'orders', 'bids', 'order_photos', 'reviews'];
