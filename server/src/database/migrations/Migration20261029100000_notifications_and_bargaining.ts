import { Migration } from '@mikro-orm/migrations';

/**
 * Миграция 3:
 *  1. Таблица notifications — уведомления о событиях заявки, торга, рейса и модерации.
 *  2. bids.counter_price — встречная цена заказчика (двусторонний торг).
 *  3. users.password_changed_at — после смены пароля токены, выданные раньше, не принимаются.
 */
export class Migration20261029100000_notifications_and_bargaining extends Migration {
  override name = 'Migration20261029100000_notifications_and_bargaining';

  override up(): void {
    // 1. Уведомления
    this.addSql(`create table "notifications" (
      "id" uuid not null default gen_random_uuid(),
      "user_id" uuid not null,
      "type" text not null,
      "title" varchar(120) not null,
      "body" varchar(300) not null,
      "order_id" uuid null,
      "related_user_id" uuid null,
      "is_read" boolean not null default false,
      "created_at" timestamptz not null default now(),
      constraint "notifications_pkey" primary key ("id"),
      constraint "notifications_type_check" check ("type" in ('BidPlaced', 'BidUpdated', 'CounterOffer', 'CounterAccepted', 'BidAccepted', 'BidRejected', 'OrderPaid', 'TripStatus', 'OrderCompleted', 'OrderCancelled', 'ReviewReceived', 'VerificationResult', 'VerificationRequested', 'PasswordResetRequested')),
      constraint "notifications_user_id_foreign" foreign key ("user_id") references "users" ("id") on delete cascade,
      constraint "notifications_order_id_foreign" foreign key ("order_id") references "orders" ("id") on delete cascade,
      constraint "notifications_related_user_id_foreign" foreign key ("related_user_id") references "users" ("id") on delete cascade
    );`);
    this.addSql(`alter table "notifications" enable row level security;`);
    // Список уведомлений пользователя, новые сверху
    this.addSql(`create index "idx_notifications_user_created" on "notifications" ("user_id", "created_at" desc);`);
    // Счётчик непрочитанных: индекс только по непрочитанным строкам
    this.addSql(`create index "idx_notifications_user_unread" on "notifications" ("user_id") where not is_read;`);

    // 2. Встречная цена заказчика
    this.addSql(`alter table "bids"
      add column "counter_price" numeric(12,2) null,
      add constraint "ck_bids_counter_price_positive" check (counter_price is null or counter_price > 0);`);

    // 3. Дата смены пароля
    this.addSql(`alter table "users" add column "password_changed_at" timestamptz null;`);
  }

  override down(): void {
    this.addSql(`alter table "users" drop column "password_changed_at";`);
    this.addSql(`alter table "bids"
      drop constraint if exists "ck_bids_counter_price_positive",
      drop column "counter_price";`);
    this.addSql(`drop table if exists "notifications";`);
  }
}
