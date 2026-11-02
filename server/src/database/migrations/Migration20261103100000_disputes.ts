import { Migration } from '@mikro-orm/migrations';

const NOTIFICATION_TYPES = [
  'BidPlaced',
  'BidUpdated',
  'CounterOffer',
  'CounterAccepted',
  'BidAccepted',
  'BidRejected',
  'OrderPaid',
  'TripStatus',
  'OrderCompleted',
  'OrderCancelled',
  'ReviewReceived',
  'VerificationResult',
  'VerificationRequested',
  'PasswordResetRequested',
];
const DISPUTE_NOTIFICATION_TYPES = ['DisputeOpened', 'DisputeResolved'];
const list = (values: string[]) => values.map((v) => `'${v}'`).join(', ');

/**
 * Миграция 5 — споры (UC-20 «Открыть спор», UC-21 «Разрешить спор»):
 *  1. Новая таблица disputes: кто и почему открыл спор, на каком этапе рейса, решение администратора.
 *     Частичный уникальный индекс не даёт открыть второй спор, пока первый не решён.
 *  2. Новый статус заказа Disputed: рейс приостановлен, средства остаются замороженными —
 *     CHECK-ограничения orders расширяются.
 *  3. Новые типы уведомлений DisputeOpened и DisputeResolved.
 */
export class Migration20261103100000_disputes extends Migration {
  override name = 'Migration20261103100000_disputes';

  override up(): void {
    // 1. Таблица споров
    this.addSql(`create table "disputes" (
      "id" uuid not null default gen_random_uuid(),
      "order_id" uuid not null,
      "opened_by_id" uuid not null,
      "reason" varchar(500) not null,
      "order_status_at_open" text not null,
      "status" text not null default 'Open',
      "resolution_comment" varchar(500) null,
      "resolved_by_id" uuid null,
      "resolved_at" timestamptz null,
      "created_at" timestamptz not null default now(),
      constraint "disputes_pkey" primary key ("id"),
      constraint "disputes_status_check" check ("status" in ('Open', 'ResolvedClient', 'ResolvedDriver')),
      constraint "disputes_order_status_at_open_check"
        check ("order_status_at_open" in ('Assigned', 'Loading', 'InTransit', 'Unloading')),
      constraint "ck_disputes_reason" check (char_length(btrim(reason)) >= 5),
      constraint "ck_disputes_resolution" check ((status = 'Open' and resolved_at is null and resolution_comment is null)
        or (status <> 'Open' and resolved_at is not null and resolution_comment is not null)),
      constraint "disputes_order_id_foreign" foreign key ("order_id") references "orders" ("id") on delete cascade,
      constraint "disputes_opened_by_id_foreign" foreign key ("opened_by_id") references "users" ("id") on delete restrict,
      constraint "disputes_resolved_by_id_foreign" foreign key ("resolved_by_id") references "users" ("id") on delete set null
    );`);
    // Споры заказа (карточка заявки)
    this.addSql(`create index "idx_disputes_order" on "disputes" ("order_id");`);
    // Очередь администратора: открытые споры по дате
    this.addSql(`create index "idx_disputes_status_created" on "disputes" ("status", "created_at");`);
    // Не больше одного открытого спора по заказу
    this.addSql(`create unique index "uk_disputes_order_open" on "disputes" ("order_id") where status = 'Open';`);

    // 2. Статус заказа Disputed
    this.addSql(`alter table "orders"
      drop constraint "orders_status_check",
      drop constraint "ck_orders_driver_by_status",
      drop constraint "ck_orders_escrow_by_status";`);
    this.addSql(`alter table "orders"
      add constraint "orders_status_check" check ("status" in ('Created', 'Bidding', 'Assigned', 'Loading', 'InTransit', 'Unloading', 'Disputed', 'Completed', 'Cancelled')),
      add constraint "ck_orders_driver_by_status" check ((status in ('Created', 'Bidding') and driver_id is null)
        or (status in ('Assigned', 'Loading', 'InTransit', 'Unloading', 'Disputed', 'Completed') and driver_id is not null)
        or status = 'Cancelled'),
      add constraint "ck_orders_escrow_by_status" check ((not is_escrow_locked or status in ('Assigned', 'Loading', 'InTransit', 'Unloading', 'Disputed'))
        and (is_escrow_locked or status not in ('Loading', 'InTransit', 'Unloading', 'Disputed')));`);

    // 3. Типы уведомлений
    this.addSql(`alter table "notifications" drop constraint "notifications_type_check";`);
    this.addSql(`alter table "notifications" add constraint "notifications_type_check"
      check ("type" in (${list([...NOTIFICATION_TYPES, ...DISPUTE_NOTIFICATION_TYPES])}));`);
  }

  override down(): void {
    // Заказы с открытым спором возвращаются на этап рейса, на котором спор был открыт
    this.addSql(`update "orders" o set "status" = d."order_status_at_open"
      from "disputes" d where d."order_id" = o."id" and d."status" = 'Open' and o."status" = 'Disputed';`);
    this.addSql(`delete from "notifications" where "type" in (${list(DISPUTE_NOTIFICATION_TYPES)});`);
    this.addSql(`alter table "notifications" drop constraint "notifications_type_check";`);
    this.addSql(`alter table "notifications" add constraint "notifications_type_check"
      check ("type" in (${list(NOTIFICATION_TYPES)}));`);
    this.addSql(`alter table "orders"
      drop constraint "orders_status_check",
      drop constraint "ck_orders_driver_by_status",
      drop constraint "ck_orders_escrow_by_status";`);
    this.addSql(`alter table "orders"
      add constraint "orders_status_check" check ("status" in ('Created', 'Bidding', 'Assigned', 'Loading', 'InTransit', 'Unloading', 'Completed', 'Cancelled')),
      add constraint "ck_orders_driver_by_status" check ((status in ('Created', 'Bidding') and driver_id is null)
        or (status in ('Assigned', 'Loading', 'InTransit', 'Unloading', 'Completed') and driver_id is not null)
        or status = 'Cancelled'),
      add constraint "ck_orders_escrow_by_status" check ((not is_escrow_locked or status in ('Assigned', 'Loading', 'InTransit', 'Unloading'))
        and (is_escrow_locked or status not in ('Loading', 'InTransit', 'Unloading')));`);
    this.addSql(`drop table if exists "disputes";`);
  }
}
