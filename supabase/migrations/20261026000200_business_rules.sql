-- Dock: бизнес-правила на стороне БД.
-- Клиентское приложение проверяет те же правила в сервисном слое, но источник истины — база:
-- так правила нельзя обойти прямым REST-запросом.

-- ---------------------------------------------------------------------------
-- Вспомогательные функции (security definer: не зависят от RLS и не дают рекурсии политик)
-- ---------------------------------------------------------------------------

create or replace function public.my_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select role = 'Admin' from public.users where id = auth.uid()), false);
$$;

create or replace function public.is_order_client(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.orders where id = p_order_id and client_id = auth.uid());
$$;

create or replace function public.is_order_driver(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.orders where id = p_order_id and driver_id = auth.uid());
$$;

create or replace function public.is_order_participant(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.orders
    where id = p_order_id and (client_id = auth.uid() or driver_id = auth.uid())
  );
$$;

create or replace function public.has_bid_on(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.bids where order_id = p_order_id and driver_id = auth.uid());
$$;

-- Видит ли текущий пользователь профиль p_user_id (контрагент по заказу или отклику).
create or replace function public.shares_order_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where
      -- заказчик видит назначенного водителя и откликнувшихся водителей
      (o.client_id = auth.uid() and (
        o.driver_id = p_user_id
        or exists (select 1 from public.bids b where b.order_id = o.id and b.driver_id = p_user_id)
      ))
      -- водитель видит заказчика открытых заказов, своих рейсов и заказов со своим откликом
      or (o.client_id = p_user_id and (
        o.driver_id = auth.uid()
        or o.status in ('Created', 'Bidding')
        or exists (select 1 from public.bids b where b.order_id = o.id and b.driver_id = auth.uid())
      ))
  );
$$;

-- Флаг, которым доверенные функции (accept_bid, триггеры) снимают проверку статусов заказа.
create or replace function public.guard_bypassed()
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce(current_setting('dock.bypass_guard', true), '') = 'on';
$$;

-- ---------------------------------------------------------------------------
-- users: роль, верификацию и блокировку меняет только администратор (UC-02, UC-22)
-- ---------------------------------------------------------------------------

create or replace function public.users_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.is_verified is distinct from old.is_verified
     or new.is_blocked is distinct from old.is_blocked
     or new.email is distinct from old.email then
    raise exception 'Роль, статус верификации и блокировки меняет только администратор';
  end if;
  return new;
end;
$$;

create trigger trg_users_guard before update on public.users
  for each row execute function public.users_guard();

-- ---------------------------------------------------------------------------
-- orders: статусная модель заказа (UC-06, UC-07, UC-12, UC-15, UC-17, UC-18)
--
--   Created ─(отклик)→ Bidding ─(accept_bid)→ Assigned ─(оплата: escrow)→ Assigned+escrow
--     → Loading («Прибыл на погрузку») ─(фото погрузки)→ InTransit («В пути»)
--     → Unloading («Прибыл на выгрузку») ─(фото выгрузки, приёмка заказчиком)→ Completed
--   Created/Bidding/Assigned без оплаты ─(заказчик)→ Cancelled
-- ---------------------------------------------------------------------------

create or replace function public.orders_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  is_client boolean := coalesce(uid = old.client_id, false);
  is_driver boolean := coalesce(uid = old.driver_id, false);
