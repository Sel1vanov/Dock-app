-- Dock: расширение схемы под сценарии Vision (UC-03, UC-07, UC-11, UC-19).
-- Изменения только добавочные: существующие данные не затрагиваются.

-- UC-03: «Указать тип спецтехники и описание» — категория груза и описание.
create type public.cargo_type as enum (
  'Car', 'Container', 'Machinery', 'Agricultural', 'Equipment', 'Other'
);

alter table public.orders
  add column cargo_type public.cargo_type not null default 'Other',
  add column description text,
  -- UC-07: «Указать причину отмены»
  add column cancel_reason text;

-- UC-11: «Указать комментарий (при необходимости)» к встречной цене.
alter table public.bids
  add column comment text;

-- Тип ТС (трал, манипулятор, эвакуатор...) и модель/госномер для карточки водителя.
create type public.vehicle_type as enum (
  'Trawl', 'Manipulator', 'TowTruck', 'Flatbed', 'Other'
);

alter table public.vehicles
  add column vehicle_type public.vehicle_type not null default 'Other',
  add column model text;

-- UC-19: оценку оставляют обе стороны, поэтому уникальна пара (заказ, автор), а не заказ.
alter table public.reviews drop constraint reviews_order_id_key;
alter table public.reviews add constraint uk_review_order_author unique (order_id, author_id);

-- Индексы под частые выборки (лента водителя, мои заказы, отклики, фото).
create index idx_orders_status on public.orders (status);
create index idx_orders_client on public.orders (client_id);
create index idx_orders_driver on public.orders (driver_id);
create index idx_bids_order on public.bids (order_id);
create index idx_bids_driver on public.bids (driver_id);
create index idx_vehicles_driver on public.vehicles (driver_id);
create index idx_order_photos_order on public.order_photos (order_id);
create index idx_reviews_target on public.reviews (target_id);

-- updated_at обновляется автоматически.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_users_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger trg_vehicles_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();
create trigger trg_orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- Профиль public.users создаётся автоматически при регистрации в Supabase Auth.
-- Роль берётся из метаданных регистрации; роль Admin самостоятельно получить нельзя.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.users (id, email, role, full_name, phone)
  values (
    new.id,
    new.email,
    case when requested_role = 'Driver' then 'Driver'::public.user_role else 'Client'::public.user_role end,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Профили для пользователей, зарегистрированных до появления триггера.
insert into public.users (id, email, role, full_name, phone)
select
  au.id,
  au.email,
  case when au.raw_user_meta_data ->> 'role' = 'Driver' then 'Driver'::public.user_role else 'Client'::public.user_role end,
  au.raw_user_meta_data ->> 'full_name',
  au.raw_user_meta_data ->> 'phone'
from auth.users au
where au.email is not null
on conflict do nothing;
