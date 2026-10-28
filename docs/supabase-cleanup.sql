-- Удаление схемы старой версии Dock (версия 0.6: BaaS на Supabase) перед переходом на Dock API.
-- Выполнить один раз: Supabase → SQL Editor → вставить → Run.
-- ВНИМАНИЕ: удаляет старые таблицы с данными и старые аккаунты Supabase Auth.
drop trigger if exists on_auth_user_created on auth.users;
drop policy if exists documents_insert_own on storage.objects;
drop policy if exists documents_select_own on storage.objects;
drop policy if exists order_photos_insert_driver on storage.objects;
drop policy if exists order_photos_select_participant on storage.objects;
drop table if exists public.disputes, public.reviews, public.order_photos, public.bids, public.orders, public.vehicles, public.users cascade;
drop function if exists public.handle_new_user(), public.set_updated_at(), public.users_guard(), public.orders_guard(),
  public.bids_guard(), public.bids_after_insert(), public.order_photos_guard(), public.reviews_guard(), public.accept_bid(uuid),
  public.my_role(), public.is_admin(), public.is_order_client(uuid), public.is_order_driver(uuid),
  public.is_order_participant(uuid), public.has_bid_on(uuid), public.shares_order_with(uuid), public.guard_bypassed() cascade;
drop type if exists public.user_role, public.order_status, public.bid_status, public.photo_stage, public.dispute_status,
  public.cargo_type, public.vehicle_type cascade;
delete from auth.users;
delete from supabase_migrations.schema_migrations;