begin
  if uid is null or public.guard_bypassed() or public.is_admin() then
    if new.status = 'Completed' then
      new.is_escrow_locked := false;
    end if;
    return new;
  end if;

  if new.client_id is distinct from old.client_id or new.driver_id is distinct from old.driver_id then
    raise exception 'Исполнитель назначается только через выбор отклика';
  end if;

  if old.is_escrow_locked and not new.is_escrow_locked then
    raise exception 'Средства безопасной сделки разблокируются только при завершении заказа';
  end if;

  if is_client then
    if old.status not in ('Created', 'Bidding') and (
      new.cargo_weight, new.cargo_length, new.cargo_width, new.cargo_height, new.cargo_type,
      new.price, new.origin_address, new.destination_address
    ) is distinct from (
      old.cargo_weight, old.cargo_length, old.cargo_width, old.cargo_height, old.cargo_type,
      old.price, old.origin_address, old.destination_address
    ) then
      raise exception 'Параметры заказа нельзя менять после выбора исполнителя';
    end if;

    if new.is_escrow_locked and not old.is_escrow_locked and old.status <> 'Assigned' then
      raise exception 'Оплатить можно только заказ с выбранным исполнителем';
    end if;

    if new.status <> old.status and not (
      (old.status in ('Created', 'Bidding') and new.status = 'Cancelled')
      or (old.status = 'Assigned' and not old.is_escrow_locked and new.status = 'Cancelled')
      or (old.status = 'Unloading' and new.status = 'Completed')
    ) then
      raise exception 'Недопустимая смена статуса заказа: % → %', old.status, new.status;
    end if;

    if new.status = 'Completed' and new.status <> old.status and not exists (
      select 1 from public.order_photos where order_id = old.id and stage = 'Unloading'
    ) then
      raise exception 'Нельзя подтвердить приёмку без фотофиксации выгрузки';
    end if;

  elsif is_driver then
    if (
      new.cargo_weight, new.cargo_length, new.cargo_width, new.cargo_height, new.cargo_type,
      new.price, new.origin_address, new.destination_address, new.description,
      new.is_escrow_locked, new.cancel_reason
    ) is distinct from (
      old.cargo_weight, old.cargo_length, old.cargo_width, old.cargo_height, old.cargo_type,
      old.price, old.origin_address, old.destination_address, old.description,
      old.is_escrow_locked, old.cancel_reason
    ) then
      raise exception 'Водитель может менять только статус рейса';
    end if;

    if new.status <> old.status and not (
      (old.status = 'Assigned' and old.is_escrow_locked and new.status = 'Loading')
      or (old.status = 'Loading' and new.status = 'InTransit')
      or (old.status = 'InTransit' and new.status = 'Unloading')
    ) then
      if old.status = 'Assigned' and not old.is_escrow_locked then
        raise exception 'Рейс можно начать только после оплаты заказа заказчиком';
      end if;
      raise exception 'Недопустимая смена статуса рейса: % → %', old.status, new.status;
    end if;

    if new.status = 'InTransit' and old.status <> 'InTransit' and not exists (
      select 1 from public.order_photos where order_id = old.id and stage = 'Loading'
    ) then
      raise exception 'Сначала загрузите фотофиксацию погрузки';
    end if;

  else
    raise exception 'Нет прав на изменение заказа';
  end if;

  -- UC-14: после приёмки груза средства переводятся исполнителю
  if new.status = 'Completed' then
    new.is_escrow_locked := false;
  end if;
  return new;
end;
$$;

create trigger trg_orders_guard before update on public.orders
  for each row execute function public.orders_guard();

-- ---------------------------------------------------------------------------
-- bids: отклик и торг (UC-08, UC-09, UC-10, UC-11)
-- ---------------------------------------------------------------------------

create or replace function public.bids_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  o public.orders;
  u public.users;
begin
  if uid is null or public.guard_bypassed() or public.is_admin() then
    return new;
  end if;

  select * into o from public.orders where id = new.order_id;

  if tg_op = 'INSERT' then
    select * into u from public.users where id = uid;
    if u.role is distinct from 'Driver' then
      raise exception 'Откликаться на заявки могут только водители';
    end if;
    if u.is_blocked then
      raise exception 'Аккаунт заблокирован';
    end if;
    if not u.is_verified then
      raise exception 'Отклик доступен после проверки документов администратором';
    end if;
    if o.status not in ('Created', 'Bidding') then
      raise exception 'Заявка уже не принимает отклики';
    end if;
    if new.offered_price <= 0 then
      raise exception 'Цена должна быть больше нуля';
    end if;
    -- UC-09: груз должен помещаться хотя бы в одно ТС водителя
    if not exists (
      select 1 from public.vehicles v
      where v.driver_id = uid
        and v.max_weight >= o.cargo_weight
        and v.length >= o.cargo_length
        and v.width >= o.cargo_width
        and v.height >= o.cargo_height
    ) then
      raise exception 'Ни одно ваше ТС не подходит под габариты и вес груза';
    end if;
    new.status := 'Pending';
    return new;
  end if;

  -- UPDATE
  if uid = old.driver_id then
    if old.status <> 'Pending' or new.status <> old.status or new.order_id <> old.order_id then
      raise exception 'Изменить можно только ожидающий отклик';
    end if;
    if new.offered_price <= 0 then
      raise exception 'Цена должна быть больше нуля';
    end if;
  elsif uid = o.client_id then
    if not (old.status = 'Pending' and new.status = 'Rejected')
       or new.offered_price <> old.offered_price
       or new.comment is distinct from old.comment then
      raise exception 'Заказчик может только отклонить отклик; выбор исполнителя — через accept_bid';
    end if;
  else
    raise exception 'Нет прав на изменение отклика';
  end if;
  return new;
