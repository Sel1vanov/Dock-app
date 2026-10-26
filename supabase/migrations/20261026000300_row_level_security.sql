-- Dock: Row Level Security (SAD, раздел 2 «Безопасность и конфиденциальность»).
-- Анонимный доступ закрыт полностью: все политики выданы роли authenticated.
-- Детальные правила смены статусов — в триггерах (20261026000200_business_rules.sql).

alter table public.users enable row level security;
alter table public.vehicles enable row level security;
alter table public.orders enable row level security;
alter table public.bids enable row level security;
alter table public.order_photos enable row level security;
alter table public.reviews enable row level security;
alter table public.disputes enable row level security;

-- users ----------------------------------------------------------------------
create policy users_select on public.users for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.shares_order_with(id));

-- Запасной путь создания профиля с клиента (основной — триггер on_auth_user_created).
create policy users_insert_self on public.users for insert to authenticated
  with check (
    id = auth.uid()
    and role in ('Client', 'Driver')
    and is_verified = false
    and is_blocked = false
  );

create policy users_update on public.users for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- vehicles -------------------------------------------------------------------
-- Габариты ТС не являются персональными данными: их видит заказчик в откликах.
create policy vehicles_select on public.vehicles for select to authenticated
  using (true);

create policy vehicles_insert on public.vehicles for insert to authenticated
  with check (driver_id = auth.uid() and public.my_role() = 'Driver');

create policy vehicles_update on public.vehicles for update to authenticated
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

create policy vehicles_delete on public.vehicles for delete to authenticated
  using (driver_id = auth.uid());

-- orders ---------------------------------------------------------------------
create policy orders_select on public.orders for select to authenticated
  using (
    client_id = auth.uid()
    or driver_id = auth.uid()
    or public.is_admin()
    or public.has_bid_on(id)
    or (status in ('Created', 'Bidding') and public.my_role() = 'Driver')
  );

create policy orders_insert on public.orders for insert to authenticated
  with check (
    client_id = auth.uid()
    and public.my_role() = 'Client'
    and status = 'Created'
    and driver_id is null
    and is_escrow_locked = false
  );

create policy orders_update on public.orders for update to authenticated
  using (client_id = auth.uid() or driver_id = auth.uid() or public.is_admin())
  with check (client_id = auth.uid() or driver_id = auth.uid() or public.is_admin());

-- bids -----------------------------------------------------------------------
create policy bids_select on public.bids for select to authenticated
  using (driver_id = auth.uid() or public.is_order_client(order_id) or public.is_admin());

create policy bids_insert on public.bids for insert to authenticated
  with check (driver_id = auth.uid());

create policy bids_update on public.bids for update to authenticated
  using (driver_id = auth.uid() or public.is_order_client(order_id) or public.is_admin())
  with check (driver_id = auth.uid() or public.is_order_client(order_id) or public.is_admin());

-- Отозвать можно только ещё не обработанный отклик.
create policy bids_delete on public.bids for delete to authenticated
  using (driver_id = auth.uid() and status = 'Pending');

-- order_photos ---------------------------------------------------------------
create policy order_photos_select on public.order_photos for select to authenticated
  using (public.is_order_participant(order_id) or public.is_admin());

create policy order_photos_insert on public.order_photos for insert to authenticated
  with check (public.is_order_driver(order_id));

-- reviews --------------------------------------------------------------------
-- Рейтинг публичен для всех участников платформы.
create policy reviews_select on public.reviews for select to authenticated
  using (true);

create policy reviews_insert on public.reviews for insert to authenticated
  with check (author_id = auth.uid());

-- disputes (UC-20, UC-21 — экраны будут на следующем этапе) ------------------
create policy disputes_select on public.disputes for select to authenticated
  using (public.is_order_participant(order_id) or public.is_admin());

create policy disputes_insert on public.disputes for insert to authenticated
  with check (initiated_by = auth.uid() and public.is_order_participant(order_id));

create policy disputes_update on public.disputes for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
