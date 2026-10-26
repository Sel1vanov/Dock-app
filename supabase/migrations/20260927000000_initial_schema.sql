-- Dock: исходная схема БД (7 таблиц, 11 связей).
-- Файл восстановлен по состоянию проекта Supabase на 26.10.2026 и уже применён к нему;
-- он нужен, чтобы схему можно было развернуть с нуля (supabase db reset).

create type public.user_role as enum ('Client', 'Driver', 'Admin');
create type public.order_status as enum (
  'Created', 'Bidding', 'Assigned', 'Loading', 'InTransit', 'Unloading', 'Completed', 'Cancelled', 'Disputed'
);
create type public.bid_status as enum ('Pending', 'Accepted', 'Rejected');
create type public.photo_stage as enum ('Loading', 'Unloading');
create type public.dispute_status as enum ('Open', 'Resolved_Client', 'Resolved_Driver', 'Closed');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role public.user_role not null default 'Client',
  is_verified boolean not null default false,
  is_blocked boolean not null default false,
  full_name text,
  phone text,
  verification_doc_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.users (id) on delete cascade,
  max_weight numeric not null,
  length numeric not null,
  width numeric not null,
  height numeric not null,
  special_permits_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users (id) on delete restrict,
  driver_id uuid references public.users (id) on delete set null,
  cargo_weight numeric not null,
  cargo_length numeric not null,
  cargo_width numeric not null,
  cargo_height numeric not null,
  origin_address text not null,
  origin_lat numeric,
  origin_lng numeric,
  destination_address text not null,
  destination_lat numeric,
  destination_lng numeric,
  price numeric not null,
  status public.order_status not null default 'Created',
  is_escrow_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  driver_id uuid not null references public.users (id) on delete cascade,
  offered_price numeric not null,
  status public.bid_status not null default 'Pending',
  created_at timestamptz not null default now(),
  constraint uk_order_driver unique (order_id, driver_id)
);

create table public.order_photos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  photo_url text not null,
  stage public.photo_stage not null,
  uploaded_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  author_id uuid not null references public.users (id),
  target_id uuid not null references public.users (id),
  rating integer check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now()
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  initiated_by uuid not null references public.users (id),
  reason text not null,
  status public.dispute_status not null default 'Open',
  resolution_comment text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