end;
$$;

create trigger trg_bids_guard before insert or update on public.bids
  for each row execute function public.bids_guard();

-- Первый отклик переводит заявку из «Создана» в «Идёт торг».
create or replace function public.bids_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('dock.bypass_guard', 'on', true);
  update public.orders set status = 'Bidding' where id = new.order_id and status = 'Created';
  perform set_config('dock.bypass_guard', 'off', true);
  return new;
end;
$$;

create trigger trg_bids_after_insert after insert on public.bids
  for each row execute function public.bids_after_insert();

-- UC-06: выбор исполнителя. Атомарно (одна транзакция):
-- назначает водителя, фиксирует согласованную цену, принимает отклик и отклоняет остальные.
create or replace function public.accept_bid(p_bid_id uuid)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  b public.bids;
  o public.orders;
begin
  select * into b from public.bids where id = p_bid_id for update;
  if not found then
    raise exception 'Отклик не найден';
  end if;

  select * into o from public.orders where id = b.order_id for update;
  if o.client_id is distinct from auth.uid() then
    raise exception 'Выбрать исполнителя может только автор заявки';
  end if;
  if o.status not in ('Created', 'Bidding') then
    raise exception 'Исполнитель по заявке уже выбран или заявка закрыта';
  end if;
  if b.status <> 'Pending' then
    raise exception 'Отклик уже обработан';
  end if;

  perform set_config('dock.bypass_guard', 'on', true);

  update public.orders
     set driver_id = b.driver_id, price = b.offered_price, status = 'Assigned'
   where id = o.id
   returning * into o;

  update public.bids set status = 'Accepted' where id = b.id;
  update public.bids set status = 'Rejected'
   where order_id = o.id and id <> b.id and status = 'Pending';

  perform set_config('dock.bypass_guard', 'off', true);
  return o;
end;
$$;

revoke execute on function public.accept_bid(uuid) from public, anon;
grant execute on function public.accept_bid(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- order_photos: фото погрузки — на статусе Loading, выгрузки — на Unloading (UC-17)
-- ---------------------------------------------------------------------------

create or replace function public.order_photos_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  st public.order_status;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  select status into st from public.orders where id = new.order_id;
  if new.stage = 'Loading' and st <> 'Loading' then
    raise exception 'Фото погрузки загружается на статусе «Прибыл на погрузку»';
  end if;
  if new.stage = 'Unloading' and st <> 'Unloading' then
    raise exception 'Фото выгрузки загружается на статусе «Прибыл на выгрузку»';
  end if;
  return new;
end;
$$;

create trigger trg_order_photos_guard before insert on public.order_photos
  for each row execute function public.order_photos_guard();

-- ---------------------------------------------------------------------------
-- reviews: отзыв — только по завершённому заказу и только о контрагенте (UC-19)
-- ---------------------------------------------------------------------------

create or replace function public.reviews_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  o public.orders;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  select * into o from public.orders where id = new.order_id;
  if o.status <> 'Completed' then
    raise exception 'Отзыв можно оставить только по завершённому заказу';
  end if;
  if not (
    (new.author_id = o.client_id and new.target_id = o.driver_id)
    or (new.author_id = o.driver_id and new.target_id = o.client_id)
  ) then
    raise exception 'Отзыв оставляется только контрагенту по заказу';
  end if;
  return new;
end;
$$;

create trigger trg_reviews_guard before insert on public.reviews
  for each row execute function public.reviews_guard();

-- Триггерные и служебные функции не должны вызываться через REST (/rpc).
revoke execute on function
  public.handle_new_user(), public.set_updated_at(), public.users_guard(), public.orders_guard(),
  public.bids_guard(), public.bids_after_insert(), public.order_photos_guard(), public.reviews_guard()
from public, anon, authenticated;
