-- Dock: вспомогательные функции RLS нужны только авторизованным пользователям.
-- (Они вызываются из политик от имени роли authenticated, поэтому EXECUTE у неё остаётся.)
revoke execute on function
  public.my_role(), public.is_admin(), public.is_order_client(uuid), public.is_order_driver(uuid),
  public.is_order_participant(uuid), public.has_bid_on(uuid), public.shares_order_with(uuid)
from public, anon;
grant execute on function
  public.my_role(), public.is_admin(), public.is_order_client(uuid), public.is_order_driver(uuid),
  public.is_order_participant(uuid), public.has_bid_on(uuid), public.shares_order_with(uuid)
to authenticated;
